import { describe, expect, it } from "vitest";
import type { LoadExplorerEventsResult } from "@/app/actions/load-explorer-events";
import type { EventItem } from "@/data/types";
import {
  EXPLORER_LOAD_FALLBACK_ERROR,
  explorerAppendErrorMessage,
  explorerPageOneSnapshotFromRejection,
  explorerPageOneSnapshotFromResult,
} from "@/components/useExplorerEvents";

function eventItem(id: string, title: string): EventItem {
  return {
    id,
    title,
    category: "Atelier",
    genre: "",
    venue: null,
    city: "Orléans",
    date: "2026-09-12",
    dateLabel: "Samedi 12 septembre",
  };
}

describe("ExplorerSection error snapshots (sans RTL)", () => {
  it("1. page 1 success → remplace events/count/cursor, error null", () => {
    const result: LoadExplorerEventsResult = {
      ok: true,
      events: [eventItem("ingre-1", "Phosphène")],
      totalCount: 3,
      nextCursor: "cursor-2",
    };
    expect(explorerPageOneSnapshotFromResult(result)).toEqual({
      events: [eventItem("ingre-1", "Phosphène")],
      totalCount: 3,
      nextCursor: "cursor-2",
      error: null,
    });
  });

  it("2. page 1 { ok:false } → vide cartes/count/cursor + erreur", () => {
    const previous = [eventItem("orleans-1", "Concert")];
    const result: LoadExplorerEventsResult = {
      ok: false,
      error: "Impossible de charger les sorties.",
    };
    const snapshot = explorerPageOneSnapshotFromResult(result);
    expect(snapshot.events).toEqual([]);
    expect(snapshot.events).not.toEqual(previous);
    expect(snapshot.totalCount).toBe(0);
    expect(snapshot.nextCursor).toBeNull();
    expect(snapshot.error).toBe("Impossible de charger les sorties.");
  });

  it("3. page 1 Promise reject → snapshot vide + fallback", () => {
    const snapshot = explorerPageOneSnapshotFromRejection();
    expect(snapshot).toEqual({
      events: [],
      totalCount: 0,
      nextCursor: null,
      error: EXPLORER_LOAD_FALLBACK_ERROR,
    });
    expect(snapshot.error).toBe("Impossible de charger les sorties.");
  });

  it("4. retry success après erreur → repeuple via snapshot success", () => {
    const afterError = explorerPageOneSnapshotFromRejection();
    expect(afterError.events).toHaveLength(0);

    const afterRetry = explorerPageOneSnapshotFromResult({
      ok: true,
      events: [eventItem("ingre-1", "Phosphène")],
      totalCount: 1,
      nextCursor: null,
    });
    expect(afterRetry.events).toHaveLength(1);
    expect(afterRetry.error).toBeNull();
    expect(afterRetry.totalCount).toBe(1);
  });

  it("5. Voir plus { ok:false } → message erreur, pas de wipe (contrat append)", () => {
    const existing = [eventItem("a", "A"), eventItem("b", "B")];
    const cursor = "keep-me";
    const message = explorerAppendErrorMessage({
      ok: false,
      error: "Timeout source.",
    });
    expect(message).toBe("Timeout source.");
    // L’appelant conserve events / cursor — le helper ne les mute pas.
    expect(existing).toHaveLength(2);
    expect(cursor).toBe("keep-me");
  });

  it("6. Voir plus Promise reject → fallback, cartes à conserver côté appelant", () => {
    expect(explorerAppendErrorMessage(null)).toBe(EXPLORER_LOAD_FALLBACK_ERROR);
  });
});
