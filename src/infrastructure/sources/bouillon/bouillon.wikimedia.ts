import { normalizeCandidate } from "./bouillon.title-candidates";
import {
  emptyCandidateDebug,
  type BouillonImageCandidateDebug,
  type BouillonImageDebugReason,
} from "./bouillon.image-debug";

export const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
export const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

/**
 * P31 acceptés (instance of) — liste courte, pas d’inférence de sous-classes.
 * Hors liste / P31 absent → reject (pas de guess).
 */
export const ACCEPTED_WIKIDATA_P31_IDS = new Set([
  "Q5", // human
  "Q215380", // musical group
  "Q105756498", // musical ensemble
  "Q5741069", // rock band
  "Q2088357", // musical ensemble
  "Q11424", // film
  "Q24862", // short film
  "Q25379", // play
  "Q1344", // opera
  "Q2743", // musical
  "Q476928", // dramatico-musical work
  "Q2188189", // musical work
]);

/** Sous-ensemble « film » pour désambiguïsation catégorie Cinéma. */
export const FILM_WIKIDATA_P31_IDS = new Set(["Q11424", "Q24862"]);

export type WikimediaFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type WikimediaImageHit = {
  imageUrl: string;
  imageCredit: string | null;
  imageLicense: string;
  imageSourceUrl: string;
  entityId: string;
  fileTitle: string;
};

export type WikimediaLookupConfig = {
  fetchImpl: WikimediaFetch;
  httpTimeoutMs: number;
  entityCache?: Map<string, WikimediaImageHit | null>;
  /** Catégorie événement (ex. Cinéma) — désambiguïsation film optionnelle. */
  eventCategory?: string | null;
  /** Diagnostic temporaire : rempli candidat par candidat si fourni. */
  debugTraces?: BouillonImageCandidateDebug[];
};

type WikidataSearchResult = {
  id: string;
  label: string;
  aliases?: string[];
};

type WikidataEntityClaims = {
  claims?: {
    P18?: Array<{
      mainsnak?: {
        datavalue?: { value?: string };
      };
    }>;
    P31?: Array<{
      mainsnak?: {
        datavalue?: {
          value?: { id?: string };
        };
      };
    }>;
  };
};

/**
 * Cherche une image Commons réutilisable pour le premier candidat clairement identifié.
 * Ambigu / introuvable / licence incompatible → null (best-effort).
 */
export async function lookupWikimediaImageForCandidates(
  candidates: string[],
  config: WikimediaLookupConfig,
): Promise<WikimediaImageHit | null> {
  for (const candidate of candidates) {
    try {
      const hit = await lookupWikimediaImageForCandidate(candidate, config);
      if (hit) return hit;
    } catch {
      if (config.debugTraces) {
        const trace = emptyCandidateDebug(candidate);
        trace.reason = "lookup_error";
        config.debugTraces.push(trace);
      }
      // best-effort : candidat suivant
    }
  }
  return null;
}

export async function lookupWikimediaImageForCandidate(
  candidate: string,
  config: WikimediaLookupConfig,
): Promise<WikimediaImageHit | null> {
  const trace = emptyCandidateDebug(candidate);

  const { rawCount, exact } = await searchExactWikidataEntitiesWithCounts(
    candidate,
    config,
  );
  trace.searchResultCount = rawCount;
  trace.exactMatches = exact.length;
  trace.entityIds = exact.map((item) => item.id);

  if (exact.length === 0) {
    trace.reason = "no_exact_match";
    config.debugTraces?.push(trace);
    return null;
  }

  const cache = config.entityCache;
  if (exact.length === 1 && cache?.has(exact[0]!.id)) {
    const entityId = exact[0]!.id;
    const cached = cache.get(entityId) ?? null;
    trace.entityId = entityId;
    trace.p31FilteredIds = cached ? [entityId] : [];
    if (cached) {
      trace.p18 = cached.fileTitle;
      trace.commonsFileTitle = cached.fileTitle;
      trace.commonsMetaOk = true;
      trace.licenseNormalized = cached.imageLicense;
      trace.creditFound = Boolean(cached.imageCredit);
      trace.p31Accepted = true;
      trace.reason = "accepted";
    } else {
      trace.reason = "all_candidates_rejected";
    }
    config.debugTraces?.push(trace);
    return cached;
  }

  const selected = await selectExactEntityByP31(exact, config, trace);
  if (!selected) {
    if (exact.length === 1) {
      cache?.set(exact[0]!.id, null);
    }
    config.debugTraces?.push(trace);
    return null;
  }

  const { entityId, entity, p31 } = selected;
  trace.entityId = entityId;
  trace.p31 = p31;
  trace.p31Accepted = true;

  if (cache?.has(entityId)) {
    const cached = cache.get(entityId) ?? null;
    if (cached) {
      trace.p18 = cached.fileTitle;
      trace.commonsFileTitle = cached.fileTitle;
      trace.commonsMetaOk = true;
      trace.licenseNormalized = cached.imageLicense;
      trace.creditFound = Boolean(cached.imageCredit);
      trace.reason = "accepted";
    } else {
      trace.reason = "all_candidates_rejected";
    }
    config.debugTraces?.push(trace);
    return cached;
  }

  const fileTitle = extractImageFileTitle(entity);
  trace.p18 = fileTitle;
  trace.commonsFileTitle = fileTitle;
  if (!fileTitle) {
    trace.reason = "missing_p18";
    config.debugTraces?.push(trace);
    cache?.set(entityId, null);
    return null;
  }

  const commons = await resolveCommonsImageAttribution(fileTitle, config);
  trace.licenseRaw = commons.licenseRaw;
  trace.licenseNormalized = commons.licenseNormalized;
  trace.creditFound = commons.creditFound;
  trace.commonsMetaOk = commons.ok;

  if (!commons.ok) {
    trace.reason = commons.reason;
    config.debugTraces?.push(trace);
    cache?.set(entityId, null);
    return null;
  }

  const hit: WikimediaImageHit = {
    ...commons.meta,
    entityId,
    fileTitle,
  };
  trace.reason = "accepted";
  config.debugTraces?.push(trace);
  cache?.set(entityId, hit);
  return hit;
}

/**
 * 1 exact → P31 allowlist ; >1 exact → filtre P31, accepte seulement s’il en reste 1.
 * Si catégorie Cinéma et encore >1 après allowlist → restreindre aux P31 film.
 */
async function selectExactEntityByP31(
  exact: WikidataSearchResult[],
  config: WikimediaLookupConfig,
  trace: BouillonImageCandidateDebug,
): Promise<{
  entityId: string;
  entity: WikidataEntityClaims;
  p31: string[];
} | null> {
  if (exact.length === 1) {
    const entityId = exact[0]!.id;
    const entity = await fetchEntityClaims(entityId, config);
    if (!entity) {
      trace.reason = "lookup_error";
      return null;
    }
    const p31 = extractInstanceOfIds(entity);
    if (p31.length === 0) {
      trace.p31 = p31;
      trace.p31Accepted = false;
      trace.p31FilteredIds = [];
      trace.reason = "missing_p31";
      return null;
    }
    if (!hasCompatibleWikidataP31(p31)) {
      trace.p31 = p31;
      trace.p31Accepted = false;
      trace.p31FilteredIds = [];
      trace.reason = "invalid_p31";
      return null;
    }
    trace.p31FilteredIds = [entityId];
    return { entityId, entity, p31 };
  }

  const entities = await fetchEntitiesClaims(
    exact.map((item) => item.id),
    config,
  );
  let compatible: Array<{
    entityId: string;
    entity: WikidataEntityClaims;
    p31: string[];
  }> = [];

  for (const item of exact) {
    const entity = entities.get(item.id);
    if (!entity) continue;
    const p31 = extractInstanceOfIds(entity);
    if (!hasCompatibleWikidataP31(p31)) continue;
    compatible.push({ entityId: item.id, entity, p31 });
  }

  if (
    compatible.length > 1 &&
    isBouillonCinemaCategory(config.eventCategory)
  ) {
    compatible = compatible.filter((item) => hasFilmWikidataP31(item.p31));
  }

  trace.p31FilteredIds = compatible.map((item) => item.entityId);
  if (compatible.length !== 1) {
    trace.p31Accepted = false;
    trace.reason = "ambiguous_exact_match";
    return null;
  }

  return compatible[0]!;
}

/** True si la catégorie événement est clairement cinéma / projection. */
export function isBouillonCinemaCategory(
  category: string | null | undefined,
): boolean {
  if (!category) return false;
  return /cin[eé]ma|projection/i.test(category);
}

/** True si au moins un P31 est film / court métrage. */
export function hasFilmWikidataP31(instanceOfIds: string[]): boolean {
  return instanceOfIds.some((id) => FILM_WIKIDATA_P31_IDS.has(id));
}

export async function searchExactWikidataEntities(
  candidate: string,
  config: WikimediaLookupConfig,
): Promise<WikidataSearchResult[]> {
  const { exact } = await searchExactWikidataEntitiesWithCounts(
    candidate,
    config,
  );
  return exact;
}

async function searchExactWikidataEntitiesWithCounts(
  candidate: string,
  config: WikimediaLookupConfig,
): Promise<{ rawCount: number; exact: WikidataSearchResult[] }> {
  const needle = normalizeCandidate(candidate);
  if (!needle) return { rawCount: 0, exact: [] };

  const resultsFr = await wbSearchEntities(candidate, "fr", config);
  const results =
    resultsFr.length > 0
      ? resultsFr
      : await wbSearchEntities(candidate, "en", config);

  const exact = results.filter((item) => {
    if (normalizeCandidate(item.label) === needle) return true;
    return (item.aliases ?? []).some(
      (alias) => normalizeCandidate(alias) === needle,
    );
  });

  return { rawCount: results.length, exact };
}

/** True si au moins un P31 est dans la allowlist explicite. */
export function hasCompatibleWikidataP31(instanceOfIds: string[]): boolean {
  if (instanceOfIds.length === 0) return false;
  return instanceOfIds.some((id) => ACCEPTED_WIKIDATA_P31_IDS.has(id));
}

/** CC BY / CC BY-SA exigent un crédit ; CC0 / Public Domain non. */
export function licenseRequiresCredit(license: string): boolean {
  const normalized = license.trim().toUpperCase();
  return normalized.startsWith("CC BY");
}

async function wbSearchEntities(
  search: string,
  language: string,
  config: WikimediaLookupConfig,
): Promise<WikidataSearchResult[]> {
  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("search", search);
  url.searchParams.set("language", language);
  url.searchParams.set("uselang", language);
  url.searchParams.set("type", "item");
  url.searchParams.set("limit", "8");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const json = (await fetchJson(url, config)) as {
    search?: Array<{
      id?: string;
      label?: string;
      aliases?: string[];
    }>;
  };

  return (json.search ?? [])
    .filter((item) => typeof item.id === "string" && typeof item.label === "string")
    .map((item) => ({
      id: item.id!,
      label: item.label!,
      aliases: Array.isArray(item.aliases) ? item.aliases : [],
    }));
}

async function fetchEntityClaims(
  entityId: string,
  config: WikimediaLookupConfig,
): Promise<WikidataEntityClaims | null> {
  const map = await fetchEntitiesClaims([entityId], config);
  return map.get(entityId) ?? null;
}

async function fetchEntitiesClaims(
  entityIds: string[],
  config: WikimediaLookupConfig,
): Promise<Map<string, WikidataEntityClaims>> {
  const unique = [...new Set(entityIds.filter(Boolean))];
  const out = new Map<string, WikidataEntityClaims>();
  if (unique.length === 0) return out;

  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", unique.join("|"));
  url.searchParams.set("props", "claims");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const json = (await fetchJson(url, config)) as {
    entities?: Record<string, WikidataEntityClaims | undefined>;
  };

  for (const id of unique) {
    const entity = json.entities?.[id];
    if (entity) out.set(id, entity);
  }
  return out;
}

export function extractInstanceOfIds(entity: WikidataEntityClaims): string[] {
  const claims = entity.claims?.P31 ?? [];
  const ids: string[] = [];
  for (const claim of claims) {
    const id = claim.mainsnak?.datavalue?.value?.id;
    if (typeof id === "string" && id.trim()) ids.push(id.trim());
  }
  return ids;
}

function extractImageFileTitle(entity: WikidataEntityClaims): string | null {
  const filename = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (typeof filename !== "string" || !filename.trim()) return null;
  return filename.startsWith("File:") ? filename : `File:${filename}`;
}

type CommonsResolveOk = {
  ok: true;
  meta: Omit<WikimediaImageHit, "entityId" | "fileTitle">;
  licenseRaw: string | null;
  licenseNormalized: string;
  creditFound: boolean;
};

type CommonsResolveFail = {
  ok: false;
  reason: BouillonImageDebugReason;
  licenseRaw: string | null;
  licenseNormalized: string | null;
  creditFound: boolean | null;
};

async function resolveCommonsImageAttribution(
  fileTitle: string,
  config: WikimediaLookupConfig,
): Promise<CommonsResolveOk | CommonsResolveFail> {
  const url = new URL(COMMONS_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", fileTitle);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|extmetadata");
  url.searchParams.set("iiurlwidth", "1280");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const json = (await fetchJson(url, config)) as {
    query?: {
      pages?: Record<
        string,
        {
          imageinfo?: Array<{
            url?: string;
            thumburl?: string;
            descriptionurl?: string;
            extmetadata?: Record<string, { value?: string }>;
          }>;
        }
      >;
    };
  };

  const page = Object.values(json.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) {
    return {
      ok: false,
      reason: "commons_lookup_failed",
      licenseRaw: null,
      licenseNormalized: null,
      creditFound: null,
    };
  }

  const licenseRaw =
    info.extmetadata?.LicenseShortName?.value ??
    info.extmetadata?.License?.value ??
    null;
  const license = normalizeReusableLicense(licenseRaw);
  if (!license) {
    return {
      ok: false,
      reason: "unsupported_license",
      licenseRaw,
      licenseNormalized: null,
      creditFound: null,
    };
  }

  const imageUrl = info.thumburl?.trim() || info.url?.trim();
  if (!imageUrl || !/^https:\/\//i.test(imageUrl)) {
    return {
      ok: false,
      reason: "commons_lookup_failed",
      licenseRaw,
      licenseNormalized: license,
      creditFound: null,
    };
  }

  const imageSourceUrl = info.descriptionurl?.trim();
  if (!imageSourceUrl || !/^https:\/\//i.test(imageSourceUrl)) {
    return {
      ok: false,
      reason: "commons_lookup_failed",
      licenseRaw,
      licenseNormalized: license,
      creditFound: null,
    };
  }

  const credit =
    stripHtml(
      info.extmetadata?.Artist?.value ??
        info.extmetadata?.Credit?.value ??
        info.extmetadata?.Attribution?.value ??
        "",
    ).trim() || null;

  if (licenseRequiresCredit(license) && !credit) {
    return {
      ok: false,
      reason: "missing_credit",
      licenseRaw,
      licenseNormalized: license,
      creditFound: false,
    };
  }

  return {
    ok: true,
    meta: {
      imageUrl,
      imageCredit: credit,
      imageLicense: license,
      imageSourceUrl,
    },
    licenseRaw,
    licenseNormalized: license,
    creditFound: Boolean(credit),
  };
}

export async function fetchCommonsImageAttribution(
  fileTitle: string,
  config: WikimediaLookupConfig,
): Promise<Omit<WikimediaImageHit, "entityId" | "fileTitle"> | null> {
  const resolved = await resolveCommonsImageAttribution(fileTitle, config);
  return resolved.ok ? resolved.meta : null;
}

/**
 * Licences clairement réutilisables uniquement.
 * Retourne un libellé court stable pour l’UI.
 */
export function normalizeReusableLicense(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const value = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return null;

  const lower = value.toLowerCase();

  if (
    lower.includes("noncommercial") ||
    lower.includes("non-commercial") ||
    /\bnc\b/.test(lower) ||
    lower.includes("no derivatives") ||
    /\bnd\b/.test(lower) ||
    lower.includes("fair use") ||
    lower.includes("all rights reserved")
  ) {
    return null;
  }

  if (
    lower === "cc0" ||
    lower.includes("cc0") ||
    lower.includes("creative commons zero")
  ) {
    return "CC0";
  }

  if (
    lower.includes("public domain") ||
    lower === "pd" ||
    lower.includes("pd-") ||
    lower.includes("no known copyright restrictions")
  ) {
    return "Public Domain";
  }

  const bySa = lower.match(/cc\s*by[-\s]?sa(?:\s*(\d+(?:\.\d+)?))?/);
  if (bySa) {
    return bySa[1] ? `CC BY-SA ${bySa[1]}` : "CC BY-SA";
  }

  const by = lower.match(/cc\s*by(?![-\s]?sa)(?:\s*(\d+(?:\.\d+)?))?/);
  if (by || /^attribution$/i.test(value)) {
    return by?.[1] ? `CC BY ${by[1]}` : "CC BY";
  }

  return null;
}

async function fetchJson(
  url: URL,
  config: WikimediaLookupConfig,
): Promise<unknown> {
  const response = await config.fetchImpl(url.toString(), {
    signal: AbortSignal.timeout(config.httpTimeoutMs),
    headers: {
      Accept: "application/json",
      "User-Agent": "DetourBouillonBot/1.0 (+https://detour.local)",
    },
  });
  if (!response.ok) {
    throw new Error(`Wikimedia HTTP ${response.status}`);
  }
  return response.json();
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}
