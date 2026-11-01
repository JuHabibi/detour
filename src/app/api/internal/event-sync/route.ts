import { timingSafeEqual } from "node:crypto";
import { buildEventSyncResponse } from "@/application/event-sync/build-event-sync-response";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.EVENT_SYNC_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (!header) return false;

  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;

  const presented = match[1]!;
  const expected = Buffer.from(secret, "utf8");
  const actual = Buffer.from(presented, "utf8");
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}

/**
 * POST interne — sync sources puis enrichissement disponibilité (best-effort).
 * Même contrat HTTP que le cron : 503 si au moins une source en erreur.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return buildEventSyncResponse();
}
