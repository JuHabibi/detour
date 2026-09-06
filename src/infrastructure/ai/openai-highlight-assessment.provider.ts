import {
  AI_HIGHLIGHT_BATCH_SIZE,
  parseAiHighlightAssessments,
  toAiHighlightEventInput,
  type AiHighlightAssessment,
} from "@/domain/ai-highlight-assessment";
import type { DetourEvent } from "@/domain/events/event";
import type { HighlightAssessmentProvider } from "@/infrastructure/ai/highlight-assessment.provider";
import type { AiAssessmentCacheContext } from "@/infrastructure/ai/ai-assessment-cache-key";

export type OpenAiHighlightAssessmentConfig = {
  apiKey: string;
  /** Ex. https://api.openai.com/v1 */
  baseUrl?: string;
  model?: string;
  temperature?: number;
  batchSize?: number;
  fetchImpl?: typeof fetch;
};

/**
 * Version explicite du contrat prompt / scoring.
 * À bumper manuellement si le system prompt ou les dimensions changent.
 */
export const AI_ASSESSMENT_PROMPT_VERSION = "detour-ai-assess-v2";

export const AI_ASSESSMENT_DEFAULT_MODEL = "gpt-4o-mini";
export const AI_ASSESSMENT_DEFAULT_TEMPERATURE = 0.2;

export const OPENAI_HIGHLIGHT_SYSTEM_PROMPT = `Tu es un évaluateur éditorial pour Détour, une app de découverte culturelle locale autour d’Orléans.

Promesse de la section « Faites un détour » : des événements qu’on aurait facilement pu rater — radar culturel local, pas agrégateur.

Tu scores chaque événement. Tu peux utiliser tes connaissances générales d’entraînement pour estimer notoriété, popularité probable, ou rareté relative d’un passage dans une petite commune. Ne fais aucune recherche web.

Évalue chaque événement indépendamment des autres événements présents dans cette requête. Ne modifie pas son score selon la qualité relative des autres événements du batch.

Dimensions (entiers 0–5 sauf confidence) :
- appeal : intérêt intrinsèque de l’événement (proposition, format, sujet, qualité apparente). Indépendant de la notoriété.
- missRisk : probabilité que l’événement passe facilement sous le radar malgré son intérêt (faible visibilité locale, circuit peu médiatisé, date/lieu discrets).
- planningNeed : besoin de s’y prendre en avance (réservation, billetterie, date éloignée, organisation particulière, jauge potentiellement limitée). PAS l’urgence, PAS un inventaire de places.
- localRarity : caractère inhabituel de cet événement dans ce lieu / cette commune / ce territoire. Un artiste connu à Paris n’est pas rare ; le même dans une petite commune autour d’Orléans peut avoir une localRarity élevée. Un artiste connu à Orléans dans une grande salle n’a PAS automatiquement une localRarity élevée. La rareté est locale/contextuelle, jamais absolue.
- likelyDemand : potentiel probable de demande / succès (artiste reconnu, format populaire, susceptibilité d’attirer du monde). Estimation qualitative, pas des ventes.
- confidence : 0 à 1 — fiabilité de ton jugement ; baisse-la si les infos sont pauvres ou si tu hésites.

Interdits absolus :
- inventer des ventes, un nombre de réservations, une jauge, « presque complet »
- inventer une popularité actuelle en temps réel
- inventer qu’un événement est rare sans signal raisonnable (lieu, commune, contraste notoriété/lieu)
- langage marketing (« incontournable », « à ne pas manquer »)

reasons : 1 à 4 courtes justifications factuelles expliquant pourquoi l’événement mérite d’être montré.
Exemples de ton : « Passage inhabituel d’un artiste reconnu dans une petite commune » ; « Événement nécessitant probablement une réservation anticipée » ; « Programmation locale peu visible mais intéressante » ; « Format susceptible d’attirer une forte demande ».

Réponds UNIQUEMENT avec un JSON de la forme :
{"assessments":[{"eventId":"...","appeal":0,"missRisk":0,"planningNeed":0,"localRarity":0,"likelyDemand":0,"confidence":0,"reasons":["..."]}]}
Aucun texte hors JSON.`;

/**
 * Provider HTTP compatible OpenAI Chat Completions.
 * Batches séquentiels — pas de parallélisme agressif.
 */
export class OpenAiHighlightAssessmentProvider
  implements HighlightAssessmentProvider
{
  private readonly apiKey: string;
  private readonly baseUrl: string;
  readonly model: string;
  readonly temperature: number;
  readonly cacheContext: AiAssessmentCacheContext;
  private readonly batchSize: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenAiHighlightAssessmentConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );
    this.model = config.model ?? AI_ASSESSMENT_DEFAULT_MODEL;
    this.temperature =
      config.temperature ?? AI_ASSESSMENT_DEFAULT_TEMPERATURE;
    this.cacheContext = {
      model: this.model,
      promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
      generation: { temperature: this.temperature },
    };
    this.batchSize = config.batchSize ?? AI_HIGHLIGHT_BATCH_SIZE;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async assess(events: DetourEvent[]): Promise<AiHighlightAssessment[]> {
    if (events.length === 0) return [];

    const results: AiHighlightAssessment[] = [];

    for (let index = 0; index < events.length; index += this.batchSize) {
      const batch = events.slice(index, index + this.batchSize);
      const batchResults = await this.assessBatch(batch);
      results.push(...batchResults);
    }

    return results;
  }

  private async assessBatch(
    events: DetourEvent[],
  ): Promise<AiHighlightAssessment[]> {
    const inputs = events.map(toAiHighlightEventInput);
    const expectedIds = inputs.map((item) => item.eventId);

    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: OPENAI_HIGHLIGHT_SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({ events: inputs }),
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `AI highlight assessment failed (${response.status}): ${body.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI highlight assessment returned empty content");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI highlight assessment returned invalid JSON");
    }

    return parseAiHighlightAssessments(parsed, expectedIds);
  }
}
