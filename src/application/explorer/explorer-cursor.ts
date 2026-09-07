export type ExplorerCursorPayload = {
  startAt: string;
  id: string;
};

export class InvalidExplorerCursorError extends Error {
  constructor(message = "invalid explorer cursor") {
    super(message);
    this.name = "InvalidExplorerCursorError";
  }
}

/** Curseur opaque (base64url JSON) pour keyset (start_at, id). */
export function encodeExplorerCursor(payload: ExplorerCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeExplorerCursor(cursor: string): ExplorerCursorPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new InvalidExplorerCursorError();
  }

  if (
    !raw ||
    typeof raw !== "object" ||
    typeof (raw as ExplorerCursorPayload).startAt !== "string" ||
    typeof (raw as ExplorerCursorPayload).id !== "string" ||
    !(raw as ExplorerCursorPayload).startAt ||
    !(raw as ExplorerCursorPayload).id
  ) {
    throw new InvalidExplorerCursorError();
  }

  const startAt = (raw as ExplorerCursorPayload).startAt;
  if (Number.isNaN(Date.parse(startAt))) {
    throw new InvalidExplorerCursorError("invalid explorer cursor startAt");
  }

  return {
    startAt,
    id: (raw as ExplorerCursorPayload).id,
  };
}
