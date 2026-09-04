import type { DetourEvent } from "@/domain/event";

export type EventDuplicate = {
  keptId: string;
  duplicateId: string;
  reason: string;
};

export type DeduplicateEventsResult = {
  events: DetourEvent[];
  duplicates: EventDuplicate[];
};

/**
 * Déduplication conservatrice : uniquement les doublons à forte confiance.
 * En cas de doute, les deux événements sont conservés.
 */
export function deduplicateEvents(
  events: DetourEvent[],
): DeduplicateEventsResult {
  if (events.length < 2) {
    return { events: [...events], duplicates: [] };
  }

  const parent = new Map<string, string>();
  const pairReason = new Map<string, string>();

  for (const event of events) {
    parent.set(event.id, event.id);
  }

  for (let i = 0; i < events.length; i += 1) {
    for (let j = i + 1; j < events.length; j += 1) {
      const left = events[i];
      const right = events[j];
      const reason = detectDuplicateReason(left, right);
      if (!reason) continue;

      union(parent, left.id, right.id);
      pairReason.set(pairKey(left.id, right.id), reason);
    }
  }

  const clusters = new Map<string, DetourEvent[]>();
  for (const event of events) {
    const root = find(parent, event.id);
    const cluster = clusters.get(root) ?? [];
    cluster.push(event);
    clusters.set(root, cluster);
  }

  const kept: DetourEvent[] = [];
  const duplicates: EventDuplicate[] = [];

  for (const cluster of clusters.values()) {
    if (cluster.length === 1) {
      kept.push(cluster[0]);
      continue;
    }

    const winner = pickRichest(cluster);
    kept.push(winner);

    for (const event of cluster) {
      if (event.id === winner.id) continue;
      duplicates.push({
        keptId: winner.id,
        duplicateId: event.id,
        reason:
          pairReason.get(pairKey(winner.id, event.id)) ??
          findReasonViaCluster(winner.id, event.id, cluster, pairReason) ??
          "same-time-place-similar-title",
      });
    }
  }

  // Conserve l’ordre chronologique d’origine.
  kept.sort(
    (a, b) =>
      new Date(a.startAt).getTime() - new Date(b.startAt).getTime() ||
      a.id.localeCompare(b.id),
  );

  return { events: kept, duplicates };
}

function detectDuplicateReason(
  left: DetourEvent,
  right: DetourEvent,
): string | null {
  if (isSameRegistrationUrlDuplicate(left, right)) {
    return "same-registration-url";
  }
  if (isSameTimePlaceSimilarTitleDuplicate(left, right)) {
    return "same-time-place-similar-title";
  }
  return null;
}

function isSameRegistrationUrlDuplicate(
  left: DetourEvent,
  right: DetourEvent,
): boolean {
  if (!left.registrationUrl || !right.registrationUrl) return false;
  if (normalizeUrl(left.registrationUrl) !== normalizeUrl(right.registrationUrl)) {
    return false;
  }
  if (!isSameDateTime(left.startAt, right.startAt)) return false;
  // L’URL seule ne suffit jamais : il faut aussi un titre très proche.
  return titlesAreEditorialVariants(left.title, right.title);
}

function isSameTimePlaceSimilarTitleDuplicate(
  left: DetourEvent,
  right: DetourEvent,
): boolean {
  if (!isSameDateTime(left.startAt, right.startAt)) return false;

  const leftCity = normalizeText(left.city);
  const rightCity = normalizeText(right.city);
  if (!leftCity || !rightCity || leftCity !== rightCity) return false;

  const leftVenue = normalizeText(left.venue);
  const rightVenue = normalizeText(right.venue);
  if (!leftVenue || !rightVenue || leftVenue !== rightVenue) return false;

  return titlesAreEditorialVariants(left.title, right.title);
}

/**
 * Variante éditoriale du même événement (année, préfixe soft),
 * pas un sous-événement distinct (visite, atelier, etc.).
 */
function titlesAreEditorialVariants(
  leftTitle: string,
  rightTitle: string,
): boolean {
  const left = normalizeText(leftTitle);
  const right = normalizeText(rightTitle);
  if (!left || !right) return false;
  if (left === right) return true;

  if (looksLikeDistinctSubEvent(left, right)) return false;

  const [shorter, longer] =
    left.length <= right.length ? [left, right] : [right, left];

  // Longueur significative pour éviter les faux positifs ("jazz", "expo"…).
  if (shorter.length < 8) return false;
  if (!longer.includes(shorter)) return false;

  const remainder = longer.replace(shorter, " ").replace(/\s+/g, " ").trim();
  return isEditorialRemainder(remainder);
}

/** Préfixes explicites d’activité / sous-événement distinct. */
const SUB_EVENT_SIGNALS = [
  "visites flash",
  "visite flash",
  "visites",
  "visite",
  "atelier",
  "conference",
  "rencontre",
  "projection",
] as const;

function looksLikeDistinctSubEvent(left: string, right: string): boolean {
  const leftSignal = detectSubEventSignal(left);
  const rightSignal = detectSubEventSignal(right);

  if (leftSignal && !rightSignal) return true;
  if (rightSignal && !leftSignal) return true;
  if (leftSignal && rightSignal && leftSignal !== rightSignal) return true;
  return false;
}

function detectSubEventSignal(title: string): string | null {
  for (const signal of SUB_EVENT_SIGNALS) {
    if (
      title === signal ||
      title.startsWith(`${signal} `) ||
      title.startsWith(`${signal}/`) ||
      title.includes(` ${signal} `) ||
      title.includes(`/${signal} `) ||
      title.includes(` ${signal}/`)
    ) {
      return signal;
    }
  }
  return null;
}

/** Le surplus de titre ressemble à une variante éditoriale, pas à une autre activité. */
function isEditorialRemainder(remainder: string): boolean {
  if (!remainder) return true;
  if (/^(19|20)\d{2}$/.test(remainder)) return true;

  for (const signal of SUB_EVENT_SIGNALS) {
    if (
      remainder === signal ||
      remainder.startsWith(`${signal} `) ||
      remainder.includes(` ${signal}`)
    ) {
      return false;
    }
  }

  const words = remainder.split(" ").filter(Boolean);
  // Préfixe court du type "culture jazz" / année seule.
  return words.length <= 3 && remainder.length <= 24;
}

function pickRichest(events: DetourEvent[]): DetourEvent {
  return events.reduce((best, current) =>
    completenessScore(current) > completenessScore(best) ? current : best,
  );
}

function completenessScore(event: DetourEvent): number {
  let score = 0;
  if (event.registrationUrl) score += 1;
  if (event.imageUrl) score += 1;
  if (event.description) score += 1;
  if (event.conditions) score += 1;
  if (event.venue) score += 1;
  if (event.category) score += 1;
  return score;
}

function isSameDateTime(leftStartAt: string, rightStartAt: string): boolean {
  return toMinuteKey(leftStartAt) === toMinuteKey(rightStartAt);
}

function toMinuteKey(startAt: string): string {
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) return startAt;
  return date.toISOString().slice(0, 16);
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

/** Normalisation légère titre / lieu / ville. */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function find(parent: Map<string, string>, id: string): string {
  const current = parent.get(id) ?? id;
  if (current === id) return id;
  const root = find(parent, current);
  parent.set(id, root);
  return root;
}

function union(parent: Map<string, string>, a: string, b: string): void {
  const rootA = find(parent, a);
  const rootB = find(parent, b);
  if (rootA !== rootB) parent.set(rootB, rootA);
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function findReasonViaCluster(
  keptId: string,
  duplicateId: string,
  cluster: DetourEvent[],
  pairReason: Map<string, string>,
): string | null {
  for (const event of cluster) {
    if (event.id === keptId || event.id === duplicateId) continue;
    const viaKept = pairReason.get(pairKey(keptId, event.id));
    const viaDup = pairReason.get(pairKey(duplicateId, event.id));
    if (viaKept) return viaKept;
    if (viaDup) return viaDup;
  }
  return null;
}
