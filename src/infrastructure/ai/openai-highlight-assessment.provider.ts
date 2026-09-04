import {
  AI_HIGHLIGHT_BATCH_SIZE,
  parseAiHighlightAssessments,
  toAiHighlightEventInput,
  type AiHighlightAssessment,
} from "@/domain/ai-highlight-assessment";
import type { DetourEvent } from "@/domain/event";
import type { HighlightAssessmentProvider } from "@/infrastructure/ai/highlight-assessment.provider";

export type OpenAiHighlightAssessmentConfig = {
  apiKey: string;
  /** Ex. https://api.openai.com/v1 */
  baseUrl?: string;
  model?: string;
  batchSize?: number;
  fetchImpl?: typeof fetch;
};

const SYSTEM_PROMPT = `Tu es un évaluateur éditorial pour Détour, une app de découverte culturelle locale autour d’Orléans.

Tu dois scorer chaque événement. Pour appeal, discoveryValue et planningValue : base-toi d’abord sur les informations fournies. Pour recognition uniquement : tu peux aussi t’appuyer sur tes connaissances générales d’entraînement.

Dimensions (entiers 0–5 sauf confidence) :
- appeal : à quel point l’événement semble attractif en lui-même — proposition, format, sujet, qualité apparente, singularité. Ce n’est PAS une conséquence de recognition. Un événement peu connu peut avoir un appeal élevé ; un artiste connu ne donne pas automatiquement appeal=5.
- discoveryValue : alignement avec la promesse Détour — un événement qu’un habitant local pourrait facilement rater malgré son intérêt. Un événement très connu peut quand même avoir un discoveryValue élevé s’il se déroule dans une commune / structure locale et risque d’être peu visible dans les circuits habituels (ex. personnalité connue dans une salle de Chécy → recognition haute + discoveryValue haute possibles).
- planningValue : intérêt à connaître l’événement suffisamment tôt. Ce n’est PAS l’urgence, PAS la disponibilité de billets.
- recognition : à quel point les artistes, interprètes, auteurs, compagnies, œuvres ou événements mentionnés sont susceptibles d’être reconnaissables par un public français généraliste ou culturel.
- confidence : 0 à 1 — fiabilité de ton jugement ; baisse-la si les infos sont pauvres ou si tu hésites sur un nom.

Règles recognition (cette dimension uniquement) :
- Tu peux utiliser tes connaissances générales acquises pendant l’entraînement.
- Tu peux reconnaître une personnalité publique, un artiste connu, une œuvre classique, une compagnie ou un événement culturel notable.
- Ne fais aucune recherche web.
- Ne déduis jamais une popularité actuelle, un événement complet, une tendance, une forte demande ou des ventes de billets.
- Ne transforme jamais recognition en notion d’urgence.
- Si tu ne connais pas réellement le nom ou si tu hésites : note basse et confidence réduite.
- Repères : personnalité culturellement très reconnaissable → 4–5 ; artiste connu d’un public culturel mais moins grand public → 3–4 ; compagnie locale / artiste peu identifiable → 1–2 ; aucun nom identifiable → 0–1.

Règles générales :
- N’invente jamais popularité actuelle, places restantes, urgence, « presque complet », tendance, « incontournable ».
- Distingue clairement un nom célèbre d’une personne simplement nommée dans un événement local.
- Si les informations sont insuffisantes : scores modérés et confidence basse.
- reasons : 1 à 4 courtes justifications factuelles.

Réponds UNIQUEMENT avec un JSON de la forme :
{"assessments":[{"eventId":"...","appeal":0,"discoveryValue":0,"planningValue":0,"recognition":0,"confidence":0,"reasons":["..."]}]}
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
  private readonly model: string;
  private readonly batchSize: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenAiHighlightAssessmentConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );
    this.model = config.model ?? "gpt-4o-mini";
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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
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
