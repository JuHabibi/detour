import { describe, expect, it } from "vitest";
import {
  decodeExplorerCursor,
  encodeExplorerCursor,
  InvalidExplorerCursorError,
} from "@/application/explorer/explorer-cursor";

describe("explorer-cursor", () => {
  it("encode/decode round-trip opaque", () => {
    const payload = {
      startAt: "2026-11-01T20:00:00.000Z",
      id: "openagenda:42",
    };
    const cursor = encodeExplorerCursor(payload);
    expect(cursor).not.toContain("openagenda");
    expect(cursor).not.toContain("2026");
    expect(decodeExplorerCursor(cursor)).toEqual(payload);
  });

  it("rejette un curseur invalide", () => {
    expect(() => decodeExplorerCursor("not-a-cursor")).toThrow(
      InvalidExplorerCursorError,
    );
    expect(() =>
      decodeExplorerCursor(
        Buffer.from(JSON.stringify({ startAt: "bad", id: "x" }), "utf8").toString(
          "base64url",
        ),
      ),
    ).toThrow(InvalidExplorerCursorError);
  });
});
