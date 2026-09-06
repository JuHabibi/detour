import { timingSafeEqual } from "node:crypto";
import { runDetourEventSync } from "@/application/event-sync/run-detour-event-sync";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
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

/** GET cron Vercel Hobby — sync quotidienne Orleans puis Saran. */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const results = await runDetourEventSync();
    return Response.json({ results });
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
