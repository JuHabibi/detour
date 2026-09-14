import type { DetourEvent } from "@/domain/events/event";

export type EventDuplicate = {
  keptId: string;
  duplicateId: string;
  reason: string;
};

export type DeduplicateEventsResult = {
  events: DetourEvent[];
  duplicates: EventDuplicate[];
};

/** Contexte pré-calculé une fois par event (clés / normalisations). */
type DedupEntry = {
  event: DetourEvent;
  minuteKey: string;
  city: string;
  venue: string;
  title: string;
  registrationUrl: string | null;
};

/**
 * Déduplication conservatrice : uniquement les doublons à forte confiance.
 * En cas de doute, les deux événements sont conservés.
 *
 * Compare uniquement les events qui partagent la même minute de `startAt`
 * (égalité exacte — même règle qu’auparavant). Les normalisations coûteuses
 * sont pré-calculées une fois par event.
 */
export function deduplicateEvents(
  events: DetourEvent[],
): DeduplicateEventsResult {
  if (events.length < 2) {
    return { events: [...events], duplicates: [] };
  }

  const entries = events.map(buildDedupEntry);
  const buckets = new Map<string, DedupEntry[]>();
  for (const entry of entries) {
    const bucket = buckets.get(entry.minuteKey);
    if (bucket) bucket.push(entry);
    else buckets.set(entry.minuteKey, [entry]);
  }

  const parent = initParents(entries);
  const pairReason = new Map<string, string>();

  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        linkIfDuplicate(bucket[i], bucket[j], parent, pairReason);
      }
    }
  }

  return resolveClusters(events, parent, pairReason);
}

/**
 * Variante all-pairs O(n²) — réservée aux tests de non-régression.
 * Même pré-calcul et mêmes règles métier que `deduplicateEvents`.
 * @internal
 */
export function deduplicateEventsAllPairsForTests(
  events: DetourEvent[],
): DeduplicateEventsResult {
  if (events.length < 2) {
    return { events: [...events], duplicates: [] };
  }

  const entries = events.map(buildDedupEntry);
  const parent = initParents(entries);
  const pairReason = new Map<string, string>();

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      linkIfDuplicate(entries[i], entries[j], parent, pairReason);
    }
  }

  return resolveClusters(events, parent, pairReason);
}

function initParents(entries: DedupEntry[]): Map<string, string> {
  const parent = new Map<string, string>();
  for (const entry of entries) {
    parent.set(entry.event.id, entry.event.id);
  }
  return parent;
}

function linkIfDuplicate(
  left: DedupEntry,
  right: DedupEntry,
  parent: Map<string, string>,
  pairReason: Map<string, string>,
): void {
  const reason = detectDuplicateReason(left, right);
  if (!reason) return;
  union(parent, left.event.id, right.event.id);
  pairReason.set(pairKey(left.event.id, right.event.id), reason);
}

function resolveClusters(
  events: DetourEvent[],
  parent: Map<string, string>,
  pairReason: Map<string, string>,
): DeduplicateEventsResult {
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

function buildDedupEntry(event: DetourEvent): DedupEntry {
  return {
    event,
    minuteKey: toMinuteKey(event.startAt),
    city: normalizeText(event.city),
    venue: normalizeText(event.venue),
    title: normalizeText(event.title),
    registrationUrl: event.registrationUrl
      ? normalizeUrl(event.registrationUrl)
      : null,
  };
}

function detectDuplicateReason(
  left: DedupEntry,
  right: DedupEntry,
): string | null {
  // Égalité à la minute (ex-isSameDateTime). Utile en all-pairs ; redondant en bucketed.
  if (left.minuteKey !== right.minuteKey) return null;

  if (isSameRegistrationUrlDuplicate(left, right)) {
    return "same-registration-url";
  }
  if (isSameTimePlaceSimilarTitleDuplicate(left, right)) {
    return "same-time-place-similar-title";
  }
  return null;
}

function isSameRegistrationUrlDuplicate(
  left: DedupEntry,
  right: DedupEntry,
): boolean {
  if (!left.registrationUrl || !right.registrationUrl) return false;
  if (left.registrationUrl !== right.registrationUrl) return false;
  // L’URL seule ne suffit jamais : il faut aussi un titre très proche.
  return titlesAreEditorialVariants(left.title, right.title);
}

function isSameTimePlaceSimilarTitleDuplicate(
  left: DedupEntry,
  right: DedupEntry,
): boolean {
  if (!left.city || !right.city || left.city !== right.city) return false;
  if (!left.venue || !right.venue || left.venue !== right.venue) return false;
  return titlesAreEditorialVariants(left.title, right.title);
}

/**
 * Variante éditoriale du même événement (année, préfixe soft),
 * pas un sous-événement distinct (visite, atelier, etc.).
 * Attend des titres déjà passés par `normalizeText`.
 */
function titlesAreEditorialVariants(left: string, right: string): boolean {
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
