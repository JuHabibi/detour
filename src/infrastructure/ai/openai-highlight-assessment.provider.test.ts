import {
  assessHighlightsCached,
  createMemoryAiAssessmentCacheStore,
} from "@/application/ai/ai-assessment-cache";
import { selectEventInWindow } from "@/domain/events/event-schedule";
import { selectPlanningEvents } from "@/domain/editorial/select-planning-events";
import type { AiHighlightAssessment } from "@/domain/editorial/highlight-assessment";
import { toAiHighlightEventInput } from "@/application/ai/highlight-assessment-input";
import { describe, expect, it, vi } from "vitest";
import {
  AI_ASSESSMENT_PROMPT_VERSION,
  OPENAI_HIGHLIGHT_SYSTEM_PROMPT,
  OpenAiHighlightAssessmentProvider,
} from "@/infrastructure/ai/openai-highlight-assessment.provider";
import type { DetourEvent } from "@/domain/events/event";

function event(id: string, title = "Titre"): DetourEvent {
  return {
    id,
    title,
    description: null,
    imageUrl: null,
    startAt: "2026-09-12T20:00:00+02:00",
    endAt: null,
    venue: null,
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: "Spectacle",
    genre: null,
    conditions: null,
    source: null,
    sourceUrl: null,
    registrationUrl: null,
    relevance: "culture",
  };
}

describe("AI assessment prompt V3.1", () => {
  it("versionne detour-ai-assess-v3.1", () => {
    expect(AI_ASSESSMENT_PROMPT_VERSION).toBe("detour-ai-assess-v3.1");
  });

  it("schéma JSON inchangé (dimensions + assessments)", () => {
    expect(OPENAI_HIGHLIGHT_SYSTEM_PROMPT).toContain('"appeal":0');
    expect(OPENAI_HIGHLIGHT_SYSTEM_PROMPT).toContain('"missRisk":0');
    expect(OPENAI_HIGHLIGHT_SYSTEM_PROMPT).toContain('"planningNeed":0');
    expect(OPENAI_HIGHLIGHT_SYSTEM_PROMPT).toContain('"localRarity":0');
    expect(OPENAI_HIGHLIGHT_SYSTEM_PROMPT).toContain('"likelyDemand":0');
    expect(OPENAI_HIGHLIGHT_SYSTEM_PROMPT).toContain('"confidence":0');
    expect(OPENAI_HIGHLIGHT_SYSTEM_PROMPT).toContain('"reasons":');
    expect(OPENAI_HIGHLIGHT_SYSTEM_PROMPT).toContain('"assessments"');
    expect(OPENAI_HIGHLIGHT_SYSTEM_PROMPT).not.toContain("discoveryValue");
  });

  it("interdit les extrapolations non documentées (garde-fous V3)", () => {
    const prompt = OPENAI_HIGHLIGHT_SYSTEM_PROMPT;
    expect(prompt).toMatch(/connaissances générales pour combler/i);
    expect(prompt).toMatch(/petite commune/i);
    expect(prompt).toMatch(/faible visibilité non documentée/i);
    expect(prompt).toMatch(/jauge non documentée/i);
    expect(prompt).toContain("hasRegistrationUrl");
    expect(prompt).toMatch(/hasRegistrationUrl.*NE SUFFIT PAS/i);
    expect(prompt).toContain("hasRegistrationUrl ⇒ planningNeed élevé");
    expect(prompt).toMatch(/demande probable non documentée/i);
    expect(prompt).not.toMatch(
      /Tu peux utiliser tes connaissances générales d’entraînement/i,
    );
    expect(prompt).toMatch(/reasons restent|REASONS = faits|Strictement factuelles/i);
  });

  it("autorise l’inférence éditoriale des scores à partir des faits", () => {
    const prompt = OPENAI_HIGHLIGHT_SYSTEM_PROMPT;
    expect(prompt).toMatch(/JUGEMENT ÉDITORIAL/i);
    expect(prompt).toMatch(/inférer un jugement|inférence éditoriale/i);
    expect(prompt).toMatch(/SCORES = jugement éditorial/i);
    expect(prompt).toMatch(/Ne pas exiger une contrainte commerciale pour p>=3/i);
    expect(prompt).toMatch(/sous-estimée si l’on se contente du titre/i);
  });

  it("valorise la singularité documentée", () => {
    const prompt = OPENAI_HIGHLIGHT_SYSTEM_PROMPT;
    expect(prompt).toMatch(/singularité documentée/i);
    expect(prompt).toMatch(/sortie de résidence/i);
    expect(prompt).toMatch(/enregistrement live|CD live|album live/i);
    expect(prompt).toMatch(/participation du public|participation réelle/i);
    expect(prompt).toMatch(/première/i);
    expect(prompt).toMatch(/résidence sociale/i);
  });

  it("ne contient aucun nom d’événement de calibration / golden set", () => {
    const prompt = OPENAI_HIGHLIGHT_SYSTEM_PROMPT;
    const forbidden = [
      "Duo Zéphyr",
      "Loto 3000",
      "Short Message Service",
      "Hadrien",
      "Floréales",
      "Odyssée",
      "Fapy",
      "À dos de chameau",
      "CANAILLE",
      "Bourgeois",
      "NACH",
      "Portés de femmes",
    ];
    for (const name of forbidden) {
      expect(prompt, `fuite benchmark: ${name}`).not.toContain(name);
    }
  });
});

describe("OpenAiHighlightAssessmentProvider", () => {
  it("erreur réseau / provider → throw (à catcher côté service)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const provider = new OpenAiHighlightAssessmentProvider({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(provider.assess([event("a")])).rejects.toThrow("network down");
  });

  it("réponse HTTP d’erreur → throw", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom",
    });
    const provider = new OpenAiHighlightAssessmentProvider({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(provider.assess([event("a")])).rejects.toThrow(/500/);
  });

  it("parse le contenu JSON d’un batch réussi + envoie le prompt V3", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                assessments: [
                  {
                    eventId: "a",
                    appeal: 4,
                    missRisk: 3,
                    planningNeed: 5,
                    localRarity: 2,
                    likelyDemand: 4,
                    confidence: 0.7,
                    reasons: ["Concerts enregistrés pour un CD live."],
                  },
                ],
              }),
            },
          },
        ],
      }),
    });

    const provider = new OpenAiHighlightAssessmentProvider({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      batchSize: 10,
    });

    const displayed = {
      ...event("a"),
      sourceDates: { startAt: "2026-09-01T18:00:00.000Z", endAt: null },
    };
    const result = await provider.assess([displayed]);
    expect(result).toHaveLength(1);
    expect(result[0]?.appeal).toBe(4);
    expect(result[0]?.localRarity).toBe(2);
    expect(result[0]?.likelyDemand).toBe(4);
    expect(provider.cacheContext.promptVersion).toBe("detour-ai-assess-v3.1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const body = JSON.parse(
      (fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(JSON.parse(body.messages[1].content).events[0]).toEqual(toAiHighlightEventInput(displayed));
    expect(JSON.parse(body.messages[1].content).events[0].startAt).not.toBe(displayed.startAt);
    expect(body.messages[0].content).toBe(OPENAI_HIGHLIGHT_SYSTEM_PROMPT);
    expect(body.messages[0].content).toContain("localRarity");
    expect(body.messages[0].content).toContain("missRisk");
    expect(body.messages[0].content).toContain("JUGEMENT ÉDITORIAL");
    expect(body.messages[0].content).not.toContain("discoveryValue");
  });
});


describe("récurrence — première séance passée et valeur d'anticipation", () => {
  it("garde les faits IA stables et applique le délai Planning à la séance future", async () => {
    const past = {
      startAt: "2026-10-03T18:00:00.000Z",
      endAt: "2026-10-03T20:00:00.000Z",
      allDay: false,
    };
    const upcoming = {
      startAt: "2026-11-14T18:00:00.000Z",
      endAt: "2026-11-14T20:00:00.000Z",
      allDay: false,
    };
    const following = {
      startAt: "2026-12-20T18:00:00.000Z",
      endAt: "2026-12-20T20:00:00.000Z",
      allDay: false,
    };
    const recurring: DetourEvent = {
      ...event("recurring", "Ateliers de création sonore"),
      description: "Ateliers indépendants proposés à plusieurs dates. Chaque participant prépare un enregistrement sonore avant la séance choisie.",
      conditions: "Inscription obligatoire pour chaque atelier.",
      ...past,
      sourceDates: { startAt: past.startAt, endAt: past.endAt },
      occurrences: [past, upcoming, following],
    };
    // Réponse de contrat simulée, pas une mesure du comportement du modèle réel.
    // La préparation concerne chaque atelier, pas uniquement la première séance.
    const assessment: AiHighlightAssessment = {
      eventId: recurring.id, appeal: 4, missRisk: 3, planningNeed: 4,
      localRarity: 1, likelyDemand: 1, confidence: 0.8,
      reasons: ["Préparation d'un enregistrement avant chaque atelier et inscription obligatoire."],
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: {
        content: JSON.stringify({ assessments: [assessment] }),
      } }] }),
    });
    const provider = new OpenAiHighlightAssessmentProvider({
      apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    let cacheNow = new Date("2026-11-13T12:00:00Z");
    const store = createMemoryAiAssessmentCacheStore(() => cacheNow.getTime());
    const evaluate = (displayed: DetourEvent) => assessHighlightsCached({
      events: [displayed], store, cacheContext: provider.cacheContext, now: () => cacheNow,
      assess: (batch) => provider.assess(batch),
    });
    const project = (now: Date) => {
      const selected = selectEventInWindow(recurring, { from: now, now });
      expect(selected).not.toBeNull();
      return selected!;
    };

    const now = new Date("2026-11-13T12:00:00Z");
    const displayed = project(now);
    const first = await evaluate(displayed);
    expect(Date.parse(recurring.sourceDates!.endAt!)).toBeLessThan(now.getTime());
    expect(displayed.startAt).toBe(upcoming.startAt);

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(body.messages[0].content).toBe(OPENAI_HIGHLIGHT_SYSTEM_PROMPT);
    expect(JSON.parse(body.messages[1].content)).toEqual({
      events: [toAiHighlightEventInput(recurring)],
    });
    expect(provider.cacheContext.promptVersion).toBe("detour-ai-assess-v3.1");
    // La séance de demain n'appartient pas au bloc À prévoir (> 30 jours),
    // même si la valeur éditoriale d'anticipation vaut 4.
    expect(selectPlanningEvents({
      events: [displayed], aiAssessments: first.assessments, now,
    })).toEqual([]);

    // Deux jours plus tard, la prochaine séance est celle de décembre (> 30j).
    // Le cache n'a pas expiré (TTL 7j) et la fiche évaluée n'a pas changé.
    const later = new Date("2026-11-15T12:00:00Z");
    cacheNow = later;
    const nextEvent = project(later);
    const next = await evaluate(nextEvent);
    expect(next.assessments).toEqual(first.assessments);
    expect(next).toMatchObject({ cacheHits: 1, cacheMisses: 0 });
    const plan = selectPlanningEvents({
      events: [nextEvent], aiAssessments: next.assessments, now: later,
    });
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      event: { id: recurring.id, startAt: following.startAt },
      planningValue: 4, selectionSource: "ai",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Le seuil temporel reste indépendant de cette même évaluation.
    const closer = new Date("2026-11-21T12:00:00Z");
    expect(selectPlanningEvents({
      events: [project(closer)], aiAssessments: next.assessments, now: closer,
    })).toEqual([]);
    expect(selectEventInWindow(recurring, {
      from: new Date(following.endAt), now: new Date(following.endAt),
    })).toBeNull();
  });
});
