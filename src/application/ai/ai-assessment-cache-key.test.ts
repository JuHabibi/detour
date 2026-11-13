import { toAiHighlightEventInput } from "@/application/ai/highlight-assessment-input";
import { describe, expect, it } from "vitest";
import type { DetourEvent } from "@/domain/events/event";
import {
  AI_ASSESSMENT_DEFAULT_MODEL,
  AI_ASSESSMENT_DEFAULT_TEMPERATURE,
  AI_ASSESSMENT_PROMPT_VERSION,
} from "@/infrastructure/ai/openai-highlight-assessment.provider";
import { buildAiAssessmentEventCacheKey } from "@/application/ai/ai-assessment-cache-key";

function event(partial?: Partial<DetourEvent>): DetourEvent {
  return {
    id: "evt-1",
    title: "Concert test",
    description: "Une description",
    imageUrl: null,
    startAt: "2026-11-12T20:00:00+02:00",
    endAt: null,
    venue: "Salle",
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: "Spectacle",
    genre: null,
    conditions: null,
    source: "Agenda",
    sourceUrl: null,
    registrationUrl: "https://example.com/book",
    relevance: "culture",
    ...partial,
  };
}

const baseParams = {
  model: AI_ASSESSMENT_DEFAULT_MODEL,
  promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
  generation: { temperature: AI_ASSESSMENT_DEFAULT_TEMPERATURE },
};

describe("buildAiAssessmentEventCacheKey", () => {
  it("même event/config → même clé", () => {
    const a = buildAiAssessmentEventCacheKey({
      event: event(),
      ...baseParams,
    });
    const b = buildAiAssessmentEventCacheKey({
      event: event(),
      ...baseParams,
    });
    expect(a).toBe(b);
  });

  it("modification event → autre clé", () => {
    const base = buildAiAssessmentEventCacheKey({
      event: event(),
      ...baseParams,
    });
    const changedTitle = buildAiAssessmentEventCacheKey({
      event: event({ title: "Autre titre" }),
      ...baseParams,
    });
    const changedRegistration = buildAiAssessmentEventCacheKey({
      event: event({ registrationUrl: null }),
      ...baseParams,
    });
    expect(changedTitle).not.toBe(base);
    expect(changedRegistration).not.toBe(base);
  });

  it("changement model → autre clé", () => {
    const base = buildAiAssessmentEventCacheKey({
      event: event(),
      ...baseParams,
    });
    const other = buildAiAssessmentEventCacheKey({
      event: event(),
      ...baseParams,
      model: "gpt-4o",
    });
    expect(other).not.toBe(base);
  });

  it("changement promptVersion → autre clé", () => {
    const base = buildAiAssessmentEventCacheKey({
      event: event(),
      ...baseParams,
    });
    const other = buildAiAssessmentEventCacheKey({
      event: event(),
      ...baseParams,
      promptVersion: "detour-ai-assess-v999",
    });
    expect(other).not.toBe(base);
  });

  it("changement temperature (génération) → autre clé", () => {
    const base = buildAiAssessmentEventCacheKey({
      event: event(),
      ...baseParams,
    });
    const other = buildAiAssessmentEventCacheKey({
      event: event(),
      ...baseParams,
      generation: { temperature: 0 },
    });
    expect(other).not.toBe(base);
  });

  it("imageUrl hors input IA → ne change pas la clé", () => {
    const a = buildAiAssessmentEventCacheKey({
      event: event({ imageUrl: null }),
      ...baseParams,
    });
    const b = buildAiAssessmentEventCacheKey({
      event: event({ imageUrl: "https://cdn.example/img.jpg" }),
      ...baseParams,
    });
    expect(a).toBe(b);
  });
});


describe("identité des faits évalués", () => {
  const sourceDates = { startAt: "2026-11-01T19:00:00Z", endAt: null };
  const key = (input: DetourEvent) => buildAiAssessmentEventCacheKey({ event: input, ...baseParams });
  it("la même entrée alimente le fournisseur et le cache, indépendamment de la séance affichée", () => {
    const before = event({ sourceDates });
    const after = { ...before, startAt: "2026-11-20T19:00:00Z", endAt: "2026-11-20T21:00:00Z" };
    expect(toAiHighlightEventInput(after)).toEqual(toAiHighlightEventInput(before));
    expect(toAiHighlightEventInput(after)).toMatchObject(sourceDates);
    expect(key(after)).toBe(key(before));
  });
  it.each([
    { title: "Nouvelle création" }, { description: "Nouveau programme" },
    { category: "Musique" }, { genre: "Jazz" }, { conditions: "Gratuit" },
    { city: "Tours" }, { venue: "Autre salle" }, { source: "Autre agenda" },
    { registrationUrl: null }, { sourceDates: { ...sourceDates, startAt: "2026-12-01T19:00:00Z" } },
    { sourceDates: { ...sourceDates, endAt: "2026-12-01T21:00:00Z" } },
  ])("un changement éditorial invalide l'évaluation : %j", (change) => {
    const before = event({ sourceDates });
    expect(key({ ...before, ...change })).not.toBe(key(before));
  });
});
