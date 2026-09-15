import { timingSafeEqual } from "node:crypto";
import { invalidatePublicHomeCache } from "@/infrastructure/next-public-home-cache";

export const runtime = "nodejs";

/**
 * Diagnostic temporaire — invalide uniquement le Data Cache PublicHome.
 * Ne sync pas, ne touche pas aux events, ne touche pas au cache IA.
 */
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

/** POST interne diagnostic — invalidatePublicHomeCache uniquement. */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  invalidatePublicHomeCache();

  return Response.json({
    ok: true,
    invalidated: "public-home-cache",
    note: "diagnostic_only_no_sync_no_ai_cache",
  });
}
