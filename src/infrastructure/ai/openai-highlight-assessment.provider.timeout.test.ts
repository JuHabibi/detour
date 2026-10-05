import { describe, expect, it, vi } from "vitest";
import {
  hangingFetch,
  headersThenHangingBody,
} from "@/infrastructure/http/http-timeout.test-helpers";
import { AI_HTTP_TIMEOUT_MS } from "@/infrastructure/http/http-timeout";
import { OpenAiHighlightAssessmentProvider } from "@/infrastructure/ai/openai-highlight-assessment.provider";
import type { DetourEvent } from "@/domain/events/event";

const SHORT_TIMEOUT_MS = 40;

function event(id: string): DetourEvent {
  return {
    id,
    title: "Titre",
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

describe("OpenAiHighlightAssessmentProvider HTTP timeout", () => {
  it("délai batch IA par défaut = 30s", () => {
    expect(AI_HTTP_TIMEOUT_MS).toBe(30_000);
  });

  it("requête bloquée → le provider rejette (fallback/cache hors scope)", async () => {
    const provider = new OpenAiHighlightAssessmentProvider({
      apiKey: "test-key",
      fetchImpl: hangingFetch as unknown as typeof fetch,
      httpTimeoutMs: SHORT_TIMEOUT_MS,
    });

    await expect(provider.assess([event("a")])).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });

  it("corps bloqué après headers → rejet timeout, pas « invalid JSON »", async () => {
    const provider = new OpenAiHighlightAssessmentProvider({
      apiKey: "test-key",
      fetchImpl: headersThenHangingBody as unknown as typeof fetch,
      httpTimeoutMs: SHORT_TIMEOUT_MS,
    });

    try {
      await provider.assess([event("a")]);
      expect.fail("expected timeout");
    } catch (error) {
      expect(error).toMatchObject({ name: "TimeoutError" });
      expect(String(error)).not.toMatch(/invalid JSON/i);
    }
  });

  it("passe un AbortSignal au fetch de batch", async () => {
    const fetchImpl = vi.fn(hangingFetch);
    const provider = new OpenAiHighlightAssessmentProvider({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      httpTimeoutMs: SHORT_TIMEOUT_MS,
    });

    await expect(provider.assess([event("a")])).rejects.toMatchObject({
      name: "TimeoutError",
    });
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
