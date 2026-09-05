import { describe, expect, it } from "vitest";
import type { DetourEvent } from "@/domain/event";
import {
  AI_ASSESSMENT_DEFAULT_MODEL,
  AI_ASSESSMENT_DEFAULT_TEMPERATURE,
  AI_ASSESSMENT_PROMPT_VERSION,
} from "@/infrastructure/ai/openai-highlight-assessment.provider";
import { buildAiAssessmentEventCacheKey } from "@/infrastructure/ai/ai-assessment-cache-key";

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
