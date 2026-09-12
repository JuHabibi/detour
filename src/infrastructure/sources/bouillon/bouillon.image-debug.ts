import { normalizeCandidate } from "./bouillon.title-candidates";

/** Titres Bouillon à tracer en priorité (diagnostic temporaire). */
export const BOUILLON_IMAGE_DEBUG_TITLES = [
  '"Jesus Christ Superstar" de Norman Jewison',
  '"Navalny" de Daniel Roher',
  "Apéro-concert avec Lucas Santtana",
  '"The Thing" de John Carpenter',
] as const;

export type BouillonImageDebugReason =
  | "no_candidate"
  | "no_exact_match"
  | "ambiguous_exact_match"
  | "invalid_p31"
  | "missing_p31"
  | "missing_p18"
  | "commons_lookup_failed"
  | "unsupported_license"
  | "missing_credit"
  | "accepted"
  | "lookup_error"
  | "all_candidates_rejected";

export type BouillonImageCandidateDebug = {
  candidate: string;
  normalized: string;
  searchResultCount: number;
  exactMatches: number;
  entityIds: string[];
  p31FilteredIds: string[];
  entityId: string | null;
  p31: string[];
  p31Accepted: boolean | null;
  p18: string | null;
  commonsFileTitle: string | null;
  commonsMetaOk: boolean | null;
  licenseRaw: string | null;
  licenseNormalized: string | null;
  creditFound: boolean | null;
  reason: BouillonImageDebugReason;
};

export type BouillonImageEventDebug = {
  title: string;
  candidates: string[];
  candidateTraces: BouillonImageCandidateDebug[];
  result: "wikimedia" | "fallback";
  reason: BouillonImageDebugReason;
  imageUrl: string | null;
};

/** Activé pour les titres ciblés hors test, ou pour tout Bouillon si BOUILLON_IMAGE_DEBUG=1. */
export function shouldDebugBouillonImage(title: string): boolean {
  if (process.env.BOUILLON_IMAGE_DEBUG === "1") return true;
  if (process.env.NODE_ENV === "test") return false;
  const needle = normalizeCandidate(title);
  return BOUILLON_IMAGE_DEBUG_TITLES.some(
    (target) => normalizeCandidate(target) === needle,
  );
}

export function emptyCandidateDebug(
  candidate: string,
): BouillonImageCandidateDebug {
  return {
    candidate,
    normalized: normalizeCandidate(candidate),
    searchResultCount: 0,
    exactMatches: 0,
    entityIds: [],
    p31FilteredIds: [],
    entityId: null,
    p31: [],
    p31Accepted: null,
    p18: null,
    commonsFileTitle: null,
    commonsMetaOk: null,
    licenseRaw: null,
    licenseNormalized: null,
    creditFound: null,
    reason: "no_exact_match",
  };
}

export function logBouillonImageDebug(event: BouillonImageEventDebug): void {
  const accepted = event.candidateTraces.find((t) => t.reason === "accepted");
  const primary =
    accepted ??
    event.candidateTraces[0] ??
    emptyCandidateDebug("(none)");

  const parts = [
    "[bouillon:image-debug]",
    `title=${JSON.stringify(event.title)}`,
    `candidates=${JSON.stringify(event.candidates)}`,
    `candidate=${JSON.stringify(primary.candidate)}`,
    `normalized=${JSON.stringify(primary.normalized)}`,
    `searchResultCount=${primary.searchResultCount}`,
    `exactMatches=${primary.exactMatches}`,
    `entityIds=${JSON.stringify(primary.entityIds)}`,
    `p31FilteredIds=${JSON.stringify(primary.p31FilteredIds)}`,
    `entityId=${JSON.stringify(primary.entityId)}`,
    `p31=${JSON.stringify(primary.p31)}`,
    `p31Accepted=${String(primary.p31Accepted)}`,
    `p18=${JSON.stringify(primary.p18)}`,
    `commonsFileTitle=${JSON.stringify(primary.commonsFileTitle)}`,
    `commonsMetaOk=${String(primary.commonsMetaOk)}`,
    `licenseRaw=${JSON.stringify(primary.licenseRaw)}`,
    `license=${JSON.stringify(primary.licenseNormalized)}`,
    `creditFound=${String(primary.creditFound)}`,
    `reason=${JSON.stringify(event.reason)}`,
    `result=${JSON.stringify(event.result)}`,
  ];

  console.info(parts.join(" "));

  for (const trace of event.candidateTraces) {
    if (trace === primary) continue;
    console.info(
      [
        "[bouillon:image-debug:candidate]",
        `title=${JSON.stringify(event.title)}`,
        `candidate=${JSON.stringify(trace.candidate)}`,
        `exactMatches=${trace.exactMatches}`,
        `entityId=${JSON.stringify(trace.entityId)}`,
        `p31=${JSON.stringify(trace.p31)}`,
        `p31Accepted=${String(trace.p31Accepted)}`,
        `p18=${JSON.stringify(trace.p18)}`,
        `license=${JSON.stringify(trace.licenseNormalized)}`,
        `reason=${JSON.stringify(trace.reason)}`,
      ].join(" "),
    );
  }
}
