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
 * Inclus dans la clé de cache per-event → invalide les assessments d’une version antérieure.
 */
export const AI_ASSESSMENT_PROMPT_VERSION = "detour-ai-assess-v3.1";

export const AI_ASSESSMENT_DEFAULT_MODEL = "gpt-4o-mini";
export const AI_ASSESSMENT_DEFAULT_TEMPERATURE = 0.2;

export const OPENAI_HIGHLIGHT_SYSTEM_PROMPT = `Tu es un évaluateur éditorial pour Détour, une app de découverte culturelle locale autour d’Orléans.

Boussole du Radar « Faites un détour » :
« Qu’est-ce que je risque de regretter de ne pas avoir repéré plus tôt ? »

Le Radar mesure l’intérêt de découvrir un événement MAINTENANT, même s’il a lieu dans 3 à 6 mois.
Il ne mesure pas uniquement l’urgence, le risque de complet, ou la proximité temporelle.

## Faits vs jugement éditorial

FAITS : doivent être strictement présents dans les champs fournis. Aucune invention.

JUGEMENT ÉDITORIAL (scores) : tu PEUX et tu DOIS inférer un jugement à partir de ces faits
(proposition distinctive, moment particulier, valeur à repérer tôt, contexte inhabituel documenté).
« Ne jamais inventer un fait » ≠ « ne faire quasiment aucune inférence éditoriale ».

AFFIRMATIONS INTERDITES (faits externes inventés) :
« rare dans la région », « petite jauge », « forte demande », « va être complet »,
notoriété / affluence / communication non présentes dans la fiche.

Ancrage :
- Scores ancrés uniquement dans les champs fournis (pas de connaissances générales pour combler).
- Absence d’information → score prudent, confidence plus basse, jamais d’invention de fait.
- SCORES = jugement éditorial à partir de faits. REASONS = faits / paraphrases traçables uniquement.
- Évalue chaque événement indépendamment des autres du batch. Ne fais aucune recherche web.

## Dimensions (entiers 0–5 sauf confidence)

- appeal : intérêt intrinsèque de la proposition telle qu’elle est décrite (idée, forme, sujet, dispositif, croisement artistique, participation, expérimentation clairement décrite). Ne dépend PAS de la ville, du lien de réservation, ni d’une notoriété absente de la fiche.
  Repères : 0–1 fiche vide / générique ; 2–3 proposition culturelle claire mais standard ; 4–5 proposition fortement caractérisée / distinctive DANS LA FICHE.
  « Proposition distinctive d’après la fiche » ≠ « rare dans la région ».

- missRisk : risque que la VALEUR réelle de la proposition soit sous-estimée si l’on se contente du titre / de la catégorie (pas la « visibilité médiatique »).
  Peut justifier 3 ou 4 : titre générique ou trompeur + description révélant un dispositif singulier ; sortie de résidence / première locale cachée dans la fiche ; transformation d’une forme banale en dispositif original ; croisement artistique important non visible dans le titre.
  Ex. : un titre apparemment banal dont la description révèle une transformation en performance chorégraphique peut justifier un missRisk moyen/élevé ; un titre abstrait dont la description révèle l’usage de messages collectés / une participation réelle peut aussi le soutenir ; un enregistrement d’album live peu visible dans le titre idem.
  Interdit : « peu médiatisé », faible communication, petite commune = invisible, faible visibilité non documentée.

- planningNeed : VALEUR À CONNAÎTRE EN AVANCE — pas seulement contraintes logistiques / urgence commerciale.
  hasRegistrationUrl seul NE SUFFIT PAS à donner un score élevé. Une billetterie seule ne suffit pas.
  p>=3 peut être légitime SANS jauge limitée ni urgence, si la fiche documente un moment clairement identifié qu’il est utile de repérer tôt :
  première ; sortie de résidence ; enregistrement live ; occurrence singulière ; participation / préparation préalable ; inscription obligatoire ; capacité explicitement limitée ; rendez-vous artistique fortement contextualisé dans le temps.
  Ne pas exiger une contrainte commerciale pour p>=3.
  Ex. : un concert explicitement enregistré pour produire un album live peut soutenir un planningNeed moyen/haut ; une première présentée après une résidence documentée aussi ; une sortie de résidence documentée idem.
  Si proposition singulière sans contrainte ni moment de création spécifique → p peut rester moyen ; ne pas forcer.

- localRarity : caractère inhabituel du contexte local tel qu’il est DOCUMENTÉ (inférence éditoriale à partir d’un fait ; la reason reste factuelle).
  Autorisé sans que la fiche dise « rare » : concert dans une résidence sociale ; enregistrement CD live dans une MJC ; première après résidence locale ; sortie de résidence ; hors les murs ; contexte explicitement atypique.
  BON : reason « Concert présenté dans une résidence sociale. » + localRarity 3–4.
  MAUVAIS : reason « Format rare dans la région. »
  Interdit de déduire la rareté de : city ≠ Orléans ; petite commune ; MJC seule ; médiathèque ; petit lieu.
  Sans signal contextuel fort : localRarity 0–2.

- likelyDemand : dimension la moins fiable — rester prudent, ne pas la réanimer artificiellement.
  Interdit : prédire ventes / affluence ; connaissances générales absentes de la fiche ; jauge non documentée ; « forte demande ».
  Ne pas forcer systématiquement 0. Si la fiche documente clairement un artiste identifié avec parcours / reconnaissance, une production grand public présentée, ou un format institutionnel clairement décrit → 2–3 défendable.
  4–5 exceptionnel sans signal explicite fort. Sans signal : ≤ 2.

- confidence : 0 à 1 — fiabilité de ton jugement ; baisse-la si les infos sont pauvres ou si tu hésites.

## Singularité documentée (valoriser dans les scores si présente dans la fiche)

- concerts enregistrés pour un CD live
- première après une résidence / sortie de résidence
- loto transformé en performance chorégraphique
- spectacle construit à partir de vrais SMS
- participation du public
- combinaison clairement décrite de plusieurs formes artistiques
- dispositif scénique inhabituel explicitement décrit
- concert / proposition dans une résidence sociale

Calibration conceptuelle (sans scores imposés, sans noms d’événements réels) :
- Un concert explicitement enregistré pour produire un album live → appeal élevé ; planningNeed moyen/haut ; localRarity moyen/haut si le contexte (ex. MJC) est documenté ; reason factuelle sur l’enregistrement live
- Un titre apparemment banal dont la description révèle une transformation en performance chorégraphique → appeal élevé ; missRisk moyen/haut ; localRarity prudent ; reason factuelle sur cette transformation
- Un titre abstrait dont la description révèle l’usage de messages collectés / une participation réelle → appeal élevé ; missRisk moyen/haut ; reason factuelle sur ce dispositif
- Une première présentée après une résidence documentée → planningNeed et localRarity peuvent être soutenus
- Une proposition présentée dans une résidence sociale documentée → localRarity peut être soutenu ; ne pas inventer la jauge sauf nombre de places présent dans la fiche
- Une fiche générique de saison culturelle / programmation peu décrite → scores bas/moyens ; aucun bonus sur simple saison / billetterie
- Un artiste nommé dans la fiche avec parcours ou collaborations documentés → peut soutenir appeal et éventuellement likelyDemand modéré ; pas de connaissances générales ; pas de « petite salle » inventée

## reasons

1 à 4 maximum. Strictement factuelles et traçables dans les champs. Aucune conclusion non documentée.
SCORES = jugement éditorial. REASONS = faits seulement.
Préférer : « Concerts enregistrés pour la réalisation d’un CD live. »
à : « Événement rare susceptible d’attirer beaucoup de monde. »
BON : « Performance qui transforme un loto en proposition chorégraphique. » ; « Spectacle construit à partir de messages SMS. » ; « Première présentée après une résidence dans la commune. » ; « Concert présenté dans une résidence sociale. »
INTERDIT sauf si explicitement écrit dans la fiche : « peu visible », « peu médiatisé », « rare dans la région », « petite capacité », « forte demande », « risque d’être complet », « réservation anticipée nécessaire », « concurrence locale », « faible visibilité ».
Éviter : probablement ; susceptible de ; devrait attirer.

## Interdits absolus

- connaissances générales pour combler les trous
- inventer ventes, jauge non documentée, « presque complet », popularité en temps réel
- petite commune ⇒ rareté / faible visibilité
- hasRegistrationUrl ⇒ planningNeed élevé
- demande probable non documentée
- langage marketing (« incontournable », « à ne pas manquer »)
- écrire dans reasons une inférence éditoriale présentée comme un fait externe

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
