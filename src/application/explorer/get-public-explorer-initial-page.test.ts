import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listExplorerEvents = vi.fn();
const mapDetourEventToEventItem = vi.fn((event: { id: string }) => ({
  id: event.id,
  mapped: true,
}));

vi.mock("@/application/explorer/list-explorer-events", () => ({
  listExplorerEvents: (...args: unknown[]) => listExplorerEvents(...args),
}));

vi.mock("@/application/map-detour-event-to-ui", () => ({
  mapDetourEventToEventItem: (event: { id: string }) =>
    mapDetourEventToEventItem(event),
}));

describe("getPublicExplorerInitialPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("source : listExplorerEvents seul — pas de pipeline Radar / IA", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/application/explorer/get-public-explorer-initial-page.ts",
      ),
      "utf8",
    );
    expect(source).toContain("listExplorerEvents");
    expect(source).not.toContain("buildUpcomingPipeline");
    expect(source).not.toContain("finalizeUpcomingWithAutoAi");
    expect(source).not.toMatch(/from ["']@\/application\/event\.service/);
    expect(source).not.toMatch(/getAccountAuthState|favorite/);
  });

  it("filtre initial weekend + limit 12 ; totalCount numérique requis", async () => {
    listExplorerEvents.mockResolvedValue({
      events: [{ id: "a" }, { id: "b" }],
      totalCount: 42,
      nextCursor: "c1",
    });

    const {
      getPublicExplorerInitialPage,
      PUBLIC_EXPLORER_INITIAL_LIMIT,
      PUBLIC_EXPLORER_INITIAL_WHEN,
    } = await import("@/application/explorer/get-public-explorer-initial-page");

    expect(PUBLIC_EXPLORER_INITIAL_WHEN).toBe("weekend");
    expect(PUBLIC_EXPLORER_INITIAL_LIMIT).toBe(12);

    const page = await getPublicExplorerInitialPage();

    expect(listExplorerEvents).toHaveBeenCalledWith({
      when: "weekend",
      limit: 12,
    });
    expect(page).toEqual({
      events: [
        { id: "a", mapped: true },
        { id: "b", mapped: true },
      ],
      totalCount: 42,
      nextCursor: "c1",
    });
  });

  it("refuse un totalCount absent (ne le transforme pas en zéro)", async () => {
    listExplorerEvents.mockResolvedValue({
      events: [{ id: "a" }],
      totalCount: null,
      nextCursor: null,
    });

    const { getPublicExplorerInitialPage } = await import(
      "@/application/explorer/get-public-explorer-initial-page"
    );

    await expect(getPublicExplorerInitialPage()).rejects.toThrow(
      /numeric totalCount/,
    );
  });
});
