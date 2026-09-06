import { timingSafeEqual } from "node:crypto";
import { syncEventSources } from "@/application/event-sync/sync-event-sources";
import { createDetourSyncSources } from "@/infrastructure/create-detour-sync-sources";

export const runtime = "nodejs";

const UPCOMING_WINDOW_DAYS = 180;

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

/** POST interne — déclenche Orleans puis Saran vers PostgreSQL. */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const from = now;
    const to = new Date(now);
    to.setDate(to.getDate() + UPCOMING_WINDOW_DAYS);

    const results = await syncEventSources({
      sources: createDetourSyncSources(),
      from,
      to,
    });

    return Response.json({ results });
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
