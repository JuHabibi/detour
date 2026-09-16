/**
 * Spike éditorial: NEW_EVENT OA Loiret sur communes candidates vs ODS.
 * Usage: bun --env-file=.env.local scripts/audit-oa-loiret-editorial-new.mts
 */
import { OrleansEventAdapter } from "../src/infrastructure/sources/orleans/orleans-event.adapter";

const AGENDA_UID = "36668061";
const WINDOW_DAYS = 180;
const CITIES = [
  "Ormes",
  "Ingré",
  "Saint-Jean-le-Blanc",
  "Saint-Pryvé-Saint-Mesmin",
  "Saran",
] as const;

type LangString = string | { fr?: string; en?: string } | null | undefined;

function requireKey(): string {
  const key = process.env.OPENAGENDA_API_KEY?.trim();
  if (!key) throw new Error("OPENAGENDA_API_KEY manquante");
  return key;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function lang(v: LangString): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  return v.fr?.trim() || v.en?.trim() || null;
}

function strip(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cityCanon(raw: string): string {
  const n = strip(raw || "");
  const a: Record<string, string> = {
    "saint jean le blanc": "saint jean le blanc",
    "saint pryve saint mesmin": "saint pryve saint mesmin",
    "st pryve st mesmin": "saint pryve saint mesmin",
    ingre: "ingre",
  };
  return a[n] ?? n;
}

function day(iso: string): string {
  return iso.slice(0, 10);
}

function mins(iso: string): number | null {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function tokens(n: string): Set<string> {
  return new Set(n.split(" ").filter((t) => t.length >= 2));
}

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let i = 0;
  for (const t of a) if (b.has(t)) i++;
  return (2 * i) / (a.size + b.size);
}

function catLabel(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    const parts = raw.map((x) => {
      if (x && typeof x === "object" && "label" in x) {
        return lang((x as { label?: LangString }).label) || "";
      }
      return typeof x === "string" ? x : String(x);
    });
    return parts.filter(Boolean).join(", ") || null;
  }
  if (typeof raw === "object" && raw && "label" in raw) {
    return lang((raw as { label?: LangString }).label);
  }
  return String(raw);
}

type OdsN = {
  id: string;
  uid: number | null;
  title: string;
  tn: string;
  tok: Set<string>;
  day: string;
  mins: number | null;
  city: string;
  venue: string;
};

type MatchLabel = "EXACT" | "PROBABLE" | "GRANULARITY" | "AMBIGUOUS" | "NEW_EVENT";

async function main() {
  const key = requireKey();
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + WINDOW_DAYS);

  const ods = await new OrleansEventAdapter().fetchUpcomingEvents({ from, to });
  const odsN: OdsN[] = ods.map((e) => {
    const m = e.id.match(/^openagenda:(\d+)$/);
    return {
      id: e.id,
      uid: m ? Number(m[1]) : null,
      title: e.title,
      tn: strip(e.title),
      tok: tokens(strip(e.title)),
      day: day(e.startAt),
      mins: mins(e.startAt),
      city: cityCanon(e.city || ""),
      venue: strip(e.venue || ""),
    };
  });
  const byUid = new Map(odsN.filter((e) => e.uid != null).map((e) => [e.uid!, e]));
  const byCity = new Map<string, OdsN[]>();
  for (const e of odsN) {
    if (!byCity.has(e.city)) byCity.set(e.city, []);
    byCity.get(e.city)!.push(e);
  }

  async function fetchCity(city: string) {
    const all: Record<string, unknown>[] = [];
    let after: string[] | null | undefined;
    for (let g = 0; g < 30; g++) {
      const url = new URL(`https://api.openagenda.com/v2/agendas/${AGENDA_UID}/events`);
      url.searchParams.set("size", "100");
      url.searchParams.set("detailed", "1");
      url.searchParams.set("monolingual", "fr");
      url.searchParams.set("includeLabels", "1");
      url.searchParams.append("relative[]", "current");
      url.searchParams.append("relative[]", "upcoming");
      url.searchParams.set("timings[gte]", from.toISOString());
      url.searchParams.set("timings[lte]", to.toISOString());
      url.searchParams.append("adminLevel4[]", city);
      url.searchParams.set("sort", "timings.asc");
      if (after) for (const a of after) url.searchParams.append("after[]", a);
      const res = await fetch(url, { headers: { key } });
      if (!res.ok) throw new Error(`${city} HTTP ${res.status}`);
      const j = (await res.json()) as {
        events?: Record<string, unknown>[];
        after?: string[] | null;
      };
      all.push(...(j.events || []));
      after = j.after;
      if (!after) break;
      await sleep(120);
    }
    return all;
  }

  function classify(oa: {
    uid: number;
    tn: string;
    tok: Set<string>;
    day: string;
    mins: number | null;
    city: string;
    venue: string;
  }): {
    label: MatchLabel;
    score: number;
    match: OdsN | null;
    reasons: string[];
  } {
    if (byUid.has(oa.uid)) {
      return { label: "EXACT", score: 100, match: byUid.get(oa.uid)!, reasons: ["uid"] };
    }
    const cityAll = byCity.get(oa.city) || [];
    const map = new Map<string, OdsN>();
    for (const e of cityAll) {
      const sameDay = e.day === oa.day;
      const d = dice(oa.tok, e.tok);
      if (sameDay || d >= 0.65 || oa.tn === e.tn) map.set(e.id, e);
    }
    let best: { score: number; match: OdsN; reasons: string[] } | null = null;
    for (const e of map.values()) {
      let s = 0;
      const reasons: string[] = [];
      const d = dice(oa.tok, e.tok);
      if (oa.tn === e.tn) {
        s += 40;
        reasons.push("title_exact");
      } else if (d >= 0.85) {
        s += 32;
        reasons.push(`td${d.toFixed(2)}`);
      } else if (d >= 0.65) {
        s += 22;
        reasons.push(`td${d.toFixed(2)}`);
      } else if (d >= 0.45) {
        s += 10;
        reasons.push(`td${d.toFixed(2)}`);
      }
      if (oa.day === e.day) {
        s += 20;
        reasons.push("day");
        if (oa.mins != null && e.mins != null) {
          const df = Math.abs(oa.mins - e.mins);
          if (df <= 5) {
            s += 15;
            reasons.push("time");
          } else if (df <= 30) {
            s += 8;
            reasons.push("near");
          }
        }
      }
      if (
        oa.venue &&
        e.venue &&
        (oa.venue === e.venue || dice(tokens(oa.venue), tokens(e.venue)) >= 0.8)
      ) {
        s += 12;
        reasons.push("venue");
      }
      if (!best || s > best.score) best = { score: s, match: e, reasons };
    }
    if (!best || best.score < 40) {
      return {
        label: "NEW_EVENT",
        score: best?.score || 0,
        match: best?.match || null,
        reasons: best?.reasons || [],
      };
    }
    const r = new Set(best.reasons);
    const strong =
      r.has("title_exact") ||
      [...r].some((x) => x.startsWith("td0.8") || x.startsWith("td0.9"));
    if (best.score >= 70 && strong && r.has("day")) {
      return { label: "EXACT", ...best };
    }
    if (best.score >= 55 && strong) return { label: "PROBABLE", ...best };
    if (best.score >= 45 && (r.has("venue") || r.has("day")) && !strong) {
      return { label: "GRANULARITY", ...best };
    }
    if (best.score >= 40) return { label: "AMBIGUOUS", ...best };
    return { label: "NEW_EVENT", ...best };
  }

  const report: Record<string, unknown> = {};

  for (const city of CITIES) {
    const raws = await fetchCity(city);
    const events = [];
    for (const raw of raws) {
      const title = lang(raw.title as LangString);
      const next = raw.nextTiming as { begin?: string; end?: string } | undefined;
      const first = raw.firstTiming as { begin?: string; end?: string } | undefined;
      const timing = next || first;
      let start = timing?.begin;
      const uid = raw.uid as number | undefined;
      if (!title || !start || uid == null) continue;
      const tms = (raw.timings as Array<{ begin?: string }> | undefined) || [];
      if (!(Date.parse(start) >= from.getTime() && Date.parse(start) <= to.getTime())) {
        const hit = tms.find(
          (t) =>
            t.begin &&
            Date.parse(t.begin) >= from.getTime() &&
            Date.parse(t.begin) <= to.getTime(),
        );
        if (!hit?.begin) continue;
        start = hit.begin;
      }
      const loc = raw.location as
        | { city?: string; adminLevel4?: string; name?: string; insee?: string }
        | undefined;
      const cityRaw = loc?.city || loc?.adminLevel4 || "";
      if (cityCanon(cityRaw) !== cityCanon(city)) continue;
      const oa = {
        uid,
        tn: strip(title),
        tok: tokens(strip(title)),
        day: day(start),
        mins: mins(start),
        city: cityCanon(cityRaw),
        venue: strip(loc?.name || ""),
      };
      const cls = classify(oa);
      const originAgenda = raw.originAgenda as { title?: string; uid?: number } | undefined;
      const keywords = Array.isArray(raw.keywords)
        ? (raw.keywords as unknown[])
            .map((k) => lang(k as LangString) || (typeof k === "string" ? k : ""))
            .filter(Boolean)
        : [];
      events.push({
        uid,
        title,
        city,
        startAt: start,
        endAt: timing?.end || null,
        venue: loc?.name || null,
        insee: loc?.insee || null,
        category: catLabel(raw["categorie-principale"]),
        public: catLabel(raw["type-de-public"]),
        keywords,
        origin: originAgenda?.title || null,
        originUid: originAgenda?.uid || null,
        timingsCount: tms.length,
        description: (lang(raw.description as LangString) || "").slice(0, 360),
        conditions: lang(raw.conditions as LangString),
        matchLabel: cls.label,
        matchScore: cls.score,
        matchOdsTitle: cls.match?.title || null,
        matchOdsId: cls.match?.id || null,
        matchReasons: cls.reasons,
      });
    }
    const uniq = [...new Map(events.map((e) => [e.uid, e])).values()];
    const byLabel: Record<string, number> = {};
    for (const e of uniq) byLabel[e.matchLabel] = (byLabel[e.matchLabel] || 0) + 1;
    report[city] = {
      oaTotal: uniq.length,
      byLabel,
      odsInCity: (byCity.get(cityCanon(city)) || []).length,
      newEvents: uniq
        .filter((e) => e.matchLabel === "NEW_EVENT")
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
      covered: uniq
        .filter((e) => e.matchLabel !== "NEW_EVENT")
        .map((e) => ({
          title: e.title,
          label: e.matchLabel,
          ods: e.matchOdsTitle,
          score: e.matchScore,
        })),
    };
    await sleep(150);
  }

  console.log(
    JSON.stringify(
      {
        window: { from: from.toISOString(), to: to.toISOString(), days: WINDOW_DAYS },
        odsTotal: ods.length,
        keyPresent: true,
        report,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : e);
  process.exit(1);
});
