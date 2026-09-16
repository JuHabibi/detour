/**
 * Spike: comparatif global OpenAgenda Loiret (36668061) vs source `orleans`
 * (Opendatasoft agenda-orleans-metropole). Aucune écriture DB / wiring.
 *
 * Usage: bun --env-file=.env.local scripts/compare-openagenda-loiret-vs-orleans.mts
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
  | "EXACT_DUPLICATE"
  | "PROBABLE_DUPLICATE"
  | "DIFFERENT_GRANULARITY"
  | "NEW_EVENT"
  | "AMBIGUOUS";

type LangString = string | { fr?: string; en?: string } | null | undefined;

type OaEvent = {
  uid?: number;
  slug?: string;
  title?: LangString;
  location?: {
    name?: string;
    city?: string;
    adminLevel4?: string;
    insee?: string;
    latitude?: number;
    longitude?: number;
  } | null;
  firstTiming?: { begin?: string; end?: string } | null;
  nextTiming?: { begin?: string; end?: string } | null;
  timings?: Array<{ begin?: string; end?: string }>;
  originAgenda?: { uid?: number; title?: string; slug?: string } | null;
};

type OaNorm = {
  uid: number;
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
  originUid: number | null;
};

type OrlNorm = {
  id: string;
  uidFromId: number | null;
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
  source: string;
};

type MatchHit = {
  orl: OrlNorm;
  score: number;
  reasons: string[];
};

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
  const fr = value.fr?.trim();
  if (fr) return fr;
  const en = value.en?.trim();
  return en && en.length ? en : null;
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
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "du",
  "de",
  "d",
  "l",
  "et",
  "en",
  "au",
  "aux",
  "a",
  "à",
  "pour",
  "par",
  "sur",
  "avec",
  "dans",
  "the",
  "of",
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
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? iso.slice(0, 10);
}

/** Minutes since local midnight if offset present; else UTC. */
function minutesOfDay(iso: string): number | null {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
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
    orléans: "orleans",
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

function normalizeOrleans(e: DetourEvent): OrlNorm {
  const title = e.title.trim();
  const titleNorm = normalizeText(title);
  const city = (e.city ?? "").trim();
  const venue = (e.venue ?? "").trim();
  return {
    id: e.id,
    uidFromId: parseUidFromOrleansId(e.id),
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
    source: (e.source ?? "").trim(),
  };
}

function normalizeOa(raw: OaEvent): OaNorm | null {
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
    originUid: raw.originAgenda?.uid ?? null,
  };
}

function inWindow(iso: string, from: Date, to: Date): boolean {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return t >= from.getTime() && t <= to.getTime();
}

async function oaGet(
  key: string,
  path: string,
  params: Record<string, string | number | string[] | number[] | undefined>,
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

async function fetchAllOaLoiret(
  key: string,
  from: Date,
  to: Date,
): Promise<OaNorm[]> {
  const events: OaNorm[] = [];
  let after: string[] | null | undefined;
  let guard = 0;
  let apiTotal = 0;

  while (guard++ < 200) {
    const params: Record<string, string | number | string[] | undefined> = {
      size: OA_PAGE_SIZE,
      detailed: 1,
      monolingual: "fr",
      "relative[]": ["current", "upcoming"],
      "timings[gte]": from.toISOString(),
      "timings[lte]": to.toISOString(),
      sort: "timings.asc",
      "if[]": [
        "uid",
        "title",
        "slug",
        "location",
        "firstTiming",
        "nextTiming",
        "timings",
        "originAgenda",
      ],
    };
    if (after) params["after[]"] = after;

    const json = await oaGet(key, `/agendas/${AGENDA_UID}/events`, params);
    apiTotal = Number(json.total ?? 0);
    const page = (json.events as OaEvent[] | undefined) ?? [];
    for (const raw of page) {
      const n = normalizeOa(raw);
      if (!n) continue;
      // Garde fenêtre sur next/first timing (alignement produit)
      if (!inWindow(n.startAt, from, to) && n.timingsCount <= 1) continue;
      // Récurrents: garder si nextTiming dans fenêtre (déjà le cas) ou au moins un timing
      if (!inWindow(n.startAt, from, to)) {
        const anyIn = (raw.timings ?? []).some(
          (t) => t.begin && inWindow(t.begin, from, to),
        );
        if (!anyIn) continue;
        // bascule startAt sur premier timing dans la fenêtre
        const hit = (raw.timings ?? []).find(
          (t) => t.begin && inWindow(t.begin, from, to),
        );
        if (hit?.begin) {
          n.startAt = hit.begin;
          n.day = dayKey(hit.begin);
          n.minutes = minutesOfDay(hit.begin);
        }
      }
      events.push(n);
    }
    after = (json.after as string[] | null | undefined) ?? null;
    if (!after || page.length === 0) break;
    await sleep(PACE_MS);
  }

  // dédup uid
  const byUid = new Map<number, OaNorm>();
  for (const e of events) byUid.set(e.uid, e);

  console.error(
    JSON.stringify({
      phase: "oa_fetch_done",
      apiTotal,
      normalized: byUid.size,
      keyPresent: true,
    }),
  );

  return [...byUid.values()];
}

function scorePair(oa: OaNorm, orl: OrlNorm): MatchHit {
  const reasons: string[] = [];
  let score = 0;

  if (orl.uidFromId != null && orl.uidFromId === oa.uid) {
    score += 100;
    reasons.push("same_openagenda_uid");
  }

  const titleDice = diceTokens(oa.titleTokens, orl.titleTokens);
  const titleExact = oa.titleNorm === orl.titleNorm && oa.titleNorm.length > 0;
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
  } else if (containsNorm(oa.titleNorm, orl.titleNorm) && Math.min(oa.titleNorm.length, orl.titleNorm.length) >= 12) {
    score += 18;
    reasons.push("title_contains");
  }

  if (oa.day === orl.day) {
    score += 20;
    reasons.push("same_day");
    if (oa.minutes != null && orl.minutes != null) {
      const diff = Math.abs(oa.minutes - orl.minutes);
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
    // adjacent day soft penalty path — still allow recurring mismatch
    const da = Date.parse(`${oa.day}T12:00:00Z`);
    const db = Date.parse(`${orl.day}T12:00:00Z`);
    const dayDiff = Math.abs(da - db) / 86400000;
    if (dayDiff === 1) {
      score += 4;
      reasons.push("adjacent_day");
    }
  }

  if (oa.cityNorm && orl.cityNorm && oa.cityNorm === orl.cityNorm) {
    score += 12;
    reasons.push("same_city");
  } else if (oa.cityNorm && orl.cityNorm && oa.cityNorm !== orl.cityNorm) {
    score -= 8;
    reasons.push("city_mismatch");
  }

  if (oa.venueNorm && orl.venueNorm) {
    const venueDice = diceTokens(tokens(oa.venueNorm), tokens(orl.venueNorm));
    if (oa.venueNorm === orl.venueNorm || venueDice >= 0.8) {
      score += 12;
      reasons.push("same_venue");
    } else if (venueDice >= 0.5 || containsNorm(oa.venueNorm, orl.venueNorm)) {
      score += 6;
      reasons.push("near_venue");
    }
  }

  if (
    oa.lat != null &&
    oa.lon != null &&
    orl.lat != null &&
    orl.lon != null
  ) {
    const km = haversineKm(oa.lat, oa.lon, orl.lat, orl.lon);
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

  if (oa.origin && orl.source) {
    const o = normalizeText(oa.origin);
    const s = normalizeText(orl.source);
    if (o && s && (o === s || containsNorm(o, s))) {
      score += 5;
      reasons.push("same_origin");
    }
  }

  return { orl, score, reasons };
}

function classify(
  oa: OaNorm,
  hits: MatchHit[],
): { label: ClassLabel; best: MatchHit | null; runnerUp: MatchHit | null } {
  const sorted = [...hits].sort((a, b) => b.score - a.score);
  const best = sorted[0] ?? null;
  const runnerUp = sorted[1] ?? null;

  if (!best || best.score < 35) {
    return { label: "NEW_EVENT", best, runnerUp };
  }

  if (
    runnerUp &&
    runnerUp.score >= 50 &&
    best.score - runnerUp.score < 8 &&
    best.orl.id !== runnerUp.orl.id
  ) {
    return { label: "AMBIGUOUS", best, runnerUp };
  }

  const r = new Set(best.reasons);
  const titleStrong =
    r.has("title_exact") ||
    [...r].some((x) => x.startsWith("title_dice_0.8") || x.startsWith("title_dice_0.9") || x.startsWith("title_dice_1"));
  const titleMedium =
    titleStrong ||
    r.has("title_contains") ||
    [...r].some((x) => {
      const m = x.match(/^title_dice_(\d+\.\d+)$/);
      return m ? Number(m[1]) >= 0.65 : false;
    });

  // Hard UID match from ODS openagenda: prefix
  if (r.has("same_openagenda_uid") && (r.has("same_day") || r.has("same_city"))) {
    return { label: "EXACT_DUPLICATE", best, runnerUp };
  }

  if (
    best.score >= 75 &&
    titleStrong &&
    r.has("same_day") &&
    (r.has("same_time") || r.has("near_time") || r.has("same_venue") || r.has("same_city"))
  ) {
    return { label: "EXACT_DUPLICATE", best, runnerUp };
  }

  // parent vs session
  const granularityHint =
    r.has("title_contains") ||
    (r.has("same_day") &&
      (r.has("same_venue") || r.has("same_city")) &&
      !titleStrong &&
      best.score >= 45) ||
    (oa.timingsCount > 5 && r.has("same_city") && titleMedium);

  if (granularityHint && best.score >= 45 && best.score < 78) {
    return { label: "DIFFERENT_GRANULARITY", best, runnerUp };
  }

  if (best.score >= 55 && titleMedium && (r.has("same_day") || r.has("same_venue"))) {
    return { label: "PROBABLE_DUPLICATE", best, runnerUp };
  }

  if (best.score >= 48 && r.has("same_day") && r.has("same_city") && titleMedium) {
    return { label: "PROBABLE_DUPLICATE", best, runnerUp };
  }

  if (best.score >= 42 && best.score < 55 && r.has("same_day") && (r.has("same_city") || r.has("same_venue"))) {
    return { label: "AMBIGUOUS", best, runnerUp };
  }

  if (best.score >= 35) {
    return { label: "AMBIGUOUS", best, runnerUp };
  }

  return { label: "NEW_EVENT", best, runnerUp };
}

function displayCity(city: string, cityNorm: string): string {
  if (!cityNorm) return "(sans ville)";
  const focus = FOCUS_CITIES.find((c) => focusCityNorm(c) === cityNorm);
  return focus ?? (city || cityNorm);
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

  const orleansRaw = await new OrleansEventAdapter().fetchUpcomingEvents({
    from,
    to,
  });
  const orleans = orleansRaw.map(normalizeOrleans);
  console.error(
    JSON.stringify({ phase: "orleans_done", count: orleans.length }),
  );

  const oa = await fetchAllOaLoiret(key, from, to);
  console.error(JSON.stringify({ phase: "match_start", oa: oa.length }));

  // Index orleans by day and by city for candidate pruning
  const byDay = new Map<string, OrlNorm[]>();
  const byCity = new Map<string, OrlNorm[]>();
  const byUid = new Map<number, OrlNorm>();
  for (const e of orleans) {
    if (!byDay.has(e.day)) byDay.set(e.day, []);
    byDay.get(e.day)!.push(e);
    if (e.cityNorm) {
      if (!byCity.has(e.cityNorm)) byCity.set(e.cityNorm, []);
      byCity.get(e.cityNorm)!.push(e);
    }
    if (e.uidFromId != null) byUid.set(e.uidFromId, e);
  }

  const classifications: Array<{
    oa: OaNorm;
    label: ClassLabel;
    best: MatchHit | null;
    runnerUp: MatchHit | null;
  }> = [];

  for (const event of oa) {
    const candidateMap = new Map<string, OrlNorm>();
    if (byUid.has(event.uid)) candidateMap.set(byUid.get(event.uid)!.id, byUid.get(event.uid)!);
    for (const e of byDay.get(event.day) ?? []) candidateMap.set(e.id, e);
    // adjacent days
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

    // If still thin, add title-token inverted is expensive; score top from city-day only is enough.
    // Fallback: if < 5 candidates, pull same-city only already done; else sample none.

    const hits = [...candidateMap.values()].map((orl) => scorePair(event, orl));
    const top = hits.sort((a, b) => b.score - a.score).slice(0, 8);
    const { label, best, runnerUp } = classify(event, top);
    classifications.push({ oa: event, label, best, runnerUp });
  }

  const counts: Record<ClassLabel, number> = {
    EXACT_DUPLICATE: 0,
    PROBABLE_DUPLICATE: 0,
    DIFFERENT_GRANULARITY: 0,
    NEW_EVENT: 0,
    AMBIGUOUS: 0,
  };
  for (const c of classifications) counts[c.label]++;

  const coveredLabels: ClassLabel[] = [
    "EXACT_DUPLICATE",
    "PROBABLE_DUPLICATE",
    "DIFFERENT_GRANULARITY",
  ];

  type CityRow = {
    commune: string;
    oaLoiret: number;
    coveredByOrleans: number;
    reallyNew: number;
    ambiguous: number;
    netGain: number;
    breakdown: Record<ClassLabel, number>;
  };

  const focusNorms = new Map(
    FOCUS_CITIES.map((c) => [focusCityNorm(c), c] as const),
  );

  const cityRows: CityRow[] = [];
  for (const commune of FOCUS_CITIES) {
    const cn = focusCityNorm(commune);
    const subset = classifications.filter((c) => c.oa.cityNorm === cn);
    const breakdown: Record<ClassLabel, number> = {
      EXACT_DUPLICATE: 0,
      PROBABLE_DUPLICATE: 0,
      DIFFERENT_GRANULARITY: 0,
      NEW_EVENT: 0,
      AMBIGUOUS: 0,
    };
    for (const s of subset) breakdown[s.label]++;
    const covered = subset.filter((s) => coveredLabels.includes(s.label)).length;
    const reallyNew = breakdown.NEW_EVENT;
    cityRows.push({
      commune,
      oaLoiret: subset.length,
      coveredByOrleans: covered,
      reallyNew,
      ambiguous: breakdown.AMBIGUOUS,
      netGain: reallyNew,
      breakdown,
    });
  }

  // other cities summary
  const other = classifications.filter((c) => !focusNorms.has(c.oa.cityNorm));
  const otherByCity = new Map<string, typeof classifications>();
  for (const c of other) {
    const k = displayCity(c.oa.city, c.oa.cityNorm);
    if (!otherByCity.has(k)) otherByCity.set(k, []);
    otherByCity.get(k)!.push(c);
  }
  const otherTop = [...otherByCity.entries()]
    .map(([commune, subset]) => {
      const reallyNew = subset.filter((s) => s.label === "NEW_EVENT").length;
      return {
        commune,
        oaLoiret: subset.length,
        coveredByOrleans: subset.filter((s) => coveredLabels.includes(s.label))
          .length,
        reallyNew,
        netGain: reallyNew,
      };
    })
    .sort((a, b) => b.oaLoiret - a.oaLoiret)
    .slice(0, 20);

  const newSamples = classifications
    .filter((c) => c.label === "NEW_EVENT")
    .slice(0, 25)
    .map((c) => ({
      title: c.oa.title,
      city: c.oa.city,
      startAt: c.oa.startAt,
      venue: c.oa.venue,
      origin: c.oa.origin,
      bestScore: c.best?.score ?? 0,
      bestOrleans: c.best
        ? { id: c.best.orl.id, title: c.best.orl.title, score: c.best.score }
        : null,
    }));

  const exactSamples = classifications
    .filter((c) => c.label === "EXACT_DUPLICATE")
    .slice(0, 15)
    .map((c) => ({
      oa: { title: c.oa.title, city: c.oa.city, startAt: c.oa.startAt },
      orleans: c.best
        ? {
            id: c.best.orl.id,
            title: c.best.orl.title,
            startAt: c.best.orl.startAt,
            reasons: c.best.reasons,
          }
        : null,
    }));

  const granSamples = classifications
    .filter((c) => c.label === "DIFFERENT_GRANULARITY")
    .slice(0, 15)
    .map((c) => ({
      oa: { title: c.oa.title, city: c.oa.city, startAt: c.oa.startAt, timings: c.oa.timingsCount },
      orleans: c.best
        ? { title: c.best.orl.title, startAt: c.best.orl.startAt, reasons: c.best.reasons, score: c.best.score }
        : null,
    }));

  const duplicateRate =
    oa.length === 0
      ? 0
      : (counts.EXACT_DUPLICATE + counts.PROBABLE_DUPLICATE + counts.DIFFERENT_GRANULARITY) /
        oa.length;
  const newRate = oa.length === 0 ? 0 : counts.NEW_EVENT / oa.length;

  const focusNew = cityRows.reduce((s, r) => s + r.reallyNew, 0);
  const focusTotal = cityRows.reduce((s, r) => s + r.oaLoiret, 0);
  const focusCovered = cityRows.reduce((s, r) => s + r.coveredByOrleans, 0);

  // Verdict heuristics
  let verdict: "GO global" | "GO uniquement pour certaines communes" | "NO-GO global";
  const verdictWhy: string[] = [];

  if (newRate < 0.15 && duplicateRate >= 0.7) {
    verdict = "NO-GO global";
    verdictWhy.push(
      `Taux de nouveauté trop bas (${(newRate * 100).toFixed(1)}%) et recouvrement élevé (${(duplicateRate * 100).toFixed(1)}%)`,
    );
  } else if (newRate >= 0.35 && focusNew >= 30) {
    // check if novelty concentrated
    const citiesWithGain = cityRows.filter((r) => r.reallyNew >= 5 && r.reallyNew / Math.max(r.oaLoiret, 1) >= 0.35);
    if (citiesWithGain.length >= 5 && focusNew / Math.max(focusTotal, 1) >= 0.3) {
      verdict = "GO global";
      verdictWhy.push(
        `Nouveauté significative globale (${counts.NEW_EVENT}/${oa.length}) dont ${focusNew} sur communes focus`,
      );
    } else {
      verdict = "GO uniquement pour certaines communes";
      verdictWhy.push(
        `Gain concentré: ${citiesWithGain.map((c) => `${c.commune}(+${c.reallyNew})`).join(", ") || "voir tableau"}`,
      );
    }
  } else {
    const citiesWithGain = cityRows
      .filter((r) => r.reallyNew >= 3 && r.reallyNew / Math.max(r.oaLoiret, 1) >= 0.25)
      .sort((a, b) => b.reallyNew - a.reallyNew);
    if (citiesWithGain.length >= 1 && counts.NEW_EVENT >= 20) {
      verdict = "GO uniquement pour certaines communes";
      verdictWhy.push(
        `Gain net surtout: ${citiesWithGain
          .slice(0, 8)
          .map((c) => `${c.commune}(+${c.reallyNew}/${c.oaLoiret})`)
          .join(", ")}`,
      );
    } else if (counts.NEW_EVENT < 20 || newRate < 0.2) {
      verdict = "NO-GO global";
      verdictWhy.push(
        `Trop peu de NEW_EVENT utiles (${counts.NEW_EVENT}, ${(newRate * 100).toFixed(1)}%) vs doublons/granularité`,
      );
    } else {
      verdict = "GO uniquement pour certaines communes";
      verdictWhy.push("Nouveauté partielle; filtrer par commune recommandée");
    }
  }

  // Override: if Orleans already covers most of OA for Orléans city specifically
  const orleansCity = cityRows.find((r) => r.commune === "Orléans");
  if (
    orleansCity &&
    orleansCity.oaLoiret > 50 &&
    orleansCity.reallyNew / orleansCity.oaLoiret < 0.15 &&
    verdict === "GO global"
  ) {
    verdict = "GO uniquement pour certaines communes";
    verdictWhy.push(
      "Orléans largement déjà couvert par ODS — un GO global créerait surtout des doublons centre-métropole",
    );
  }

  const report = {
    spike: "compare-oa-loiret-vs-orleans",
    window: {
      from: from.toISOString(),
      to: to.toISOString(),
      days: WINDOW_DAYS,
      note: "Même fenêtre produit que run-detour-event-sync (180j)",
    },
    corpus: {
      orleans: orleans.length,
      openagendaLoiret: oa.length,
    },
    classification: counts,
    rates: {
      duplicateOrOverlap: Number(duplicateRate.toFixed(3)),
      newEvent: Number(newRate.toFixed(3)),
      ambiguous: Number((counts.AMBIGUOUS / Math.max(oa.length, 1)).toFixed(3)),
    },
    focusSummary: {
      oaLoiret: focusTotal,
      coveredByOrleans: focusCovered,
      reallyNew: focusNew,
    },
    byCommune: cityRows,
    otherCitiesTop20: otherTop,
    samples: {
      exact: exactSamples,
      granularity: granSamples,
      newEvents: newSamples,
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
