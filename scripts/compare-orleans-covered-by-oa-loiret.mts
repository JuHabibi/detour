/**
 * Spike inverse: couverture ODS `orleans` par OpenAgenda Loiret (36668061).
 * Question: si on drop ODS, que perd-on ?
 *
 * Usage: bun --env-file=.env.local scripts/compare-orleans-covered-by-oa-loiret.mts
 */
import { OrleansEventAdapter } from "../src/infrastructure/sources/orleans/orleans-event.adapter";
import type { DetourEvent } from "../src/domain/events/event";

const AGENDA_UID = "36668061";
const WINDOW_DAYS = 180;
const OA_PAGE_SIZE = 100;
const PACE_MS = 150;

const FOCUS_CITIES = [
  "Orléans",
  "Saran",
  "Ingré",
  "Ormes",
  "Chécy",
  "Olivet",
  "Fleury-les-Aubrais",
  "Saint-Jean-de-la-Ruelle",
  "Saint-Jean-de-Braye",
  "La Chapelle-Saint-Mesmin",
  "Boigny-sur-Bionne",
  "Semoy",
  "Saint-Jean-le-Blanc",
  "Saint-Pryvé-Saint-Mesmin",
  "Mardié",
] as const;

type ClassLabel =
  | "EXACT_MATCH"
  | "PROBABLE_MATCH"
  | "DIFFERENT_GRANULARITY"
  | "ODS_ONLY"
  | "AMBIGUOUS";

type LangString = string | { fr?: string; en?: string } | null | undefined;

type OaEvent = {
  uid?: number;
  title?: LangString;
  location?: {
    name?: string;
    city?: string;
    adminLevel4?: string;
    latitude?: number;
    longitude?: number;
  } | null;
  firstTiming?: { begin?: string; end?: string } | null;
  nextTiming?: { begin?: string; end?: string } | null;
  timings?: Array<{ begin?: string; end?: string }>;
  originAgenda?: { uid?: number; title?: string } | null;
  "categorie-principale"?: unknown;
};

type Norm = {
  uid: number | null;
  id: string;
  title: string;
  titleNorm: string;
  titleTokens: Set<string>;
  startAt: string;
  day: string;
  minutes: number | null;
  city: string;
  cityNorm: string;
  venue: string;
  venueNorm: string;
  lat: number | null;
  lon: number | null;
  timingsCount: number;
  origin: string;
  category: string;
};

type MatchHit = { other: Norm; score: number; reasons: string[] };

function requireApiKey(): string {
  const key = process.env.OPENAGENDA_API_KEY?.trim();
  if (!key) throw new Error("OPENAGENDA_API_KEY manquante");
  return key;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function langText(value: LangString): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t.length ? t : null;
  }
  return value.fr?.trim() || value.en?.trim() || null;
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalizeText(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "le", "la", "les", "un", "une", "des", "du", "de", "d", "l", "et", "en",
  "au", "aux", "a", "pour", "par", "sur", "avec", "dans", "the", "of",
]);

function tokens(norm: string): Set<string> {
  const out = new Set<string>();
  for (const t of norm.split(" ")) {
    if (t.length < 2 || STOP.has(t)) continue;
    out.add(t);
  }
  return out;
}

function diceTokens(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return (2 * inter) / (a.size + b.size);
}

function containsNorm(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function dayKey(iso: string): string {
  return iso.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? iso.slice(0, 10);
}

function minutesOfDay(iso: string): number | null {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function cityCanon(raw: string): string {
  const n = normalizeText(raw);
  const aliases: Record<string, string> = {
    orleans: "orleans",
    "fleury les aubrais": "fleury les aubrais",
    "saint jean de la ruelle": "saint jean de la ruelle",
    "st jean de la ruelle": "saint jean de la ruelle",
    "saint jean de braye": "saint jean de braye",
    "st jean de braye": "saint jean de braye",
    "la chapelle saint mesmin": "la chapelle saint mesmin",
    "boigny sur bionne": "boigny sur bionne",
    "saint jean le blanc": "saint jean le blanc",
    "st jean le blanc": "saint jean le blanc",
    "saint pryve saint mesmin": "saint pryve saint mesmin",
    "st pryve st mesmin": "saint pryve saint mesmin",
    ingre: "ingre",
    checy: "checy",
    mardie: "mardie",
  };
  return aliases[n] ?? n;
}

function focusCityNorm(name: string): string {
  return cityCanon(name);
}

function parseUidFromOrleansId(id: string): number | null {
  const m = id.match(/^openagenda:(\d+)$/);
  return m ? Number(m[1]) : null;
}

function categoryLabel(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number") return String(raw);
  if (Array.isArray(raw)) {
    return raw.map(categoryLabel).filter(Boolean).join(", ");
  }
  if (typeof raw === "object") {
    const o = raw as { label?: LangString; fr?: string };
    return langText(o.label) ?? o.fr?.trim() ?? "";
  }
  return "";
}

function normalizeOds(e: DetourEvent): Norm {
  const title = e.title.trim();
  const titleNorm = normalizeText(title);
  const city = (e.city ?? "").trim();
  const venue = (e.venue ?? "").trim();
  return {
    uid: parseUidFromOrleansId(e.id),
    id: e.id,
    title,
    titleNorm,
    titleTokens: tokens(titleNorm),
    startAt: e.startAt,
    day: dayKey(e.startAt),
    minutes: minutesOfDay(e.startAt),
    city,
    cityNorm: cityCanon(city),
    venue,
    venueNorm: normalizeText(venue),
    lat: e.latitude,
    lon: e.longitude,
    timingsCount: 1,
    origin: (e.source ?? "").trim(),
    category: (e.category ?? "").trim(),
  };
}

function normalizeOa(raw: OaEvent): Norm | null {
  if (raw.uid == null) return null;
  const title = langText(raw.title);
  const timing = raw.nextTiming ?? raw.firstTiming;
  const startAt = timing?.begin;
  if (!title || !startAt) return null;
  const city = (raw.location?.city || raw.location?.adminLevel4 || "").trim();
  const venue = (raw.location?.name || "").trim();
  const titleNorm = normalizeText(title);
  return {
    uid: raw.uid,
    id: `oa-loiret:${raw.uid}`,
    title,
    titleNorm,
    titleTokens: tokens(titleNorm),
    startAt,
    day: dayKey(startAt),
    minutes: minutesOfDay(startAt),
    city,
    cityNorm: cityCanon(city),
    venue,
    venueNorm: normalizeText(venue),
    lat: raw.location?.latitude ?? null,
    lon: raw.location?.longitude ?? null,
    timingsCount: Array.isArray(raw.timings) ? raw.timings.length : 0,
    origin: (raw.originAgenda?.title || "").trim(),
    category: categoryLabel(raw["categorie-principale"]),
  };
}

function inWindow(iso: string, from: Date, to: Date): boolean {
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t >= from.getTime() && t <= to.getTime();
}

async function oaGet(
  key: string,
  path: string,
  params: Record<string, string | number | string[] | undefined>,
): Promise<Record<string, unknown>> {
  const url = new URL(`https://api.openagenda.com/v2${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    if (Array.isArray(v)) for (const item of v) url.searchParams.append(k, String(item));
    else url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { key } });
  if (!res.ok) {
    throw new Error(`OA ${path} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

async function fetchAllOaLoiret(key: string, from: Date, to: Date): Promise<Norm[]> {
  const events: Norm[] = [];
  let after: string[] | null | undefined;
  let guard = 0;
  let apiTotal = 0;

  while (guard++ < 200) {
    const params: Record<string, string | number | string[] | undefined> = {
      size: OA_PAGE_SIZE,
      detailed: 1,
      monolingual: "fr",
      includeLabels: 1,
      "relative[]": ["current", "upcoming"],
      "timings[gte]": from.toISOString(),
      "timings[lte]": to.toISOString(),
      sort: "timings.asc",
      "if[]": [
        "uid",
        "title",
        "location",
        "firstTiming",
        "nextTiming",
        "timings",
        "originAgenda",
        "categorie-principale",
      ],
    };
    if (after) params["after[]"] = after;

    const json = await oaGet(key, `/agendas/${AGENDA_UID}/events`, params);
    apiTotal = Number(json.total ?? 0);
    const page = (json.events as OaEvent[] | undefined) ?? [];
    for (const raw of page) {
      const n = normalizeOa(raw);
      if (!n) continue;
      if (!inWindow(n.startAt, from, to)) {
        const hit = (raw.timings ?? []).find((t) => t.begin && inWindow(t.begin, from, to));
        if (!hit?.begin) continue;
        n.startAt = hit.begin;
        n.day = dayKey(hit.begin);
        n.minutes = minutesOfDay(hit.begin);
      }
      events.push(n);
    }
    after = (json.after as string[] | null | undefined) ?? null;
    if (!after || page.length === 0) break;
    await sleep(PACE_MS);
  }

  const byUid = new Map<number, Norm>();
  for (const e of events) {
    if (e.uid != null) byUid.set(e.uid, e);
  }
  console.error(JSON.stringify({ phase: "oa_done", apiTotal, normalized: byUid.size }));
  return [...byUid.values()];
}

function scorePair(ods: Norm, oa: Norm): MatchHit {
  const reasons: string[] = [];
  let score = 0;

  if (ods.uid != null && oa.uid != null && ods.uid === oa.uid) {
    score += 100;
    reasons.push("same_openagenda_uid");
  }

  const titleDice = diceTokens(ods.titleTokens, oa.titleTokens);
  const titleExact = ods.titleNorm === oa.titleNorm && ods.titleNorm.length > 0;
  if (titleExact) {
    score += 40;
    reasons.push("title_exact");
  } else if (titleDice >= 0.85) {
    score += 32;
    reasons.push(`title_dice_${titleDice.toFixed(2)}`);
  } else if (titleDice >= 0.65) {
    score += 22;
    reasons.push(`title_dice_${titleDice.toFixed(2)}`);
  } else if (titleDice >= 0.45) {
    score += 12;
    reasons.push(`title_dice_${titleDice.toFixed(2)}`);
  } else if (
    containsNorm(ods.titleNorm, oa.titleNorm) &&
    Math.min(ods.titleNorm.length, oa.titleNorm.length) >= 12
  ) {
    score += 18;
    reasons.push("title_contains");
  }

  if (ods.day === oa.day) {
    score += 20;
    reasons.push("same_day");
    if (ods.minutes != null && oa.minutes != null) {
      const diff = Math.abs(ods.minutes - oa.minutes);
      if (diff <= 5) {
        score += 15;
        reasons.push("same_time");
      } else if (diff <= 30) {
        score += 8;
        reasons.push("near_time");
      } else if (diff <= 120) {
        score += 3;
        reasons.push("loose_time");
      }
    }
  } else {
    const da = Date.parse(`${ods.day}T12:00:00Z`);
    const db = Date.parse(`${oa.day}T12:00:00Z`);
    if (!Number.isNaN(da) && !Number.isNaN(db)) {
      const dayDiff = Math.abs(da - db) / 86400000;
      if (dayDiff === 1) {
        score += 4;
        reasons.push("adjacent_day");
      }
    }
  }

  if (ods.cityNorm && oa.cityNorm && ods.cityNorm === oa.cityNorm) {
    score += 12;
    reasons.push("same_city");
  } else if (ods.cityNorm && oa.cityNorm) {
    score -= 8;
    reasons.push("city_mismatch");
  }

  if (ods.venueNorm && oa.venueNorm) {
    const venueDice = diceTokens(tokens(ods.venueNorm), tokens(oa.venueNorm));
    if (ods.venueNorm === oa.venueNorm || venueDice >= 0.8) {
      score += 12;
      reasons.push("same_venue");
    } else if (venueDice >= 0.5 || containsNorm(ods.venueNorm, oa.venueNorm)) {
      score += 6;
      reasons.push("near_venue");
    }
  }

  if (ods.lat != null && ods.lon != null && oa.lat != null && oa.lon != null) {
    const km = haversineKm(ods.lat, ods.lon, oa.lat, oa.lon);
    if (km <= 0.15) {
      score += 6;
      reasons.push("geo_same");
    } else if (km <= 0.8) {
      score += 2;
      reasons.push("geo_near");
    } else if (km > 5) {
      score -= 5;
      reasons.push("geo_far");
    }
  }

  if (ods.origin && oa.origin) {
    const o = normalizeText(ods.origin);
    const s = normalizeText(oa.origin);
    if (o && s && (o === s || containsNorm(o, s))) {
      score += 5;
      reasons.push("same_origin");
    }
  }

  return { other: oa, score, reasons };
}

function classify(
  hits: MatchHit[],
): { label: ClassLabel; best: MatchHit | null; runnerUp: MatchHit | null } {
  const sorted = [...hits].sort((a, b) => b.score - a.score);
  const best = sorted[0] ?? null;
  const runnerUp = sorted[1] ?? null;

  if (!best || best.score < 35) {
    return { label: "ODS_ONLY", best, runnerUp };
  }

  if (
    runnerUp &&
    runnerUp.score >= 50 &&
    best.score - runnerUp.score < 8 &&
    best.other.id !== runnerUp.other.id
  ) {
    return { label: "AMBIGUOUS", best, runnerUp };
  }

  const r = new Set(best.reasons);
  const titleStrong =
    r.has("title_exact") ||
    [...r].some(
      (x) =>
        x.startsWith("title_dice_0.8") ||
        x.startsWith("title_dice_0.9") ||
        x.startsWith("title_dice_1"),
    );
  const titleMedium =
    titleStrong ||
    r.has("title_contains") ||
    [...r].some((x) => {
      const m = x.match(/^title_dice_(\d+\.\d+)$/);
      return m ? Number(m[1]) >= 0.65 : false;
    });

  if (r.has("same_openagenda_uid") && (r.has("same_day") || r.has("same_city") || titleStrong)) {
    return { label: "EXACT_MATCH", best, runnerUp };
  }

  if (
    best.score >= 75 &&
    titleStrong &&
    r.has("same_day") &&
    (r.has("same_time") || r.has("near_time") || r.has("same_venue") || r.has("same_city"))
  ) {
    return { label: "EXACT_MATCH", best, runnerUp };
  }

  const granularityHint =
    r.has("title_contains") ||
    (r.has("same_day") &&
      (r.has("same_venue") || r.has("same_city")) &&
      !titleStrong &&
      best.score >= 45) ||
    (best.other.timingsCount > 5 && r.has("same_city") && titleMedium);

  if (granularityHint && best.score >= 45 && best.score < 78) {
    return { label: "DIFFERENT_GRANULARITY", best, runnerUp };
  }

  if (best.score >= 55 && titleMedium && (r.has("same_day") || r.has("same_venue"))) {
    return { label: "PROBABLE_MATCH", best, runnerUp };
  }

  if (best.score >= 48 && r.has("same_day") && r.has("same_city") && titleMedium) {
    return { label: "PROBABLE_MATCH", best, runnerUp };
  }

  if (best.score >= 35) {
    return { label: "AMBIGUOUS", best, runnerUp };
  }

  return { label: "ODS_ONLY", best, runnerUp };
}

/** Heuristique éditoriale grossière pour ODS_ONLY. */
function editorialBucket(ods: Norm): string {
  const blob = `${ods.title} ${ods.category} ${ods.origin}`.toLowerCase();
  const n = normalizeText(blob);
  if (
    /marche|brocante|vide grenier|braderie|salon|forum emploi|emploi|sport|gym|yoga|piscine|laser tag|escape game/.test(
      n,
    )
  ) {
    return "marches_loisirs_hors_coeur";
  }
  if (
    /atelier|animation|stage|initiation|visite guidee|permanence|reunion|assemblee|conseil|collecte|don du sang/.test(
      n,
    )
  ) {
    return "ateliers_animations_locales";
  }
  if (
    /concert|spectacle|theatre|cinema|expo|exposition|festival|lecture|conte|danse|musique|opera|jazz|humour|stand up|projection/.test(
      n,
    ) ||
    /spectacle|concert|exposition|theatre|festival/.test(normalizeText(ods.category))
  ) {
    return "culture_coeur_detour";
  }
  if (/conference|colloque|debat|table ronde|rencontre/.test(n)) {
    return "conferences_rencontres";
  }
  return "autre_incertain";
}

function topCounts(items: string[], limit = 15): Array<{ key: string; n: number }> {
  const map = new Map<string, number>();
  for (const k of items) {
    const key = k.trim() || "(vide)";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, n]) => ({ key, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
}

async function main() {
  const key = requireApiKey();
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + WINDOW_DAYS);

  console.error(
    JSON.stringify({
      phase: "start",
      window: { from: from.toISOString(), to: to.toISOString(), days: WINDOW_DAYS },
      keyPresent: true,
      keyLength: key.length,
    }),
  );

  const orleansRaw = await new OrleansEventAdapter().fetchUpcomingEvents({ from, to });
  const ods = orleansRaw.map(normalizeOds);
  console.error(JSON.stringify({ phase: "ods_done", count: ods.length }));

  const oa = await fetchAllOaLoiret(key, from, to);

  const byDay = new Map<string, Norm[]>();
  const byCity = new Map<string, Norm[]>();
  const byUid = new Map<number, Norm>();
  for (const e of oa) {
    if (!byDay.has(e.day)) byDay.set(e.day, []);
    byDay.get(e.day)!.push(e);
    if (e.cityNorm) {
      if (!byCity.has(e.cityNorm)) byCity.set(e.cityNorm, []);
      byCity.get(e.cityNorm)!.push(e);
    }
    if (e.uid != null) byUid.set(e.uid, e);
  }

  const rows: Array<{
    ods: Norm;
    label: ClassLabel;
    best: MatchHit | null;
    bucket: string;
  }> = [];

  for (const event of ods) {
    const candidateMap = new Map<string, Norm>();
    if (event.uid != null && byUid.has(event.uid)) {
      candidateMap.set(byUid.get(event.uid)!.id, byUid.get(event.uid)!);
    }
    for (const e of byDay.get(event.day) ?? []) candidateMap.set(e.id, e);
    const d0 = Date.parse(`${event.day}T12:00:00Z`);
    if (!Number.isNaN(d0)) {
      for (const delta of [-1, 1]) {
        const d = new Date(d0 + delta * 86400000).toISOString().slice(0, 10);
        for (const e of byDay.get(d) ?? []) candidateMap.set(e.id, e);
      }
    }
    if (event.cityNorm) {
      for (const e of byCity.get(event.cityNorm) ?? []) candidateMap.set(e.id, e);
    }

    const hits = [...candidateMap.values()].map((other) => scorePair(event, other));
    const top = hits.sort((a, b) => b.score - a.score).slice(0, 8);
    const { label, best } = classify(top);
    rows.push({
      ods: event,
      label,
      best,
      bucket: editorialBucket(event),
    });
  }

  const counts: Record<ClassLabel, number> = {
    EXACT_MATCH: 0,
    PROBABLE_MATCH: 0,
    DIFFERENT_GRANULARITY: 0,
    ODS_ONLY: 0,
    AMBIGUOUS: 0,
  };
  for (const r of rows) counts[r.label]++;

  const covered =
    counts.EXACT_MATCH + counts.PROBABLE_MATCH + counts.DIFFERENT_GRANULARITY;
  const coverageRate = ods.length === 0 ? 0 : covered / ods.length;

  const byCommune = FOCUS_CITIES.map((commune) => {
    const cn = focusCityNorm(commune);
    const subset = rows.filter((r) => r.ods.cityNorm === cn);
    const cov = subset.filter((r) =>
      ["EXACT_MATCH", "PROBABLE_MATCH", "DIFFERENT_GRANULARITY"].includes(r.label),
    ).length;
    const only = subset.filter((r) => r.label === "ODS_ONLY").length;
    return {
      commune,
      odsTotal: subset.length,
      coveredByOa: cov,
      odsOnly: only,
      coverageRate: subset.length === 0 ? null : Number((cov / subset.length).toFixed(3)),
      breakdown: {
        EXACT_MATCH: subset.filter((r) => r.label === "EXACT_MATCH").length,
        PROBABLE_MATCH: subset.filter((r) => r.label === "PROBABLE_MATCH").length,
        DIFFERENT_GRANULARITY: subset.filter((r) => r.label === "DIFFERENT_GRANULARITY").length,
        ODS_ONLY: only,
        AMBIGUOUS: subset.filter((r) => r.label === "AMBIGUOUS").length,
      },
    };
  });

  const odsOnly = rows.filter((r) => r.label === "ODS_ONLY");

  // Prefer culturally interesting samples
  const cultureFirst = [
    ...odsOnly.filter((r) => r.bucket === "culture_coeur_detour"),
    ...odsOnly.filter((r) => r.bucket === "conferences_rencontres"),
    ...odsOnly.filter((r) => r.bucket === "ateliers_animations_locales"),
    ...odsOnly.filter((r) => r.bucket === "autre_incertain"),
    ...odsOnly.filter((r) => r.bucket === "marches_loisirs_hors_coeur"),
  ];
  const seen = new Set<string>();
  const examples: typeof cultureFirst = [];
  for (const r of cultureFirst) {
    if (seen.has(r.ods.id)) continue;
    seen.add(r.ods.id);
    examples.push(r);
    if (examples.length >= 20) break;
  }

  const uidMiss = odsOnly.filter((r) => r.ods.uid != null).length;
  const uidHitExact = rows.filter(
    (r) =>
      r.label === "EXACT_MATCH" &&
      r.best?.reasons.includes("same_openagenda_uid"),
  ).length;

  // Verdict
  const lossRate = 1 - coverageRate;
  const cultureLoss = odsOnly.filter((r) => r.bucket === "culture_coeur_detour").length;
  const orleansRow = byCommune.find((c) => c.commune === "Orléans");

  let verdict: "YES_REPLACE" | "MAYBE_REPLACE_WITH_CAVEATS" | "NO_KEEP_ODS";
  const verdictWhy: string[] = [];

  if (coverageRate >= 0.95 && cultureLoss <= 5 && counts.ODS_ONLY <= 20) {
    verdict = "YES_REPLACE";
    verdictWhy.push(
      `Couverture ${(coverageRate * 100).toFixed(1)}% avec pertes culturelles faibles (${cultureLoss})`,
    );
  } else if (coverageRate >= 0.85 && counts.ODS_ONLY <= 80) {
    verdict = "MAYBE_REPLACE_WITH_CAVEATS";
    verdictWhy.push(
      `Couverture ${(coverageRate * 100).toFixed(1)}% mais ${counts.ODS_ONLY} ODS_ONLY (dont ${cultureLoss} culture cœur)`,
    );
  } else {
    verdict = "NO_KEEP_ODS";
    verdictWhy.push(
      `Pertes trop élevées: ${counts.ODS_ONLY} ODS_ONLY (${(lossRate * 100).toFixed(1)}%), culture cœur=${cultureLoss}`,
    );
  }

  // Operational caveats always matter for YES/MAYBE
  if (verdict !== "NO_KEEP_ODS") {
    verdictWhy.push(
      "Caveat ops: OA Loiret ≫ volume + multi-timings + hors métropole → filtre geo + granularité obligatoires",
    );
  }
  if (orleansRow && (orleansRow.coverageRate ?? 0) < 0.9) {
    verdictWhy.push(
      `Orléans couverture OA=${((orleansRow.coverageRate ?? 0) * 100).toFixed(1)}% — cœur catalogue exposé`,
    );
    if (verdict === "YES_REPLACE") verdict = "MAYBE_REPLACE_WITH_CAVEATS";
  }

  // Dependence risk
  verdictWhy.push(
    "Risque dépendance: ODS métropole est un miroir OpenAgenda déjà filtré; drop ODS = single point of failure API OA + perte du filtre statut/métropole ODS",
  );

  // If coverage high because same UIDs, replacing still consolidates dependency
  if (uidHitExact >= covered * 0.7 && coverageRate >= 0.8) {
    verdictWhy.push(
      `${uidHitExact} EXACT via même uid OA: ODS et Loiret partagent le graphe OpenAgenda — remplacer ODS n'ajoute pas d'indépendance de source`,
    );
  }

  const report = {
    spike: "orleans-covered-by-oa-loiret",
    window: {
      from: from.toISOString(),
      to: to.toISOString(),
      days: WINDOW_DAYS,
    },
    corpus: {
      orleansOds: ods.length,
      openagendaLoiret: oa.length,
    },
    classification: counts,
    coverageOaOfOds: Number(coverageRate.toFixed(4)),
    coveragePercent: Number((coverageRate * 100).toFixed(1)),
    netLossIfDropOds: counts.ODS_ONLY,
    uidStats: {
      exactViaSameUid: uidHitExact,
      odsOnlyStillHavingUid: uidMiss,
      note: "odsOnlyStillHavingUid = uid openagenda:* présent côté ODS mais event absent/non matché dans agenda Loiret 36668061",
    },
    byCommune,
    odsOnlyQualitative: {
      total: odsOnly.length,
      byOrigin: topCounts(odsOnly.map((r) => r.ods.origin)),
      byCategory: topCounts(odsOnly.map((r) => r.ods.category)),
      byCity: topCounts(odsOnly.map((r) => r.ods.city || "(sans ville)")),
      byEditorialBucket: topCounts(odsOnly.map((r) => r.bucket)),
      examples: examples.map((r) => ({
        id: r.ods.id,
        title: r.ods.title,
        city: r.ods.city,
        startAt: r.ods.startAt,
        venue: r.ods.venue,
        category: r.ods.category,
        origin: r.ods.origin,
        bucket: r.bucket,
        bestScore: r.best?.score ?? 0,
        bestOaTitle: r.best?.other.title ?? null,
      })),
    },
    verdict,
    verdictWhy,
    auth: { keyPresent: true, keyLength: key.length },
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
