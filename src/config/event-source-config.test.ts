import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDetourEventSourceMode } from "@/config/event-source-config";

describe("resolveDetourEventSourceMode", () => {
  afterEach(() => {
    delete process.env.DETOUR_EVENT_SOURCE;
  });

  it("absent / vide => live", () => {
    expect(resolveDetourEventSourceMode({})).toBe("live");
    expect(resolveDetourEventSourceMode({ DETOUR_EVENT_SOURCE: "" })).toBe(
      "live",
    );
    expect(resolveDetourEventSourceMode({ DETOUR_EVENT_SOURCE: "  " })).toBe(
      "live",
    );
  });

  it("live => live", () => {
    expect(
      resolveDetourEventSourceMode({ DETOUR_EVENT_SOURCE: "live" }),
    ).toBe("live");
  });

  it("database => database", () => {
    expect(
      resolveDetourEventSourceMode({ DETOUR_EVENT_SOURCE: "database" }),
    ).toBe("database");
  });

  it("valeur invalide => erreur explicite", () => {
    expect(() =>
      resolveDetourEventSourceMode({ DETOUR_EVENT_SOURCE: "db" }),
    ).toThrow(/Invalid DETOUR_EVENT_SOURCE/);
    expect(() =>
      resolveDetourEventSourceMode({ DETOUR_EVENT_SOURCE: "Live" }),
    ).toThrow(/Invalid DETOUR_EVENT_SOURCE/);
  });
});
