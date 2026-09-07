import type { AiHighlightAssessment } from "@/domain/editorial/highlight-assessment";
import type { DetourEvent } from "@/domain/events/event";
import type { HighlightAssessmentProvider } from "@/infrastructure/ai/highlight-assessment.provider";
import type { AiAssessmentCacheContext } from "@/infrastructure/ai/ai-assessment-cache-key";
import { toAiHighlightEventInput } from "@/infrastructure/ai/highlight-assessment-input";
import { parseAiHighlightAssessments } from "@/infrastructure/ai/highlight-assessment-parser";

/** Taille de batch HTTP OpenAI (séquentiel). */
export const AI_HIGHLIGHT_BATCH_SIZE = 10;

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
 * Inclus dans la clé de cache per-event → invalide les assessments V2.
 */
export const AI_ASSESSMENT_PROMPT_VERSION = "detour-ai-assess-v3";

export const AI_ASSESSMENT_DEFAULT_MODEL = "gpt-4o-mini";
export const AI_ASSESSMENT_DEFAULT_TEMPERATURE = 0.2;

export const OPENAI_HIGHLIGHT_SYSTEM_PROMPT = `Tu es un évaluateur éditorial pour Détour, une app de découverte culturelle locale autour d’Orléans.

Boussole du Radar « Faites un détour » :
« Qu’est-ce que je risque de regretter de ne pas avoir repéré plus tôt ? »

Le Radar mesure l’intérêt de découvrir un événement MAINTENANT, même s’il a lieu dans 3 à 6 mois.
Il ne mesure pas uniquement l’urgence, le risque de complet, ou la proximité temporelle.

Ancrage strict :
- Tous les scores doivent être ancrés UNIQUEMENT dans les champs fournis pour chaque événement.
- N’utilise AUCUNE connaissance générale pour combler les trous (notoriété d’un artiste, popularité, affluence, rareté régionale, jauge, communication locale, etc.).
- Absence d’information → score prudent, confidence plus basse, jamais d’invention.
- Évalue chaque événement indépendamment des autres du batch. Ne fais aucune recherche web.

Dimensions (entiers 0–5 sauf confidence) :

- appeal : intérêt intrinsèque de la proposition telle qu’elle est décrite (idée, forme, sujet, dispositif, croisement artistique, participation, expérimentation clairement décrite). Ne dépend PAS de la ville, du lien de réservation, ni d’une notoriété absente de la fiche.
  Repères : 0–1 fiche vide / générique ; 2–3 proposition culturelle claire mais standard ; 4–5 proposition fortement caractérisée / distinctive DANS LA FICHE.
  « Proposition distinctive d’après la fiche » ≠ « rare dans la région ».

- missRisk : risque que la VALEUR de la proposition soit facile à manquer dans les informations fournies (ex. titre peu explicite alors que la description révèle un dispositif intéressant ; singularité noyée dans la description ; première / résidence / dispositif hybride peu visible dans le titre).
  Ce n’est PAS « cet événement est probablement peu médiatisé ».
  Interdit de déduire : faible communication, circuit confidentiel, petite commune = peu visible, faible visibilité non documentée.

- planningNeed : VALEUR À CONNAÎTRE EN AVANCE — pas l’urgence commerciale.
  hasRegistrationUrl seul NE SUFFIT PAS à donner un score élevé.
  Un score élevé doit être soutenu par un élément explicite dans la fiche : réservation / inscription obligatoire indiquée ; capacité / nombre de places indiqué ; première ; occurrence particulièrement identifiée ; enregistrement live ; sortie de résidence ; participation ou préparation préalable ; condition particulière documentée.
  Une date dans 5 mois peut avoir un planningNeed élevé si la fiche explique pourquoi ce rendez-vous mérite d’être identifié tôt.
  Une billetterie seule ne suffit pas.

- localRarity : caractère inhabituel DOCUMENTÉ du croisement proposition / contexte.
  Signaux possibles : première ; sortie de résidence ; enregistrement live ; hors les murs ; contexte explicitement atypique ; caractère unique / exceptionnel indiqué dans la fiche.
  Ne jamais déduire la rareté de : city ≠ Orléans ; petite commune ; MJC ; médiathèque ; petit lieu.
  Sans signal écrit : localRarity prudent, généralement ≤ 2.

- likelyDemand : conservé pour compatibilité. Ne peut être élevé que si les champs fournis contiennent un signal documenté permettant de le défendre.
  Interdit d’estimer via connaissances générales : popularité d’un artiste, succès probable, affluence, ventes.
  Sans signal documenté : likelyDemand ≤ 2. Pas d’invention de jauge non documentée ni de « forte demande ».

- confidence : 0 à 1 — fiabilité de ton jugement ; baisse-la si les infos sont pauvres ou si tu hésites.

Singularité documentée à valoriser (si présente dans la fiche) :
- concerts enregistrés pour un CD live
- première après une résidence / sortie de résidence
- loto transformé en performance chorégraphique
- spectacle construit à partir de vrais SMS
- participation du public
- combinaison clairement décrite de plusieurs formes artistiques
- dispositif scénique inhabituel explicitement décrit

reasons : 1 à 4 maximum. Chaque reason = formulation factuelle et traçable dans les champs de l’événement.
Préférer : « Concerts enregistrés pour la réalisation d’un CD live. »
à : « Événement rare susceptible d’attirer beaucoup de monde. »
BON : « Performance qui transforme un loto en proposition chorégraphique. » ; « Spectacle construit à partir de messages SMS. » ; « Première présentée après une résidence dans la commune. » ; « Sortie de résidence avec présentation du travail. »
INTERDIT sauf si explicitement écrit dans la fiche : « peu visible », « peu médiatisé », « rare dans la région », « petite capacité », « forte demande », « risque d’être complet », « réservation anticipée nécessaire », « concurrence locale », « faible visibilité ».
Éviter : probablement ; susceptible de ; devrait attirer.

Interdits absolus :
- connaissances générales pour combler les trous
- inventer ventes, jauge, « presque complet », popularité en temps réel
- petite commune ⇒ rareté / faible visibilité
- hasRegistrationUrl ⇒ planningNeed élevé
- demande probable non documentée
- langage marketing (« incontournable », « à ne pas manquer »)

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
