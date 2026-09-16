/**
 * Spike OpenAgenda Loiret (agenda 36668061) — dry-run Ormes uniquement.
 * Aucune écriture DB / aucun wiring prod.
 *
 * Usage : bun --env-file=.env.local scripts/dry-run-openagenda-loiret.mts
 *
 * Requis : OPENAGENDA_API_KEY (jamais loggée).
 */
import { OrmesEventAdapter } from "../src/infrastructure/sources/ormes/ormes.adapter";
import { OrleansEventAdapter } from "../src/infrastructure/sources/orleans/orleans-event.adapter";

const AGENDA_UID = "36668061";
const ORMES_INSEE = "45235";
const ORMES_CITY = "Ormes";
const WINDOW_DAYS = 180;
const OA_PAGE_SIZE = 100;
const PACE_MS = 200;

type LangString = string | { fr?: string; en?: string } | null | undefined;

type OaLocation = {
  uid?: number;
  name?: string;
  city?: string;
  insee?: string;
  adminLevel4?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  state?: number;
};

type OaTiming = { begin?: string; end?: string };

type OaEvent = {
  uid?: number;
  slug?: string;
  title?: LangString;
  description?: LangString;
  longDescription?: LangString;
  image?: { filename?: string; base?: string } | string | null;
  location?: OaLocation | null;
  firstTiming?: OaTiming | null;
  lastTiming?: OaTiming | null;
  nextTiming?: OaTiming | null;
  timings?: OaTiming[];
  conditions?: LangString;
  registration?: unknown;
  "categorie-principale"?: unknown;
  keywords?: unknown;
  originAgenda?: { uid?: number; title?: string; slug?: string } | null;
  status?: number;
  canonicalUrl?: string;
};

type MappedOa = {
  id: string;
  uid: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startAt: string;
  endAt: string | null;
  timingsCount: number;
  venue: string | null;
  city: string | null;
  insee: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  conditions: string | null;
  source: string | null;
  sourceUrl: string | null;
  registrationUrl: string | null;
  originAgendaUid: number | null;
};

function requireApiKey(): string {
  const key = process.env.OPENAGENDA_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAGENDA_API_KEY manquante (utiliser --env-file=.env.local)");
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function langText(value: LangString): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  const fr = value.fr?.trim();
  if (fr) return fr;
  const en = value.en?.trim();
  return en && en.length > 0 ? en : null;
}

function imageUrl(image: OaEvent["image"]): string | null {
  if (!image) return null;
  if (typeof image === "string") {
    const t = image.trim();
    return t.length > 0 ? t : null;
  }
  // detailed shape often has filename; public CDN pattern
  const filename = image.filename?.trim();
  if (filename) return `https://img.openagenda.com/u/${filename}`;
  return null;
}

function extractRegistrationUrl(registration: unknown): string | null {
  if (!Array.isArray(registration)) return null;
  for (const entry of registration) {
    if (!entry || typeof entry !== "object") continue;
    const { type, value } = entry as { type?: string; value?: string };
    if (type !== "link" || typeof value !== "string") continue;
    const url = value.trim();
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
  }
  return null;
}

function categoryLabel(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") return raw.trim() || null;
  if (typeof raw === "number") return String(raw);
  if (Array.isArray(raw)) {
    const parts = raw.map((x) => categoryLabel(x)).filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  }
  if (typeof raw === "object") {
    const obj = raw as { label?: LangString; fr?: string };
    return langText(obj.label) ?? (obj.fr?.trim() || null);
  }
  return null;
}

function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dayKey(iso: string): string {
  // Compare on Paris calendar day when offset present; else UTC date.
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? iso.slice(0, 10);
}

async function oaGet(
  key: string,
  path: string,
  params: Record<string, string | number | string[] | number[] | undefined>,
): Promise<Record<string, unknown>> {
  const url = new URL(`https://api.openagenda.com/v2${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const item of v) url.searchParams.append(k, String(item));
    } else {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, { headers: { key } });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`OpenAgenda ${path} → HTTP ${res.status}: ${body}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

async function fetchOrmesLocations(key: string): Promise<OaLocation[]> {
  const out: OaLocation[] = [];
  let after: string | number | null | undefined = undefined;
  let guard = 0;

  while (guard++ < 50) {
    const params: Record<string, string | number | undefined> = {
      size: 100,
      detailed: 1,
      search: ORMES_CITY,
    };
    if (after != null) params.after = after;

    const json = await oaGet(key, `/agendas/${AGENDA_UID}/locations`, params);
    const locations = (json.locations as OaLocation[] | undefined) ?? [];
    out.push(...locations);
    after = json.after as string | number | null | undefined;
    if (after == null || locations.length === 0) break;
    await sleep(PACE_MS);
  }

  return out.filter((l) => l.insee === ORMES_INSEE);
}

async function fetchAllOaEvents(
  key: string,
  params: Record<string, string | number | string[] | number[] | undefined>,
): Promise<{ total: number; events: OaEvent[] }> {
  const events: OaEvent[] = [];
  let after: string[] | null | undefined = undefined;
  let total = 0;
  let guard = 0;

  while (guard++ < 100) {
    const pageParams: Record<
      string,
      string | number | string[] | number[] | undefined
    > = {
      ...params,
      size: OA_PAGE_SIZE,
      detailed: 1,
      monolingual: "fr",
      includeLabels: 1,
      "relative[]": ["current", "upcoming"],
      sort: "timings.asc",
    };
    if (after) pageParams["after[]"] = after;

    const json = await oaGet(key, `/agendas/${AGENDA_UID}/events`, pageParams);
    total = Number(json.total ?? 0);
    const page = (json.events as OaEvent[] | undefined) ?? [];
    events.push(...page);
    after = (json.after as string[] | null | undefined) ?? null;
    if (!after || page.length === 0) break;
    await sleep(PACE_MS);
  }

  return { total, events };
}

function mapOaEvent(raw: OaEvent): MappedOa | null {
  if (raw.uid == null) return null;
  const title = langText(raw.title);
  // Préférer nextTiming : firstTiming peut être passé sur les récurrents (marchés).
  const timing = raw.nextTiming ?? raw.firstTiming;
  const startAt = timing?.begin;
  if (!title || !startAt) return null;

  const loc = raw.location ?? null;
  const slug = raw.slug?.trim();
  const sourceUrl = raw.canonicalUrl?.trim()
    ? raw.canonicalUrl.trim()
    : slug
      ? `https://openagenda.com/agendas/${AGENDA_UID}/events/${slug}`
      : null;

  return {
    id: `openagenda:${raw.uid}`,
    uid: raw.uid,
    title,
    description: langText(raw.description),
    imageUrl: imageUrl(raw.image),
    startAt,
    endAt: timing?.end ?? null,
    timingsCount: Array.isArray(raw.timings) ? raw.timings.length : 0,
    venue: loc?.name?.trim() || null,
    city: loc?.city?.trim() || loc?.adminLevel4?.trim() || null,
    insee: loc?.insee?.trim() || null,
    latitude: loc?.latitude ?? null,
    longitude: loc?.longitude ?? null,
    category: categoryLabel(raw["categorie-principale"]),
    conditions: langText(raw.conditions),
    source: raw.originAgenda?.title?.trim() || "OpenAgenda Loiret",
    sourceUrl,
    registrationUrl: extractRegistrationUrl(raw.registration),
    originAgendaUid: raw.originAgenda?.uid ?? null,
  };
}

function fieldCoverage(events: MappedOa[]) {
  const keys = [
    "title",
    "description",
    "imageUrl",
    "startAt",
    "endAt",
    "venue",
    "city",
    "insee",
    "latitude",
    "longitude",
    "category",
    "conditions",
    "source",
    "sourceUrl",
    "registrationUrl",
  ] as const;

  const coverage: Record<string, { filled: number; rate: number }> = {};
  for (const key of keys) {
    const filled = events.filter((e) => {
      const v = e[key];
      return v != null && String(v).trim() !== "";
    }).length;
    coverage[key] = {
      filled,
      rate: events.length === 0 ? 0 : Number((filled / events.length).toFixed(3)),
    };
  }
  return coverage;
}

async function main() {
  const key = requireApiKey();
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + WINDOW_DAYS);

  // --- OpenAgenda: locations INSEE + events adminLevel4 ---
  const ormesLocations = await fetchOrmesLocations(key);
  const locationUids = ormesLocations
    .map((l) => l.uid)
    .filter((u): u is number => typeof u === "number");

  await sleep(PACE_MS);
  const byCity = await fetchAllOaEvents(key, {
    "adminLevel4[]": ORMES_CITY,
  });

  await sleep(PACE_MS);
  const byLocationUid =
    locationUids.length > 0
      ? await fetchAllOaEvents(key, {
          "locationUid[]": locationUids,
        })
      : { total: 0, events: [] as OaEvent[] };

  const cityMapped = byCity.events
    .map(mapOaEvent)
    .filter((e): e is MappedOa => e != null);
  const inseeOk = cityMapped.filter((e) => e.insee === ORMES_INSEE);
  const inseeMismatch = cityMapped.filter((e) => e.insee !== ORMES_INSEE);

  const locMapped = byLocationUid.events
    .map(mapOaEvent)
    .filter((e): e is MappedOa => e != null);

  // Prefer INSEE-verified city filter as primary corpus
  const oaEvents = inseeOk;

  const multiTiming = oaEvents.filter((e) => e.timingsCount > 1);
  const timingStats = {
    events: oaEvents.length,
    multiTimingCount: multiTiming.length,
    maxTimings: oaEvents.reduce((m, e) => Math.max(m, e.timingsCount), 0),
    totalTimingSlots: oaEvents.reduce((s, e) => s + Math.max(e.timingsCount, 1), 0),
  };

  // --- Municipal Ormes ---
  const municipal = await new OrmesEventAdapter().collectUpcomingEvents({
    from,
    to,
  });

  // --- Orleans Opendatasoft (métropole) — fenêtre + filtre ville Ormes ---
  const orleansAll = await new OrleansEventAdapter().fetchUpcomingEvents({
    from,
    to,
  });
  const orleansOrmes = orleansAll.filter(
    (e) => (e.city ?? "").trim().toLowerCase() === "ormes",
  );

  // --- Matching ---
  const oaByUid = new Map(oaEvents.map((e) => [e.id, e]));
  const orleansById = new Map(orleansOrmes.map((e) => [e.id, e]));

  const uidOverlapWithOrleans = oaEvents.filter((e) => orleansById.has(e.id));

  const municipalNorm = municipal.events.map((e) => ({
    id: e.id,
    title: e.title,
    norm: normalizeTitle(e.title),
    day: dayKey(e.startAt),
    startAt: e.startAt,
  }));
  const oaNorm = oaEvents.map((e) => ({
    id: e.id,
    title: e.title,
    norm: normalizeTitle(e.title),
    day: dayKey(e.startAt),
    startAt: e.startAt,
  }));

  const titleDayMatches: Array<{
    oaId: string;
    oaTitle: string;
    municipalId: string;
    municipalTitle: string;
    day: string;
  }> = [];
  const municipalOnly: typeof municipalNorm = [];
  const matchedMunicipalIds = new Set<string>();

  for (const m of municipalNorm) {
    const hit = oaNorm.find(
      (o) => o.norm === m.norm && o.day === m.day && !matchedMunicipalIds.has(m.id),
    );
    if (hit) {
      matchedMunicipalIds.add(m.id);
      titleDayMatches.push({
        oaId: hit.id,
        oaTitle: hit.title,
        municipalId: m.id,
        municipalTitle: m.title,
        day: m.day,
      });
    } else {
      municipalOnly.push(m);
    }
  }

  const matchedOaIds = new Set(titleDayMatches.map((m) => m.oaId));
  const oaOnly = oaNorm.filter((o) => !matchedOaIds.has(o.id));

  // Fuzzy: same normalized title, any day
  const titleOnlyMunicipalHits = municipalNorm.filter((m) =>
    oaNorm.some((o) => o.norm === m.norm),
  ).length;

  const jepMunicipal = municipal.events.filter((e) =>
    /patrimoine|jep/i.test(e.title),
  );
  const jepOa = oaEvents.filter(
    (e) =>
      /patrimoine|jep/i.test(e.source ?? "") ||
      e.originAgendaUid === 54621 ||
      /vernissage|grande guerre|tadam|repas partage/i.test(e.title),
  );
  const softThematicOverlap = {
    note: "Le municipal publie 1 fiche JEP agrégée; OA Loiret publie les sessions JEP détaillées le même jour",
    municipalJep: jepMunicipal.map((e) => ({
      id: e.id,
      title: e.title,
      startAt: e.startAt,
    })),
    oaJepSessions: jepOa.map((e) => ({
      id: e.id,
      title: e.title,
      startAt: e.startAt,
    })),
  };

  const coverage = fieldCoverage(oaEvents);

  // --- GO / NO-GO heuristics ---
  const reasonsGo: string[] = [];
  const reasonsNoGo: string[] = [];

  if (oaEvents.length === 0) {
    reasonsNoGo.push("Aucun événement Ormes (INSEE 45235) courant/à venir sur l'agenda Loiret");
  } else {
    reasonsGo.push(
      `${oaEvents.length} événement(s) Ormes INSEE-vérifiés via adminLevel4`,
    );
  }

  if (inseeMismatch.length > 0) {
    reasonsNoGo.push(
      `${inseeMismatch.length} événement(s) adminLevel4=Ormes avec INSEE ≠ ${ORMES_INSEE}`,
    );
  } else if (oaEvents.length > 0) {
    reasonsGo.push("Filtre adminLevel4=Ormes aligné à 100% sur INSEE 45235");
  }

  if (uidOverlapWithOrleans.length > 0) {
    reasonsNoGo.push(
      `${uidOverlapWithOrleans.length} uid OpenAgenda déjà présents dans le corpus orleans (ids openagenda:*) → risque de doublons durs si même schéma d'id`,
    );
  } else if (oaEvents.length > 0) {
    reasonsGo.push(
      "Aucun chevauchement d'uid avec orleans (Opendatasoft métropole) sur city=Ormes",
    );
  }

  if (timingStats.multiTimingCount > 0) {
    reasonsNoGo.push(
      `${timingStats.multiTimingCount}/${timingStats.events} events multi-timings (max ${timingStats.maxTimings}) — granularité à trancher (1 row/event vs 1 row/timing comme orleans)`,
    );
  } else if (oaEvents.length > 0) {
    reasonsGo.push("Granularité simple: 1 timing par événement sur le corpus Ormes actuel");
  }

  const municipalPublished = municipal.events.length;
  if (municipalPublished > 0 && titleDayMatches.length === 0 && oaEvents.length > 0) {
    if (jepMunicipal.length > 0 && jepOa.length > 0) {
      reasonsGo.push(
        `Overlap thématique JEP: municipal agrégé (${jepMunicipal.length}) vs OA sessions (${jepOa.length}) le même week-end — granularité différente, pas doublon title-exact`,
      );
    } else {
      reasonsNoGo.push(
        "Aucun match title+jour avec le municipal — corpus OA potentiellement disjoint vs culture mairie",
      );
    }
  }
  if (titleDayMatches.length > 0) {
    reasonsGo.push(
      `${titleDayMatches.length} match(s) title+jour avec municipal Ormes`,
    );
  }
  if (oaOnly.length > 0 && oaEvents.length > 0) {
    reasonsGo.push(
      `${oaOnly.length} événement(s) OA absents du municipal (couverture complémentaire possible)`,
    );
  }

  // Ne remplace PAS le municipal: complément JEP/tourisme seulement.
  const replacesMunicipal = titleDayMatches.length >= Math.ceil(municipalPublished * 0.5);
  if (!replacesMunicipal && oaEvents.length > 0) {
    reasonsNoGo.push(
      "Ne remplace pas le calendrier culture municipal (majorité des fiches mairie absentes d'OA)",
    );
  }

  let verdict: "GO" | "NO-GO" | "GO_WITH_CAVEATS" = "NO-GO";
  if (oaEvents.length === 0 || inseeMismatch.length > 0) {
    verdict = "NO-GO";
  } else if (uidOverlapWithOrleans.length > 0) {
    // Collision dure d'ids si on réutilise openagenda: — mitigeable via préfixe dédié
    verdict = "GO_WITH_CAVEATS";
  } else if (
    timingStats.multiTimingCount > 0 ||
    !replacesMunicipal ||
    (municipalPublished > 0 && titleDayMatches.length === 0 && jepOa.length === 0)
  ) {
    verdict = "GO_WITH_CAVEATS";
  } else {
    verdict = "GO";
  }

  const proposedLayout =
    verdict === "NO-GO"
      ? null
      : {
          note: "Proposition uniquement — non créé",
          files: [
            "src/infrastructure/sources/openagenda-loiret/openagenda-loiret.types.ts",
            "src/infrastructure/sources/openagenda-loiret/openagenda-loiret.client.ts",
            "src/infrastructure/sources/openagenda-loiret/openagenda-loiret.mapper.ts",
            "src/infrastructure/sources/openagenda-loiret/openagenda-loiret.adapter.ts",
            "scripts/dry-run-openagenda-loiret.mts (garder)",
          ],
          idScheme: "openagenda-loiret:{uid} (éviter openagenda: pour ne pas collisionner orleans)",
          filter: "adminLevel4=Ormes + assert location.insee===45235 (fail-closed)",
          env: "OPENAGENDA_API_KEY (header key) — lecture publique",
          wiring: "ne pas brancher createDetourSyncSources tant que GO confirmé produit",
        };

  const report = {
    spike: "openagenda-loiret-ormes",
    agendaUid: AGENDA_UID,
    window: { from: from.toISOString(), to: to.toISOString(), days: WINDOW_DAYS },
    auth: {
      keyPresent: true,
      keyLength: key.length,
      // jamais la valeur
    },
    locations: {
      insee: ORMES_INSEE,
      count: ormesLocations.length,
      uids: locationUids,
      names: ormesLocations.map((l) => l.name),
    },
    openagenda: {
      filterAdminLevel4: {
        apiTotal: byCity.total,
        fetched: byCity.events.length,
        mapped: cityMapped.length,
        inseeOk: inseeOk.length,
        inseeMismatch: inseeMismatch.map((e) => ({
          id: e.id,
          title: e.title,
          city: e.city,
          insee: e.insee,
        })),
      },
      filterLocationUid: {
        apiTotal: byLocationUid.total,
        fetched: byLocationUid.events.length,
        mapped: locMapped.length,
      },
      events: oaEvents.map((e) => ({
        id: e.id,
        title: e.title,
        startAt: e.startAt,
        endAt: e.endAt,
        timingsCount: e.timingsCount,
        venue: e.venue,
        city: e.city,
        insee: e.insee,
        category: e.category,
        source: e.source,
        originAgendaUid: e.originAgendaUid,
        sourceUrl: e.sourceUrl,
        hasDescription: Boolean(e.description),
        hasImage: Boolean(e.imageUrl),
        hasRegistration: Boolean(e.registrationUrl),
      })),
      fieldCoverage: coverage,
      timingStats,
    },
    municipalOrmes: {
      stats: municipal.stats,
      publishedCount: municipal.events.length,
      exclusionCount: municipal.exclusions.length,
      events: municipal.events.map((e) => ({
        id: e.id,
        title: e.title,
        startAt: e.startAt,
        venue: e.venue,
        sourceUrl: e.sourceUrl,
      })),
      exclusions: municipal.exclusions.map((e) => ({
        id: e.id,
        title: e.title,
        reason: e.reason,
      })),
    },
    orleansComparison: {
      orleansTotalWindow: orleansAll.length,
      orleansCityOrmes: orleansOrmes.length,
      orleansOrmesEvents: orleansOrmes.map((e) => ({
        id: e.id,
        title: e.title,
        startAt: e.startAt,
        venue: e.venue,
        source: e.source,
      })),
      hardUidOverlap: uidOverlapWithOrleans.map((e) => ({
        id: e.id,
        title: e.title,
        oaStart: e.startAt,
        orleansStart: oaByUid.get(e.id)
          ? orleansById.get(e.id)?.startAt
          : null,
      })),
    },
    matching: {
      titleDayMatches,
      municipalOnly: municipalOnly.map((m) => ({
        id: m.id,
        title: m.title,
        startAt: m.startAt,
      })),
      oaOnly: oaOnly.map((o) => ({
        id: o.id,
        title: o.title,
        startAt: o.startAt,
      })),
      titleOnlyMunicipalHitCount: titleOnlyMunicipalHits,
      softThematicOverlap,
    },
    verdict,
    reasonsGo,
    reasonsNoGo,
    proposedLayout,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
