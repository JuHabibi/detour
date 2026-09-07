import { timingSafeEqual } from "node:crypto";
import { runDetourAvailabilityEnrichment } from "@/application/availability/run-detour-availability-enrichment";
import { runDetourEventSync } from "@/application/event-sync/run-detour-event-sync";

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

/** POST interne — sync sources puis enrichissement disponibilité (best-effort). */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const results = await runDetourEventSync();

    let availability: unknown = null;
    let availabilityError: string | null = null;
    try {
      availability = await runDetourAvailabilityEnrichment();
    } catch (error) {
      availabilityError =
        error instanceof Error ? error.message : "availability_enrichment_failed";
    }

    return Response.json({ results, availability, availabilityError });
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
