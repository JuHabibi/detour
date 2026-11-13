import { createHash } from "node:crypto";
import { toAiHighlightEventInput } from "@/application/ai/highlight-assessment-input";
import type { UpcomingEventsResult } from "@/application/event.service";
import type { PublicHomeSnapshot } from "@/application/home/get-public-home-data";

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Temporaire, opt-in, expiration obligatoire ; aucune donnée de visiteur. */
export function logRadarDiagnostics(
  snapshot: PublicHomeSnapshot,
  result: Pick<UpcomingEventsResult, "events" | "aiShortlist" | "highlights" | "planningEvents" | "aiAssessments" | "aiMeta">,
  now: Date,
): void {
  const until = Date.parse(process.env.DETOUR_RADAR_DIAGNOSTICS_UNTIL ?? "");
  const wallClock = Date.now();
  if (
    !Number.isFinite(until) || until <= wallClock ||
    until - wallClock > 24 * 60 * 60 * 1000
  ) return;

  const before = new Map(snapshot.events.map((event) => [event.id, event]));
  const currentIds = new Set(result.events.map((event) => event.id));
  const changed = result.events.filter((event) => {
    const previous = before.get(event.id);
    return previous && (
      previous.startAt !== event.startAt || previous.endAt !== event.endAt ||
      Boolean(previous.allDay) !== Boolean(event.allDay)
    );
  });
  const assessedIds = new Set(result.aiAssessments.map((item) => item.eventId));
  const covered = result.aiShortlist.filter((item) => assessedIds.has(item.event.id)).length;
  const publicId = (id: string) => id.slice(0, 128);

  // Une ligne par matérialisation serveur (pas par vue de la page ISR).
  // IDs publics plafonnés ; ni titre, description, prompt, reasons, URL ou cookies.
  console.info("[detour:radar-diagnostic]", JSON.stringify({
    schema: 1,
    deployment: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 64),
    businessNow: now.toISOString(),
    snapshotFingerprint: fingerprint(snapshot),
    assessmentInputFingerprint: fingerprint(result.aiShortlist.map((item) => toAiHighlightEventInput(item.event))),
    assessmentFingerprint: fingerprint([...result.aiAssessments].sort((a, b) => a.eventId.localeCompare(b.eventId))),
    projectionFingerprint: fingerprint(result.events.map((event) => [event.id, event.startAt, event.endAt, event.allDay, event.availabilityStatus])),
    snapshotCount: snapshot.events.length,
    eligibleCount: result.aiShortlist.length,
    assessedCount: covered,
    missingCount: result.aiShortlist.length - covered,
    cacheSource: result.aiMeta.source,
    cacheHits: result.aiMeta.cacheHits,
    cacheMisses: result.aiMeta.cacheMisses,
    changedSessionCount: changed.length,
    changedSessionIds: changed.slice(0, 20).map((event) => publicId(event.id)),
    removedCount: snapshot.events.filter((event) => !currentIds.has(event.id)).length,
    finalIds: result.highlights.slice(0, 10).map((item) => publicId(item.event.id)),
    planningIds: result.planningEvents.slice(0, 10).map((item) => publicId(item.event.id)),
  }));
}
