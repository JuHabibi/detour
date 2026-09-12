import { normalizeCandidate } from "./bouillon.title-candidates";

export const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
export const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

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
  /** Cache process-local entityId → hit|null pour éviter les refetch dans un sync. */
  entityCache?: Map<string, WikimediaImageHit | null>;
};

type WikidataSearchResult = {
  id: string;
  label: string;
  aliases?: string[];
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
      // best-effort : candidat suivant
    }
  }
  return null;
}

export async function lookupWikimediaImageForCandidate(
  candidate: string,
  config: WikimediaLookupConfig,
): Promise<WikimediaImageHit | null> {
  const matches = await searchExactWikidataEntities(candidate, config);
  if (matches.length !== 1) return null;

  const entityId = matches[0]!.id;
  const cache = config.entityCache;
  if (cache?.has(entityId)) {
    return cache.get(entityId) ?? null;
  }

  const fileTitle = await fetchEntityImageFileTitle(entityId, config);
  if (!fileTitle) {
    cache?.set(entityId, null);
    return null;
  }

  const meta = await fetchCommonsImageAttribution(fileTitle, config);
  if (!meta) {
    cache?.set(entityId, null);
    return null;
  }

  const hit: WikimediaImageHit = {
    ...meta,
    entityId,
    fileTitle,
  };
  cache?.set(entityId, hit);
  return hit;
}

export async function searchExactWikidataEntities(
  candidate: string,
  config: WikimediaLookupConfig,
): Promise<WikidataSearchResult[]> {
  const needle = normalizeCandidate(candidate);
  if (!needle) return [];

  const resultsFr = await wbSearchEntities(candidate, "fr", config);
  const results =
    resultsFr.length > 0
      ? resultsFr
      : await wbSearchEntities(candidate, "en", config);

  return results.filter((item) => {
    if (normalizeCandidate(item.label) === needle) return true;
    return (item.aliases ?? []).some(
      (alias) => normalizeCandidate(alias) === needle,
    );
  });
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

async function fetchEntityImageFileTitle(
  entityId: string,
  config: WikimediaLookupConfig,
): Promise<string | null> {
  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", entityId);
  url.searchParams.set("props", "claims");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const json = (await fetchJson(url, config)) as {
    entities?: Record<
      string,
      {
        claims?: {
          P18?: Array<{
            mainsnak?: {
              datavalue?: { value?: string };
            };
          }>;
        };
      }
    >;
  };

  const filename =
    json.entities?.[entityId]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (typeof filename !== "string" || !filename.trim()) return null;
  return filename.startsWith("File:") ? filename : `File:${filename}`;
}

export async function fetchCommonsImageAttribution(
  fileTitle: string,
  config: WikimediaLookupConfig,
): Promise<Omit<WikimediaImageHit, "entityId" | "fileTitle"> | null> {
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
  if (!info) return null;

  const licenseRaw =
    info.extmetadata?.LicenseShortName?.value ??
    info.extmetadata?.License?.value ??
    null;
  const license = normalizeReusableLicense(licenseRaw);
  if (!license) return null;

  const imageUrl = info.thumburl?.trim() || info.url?.trim();
  if (!imageUrl || !/^https:\/\//i.test(imageUrl)) return null;

  const imageSourceUrl = info.descriptionurl?.trim();
  if (!imageSourceUrl || !/^https:\/\//i.test(imageSourceUrl)) return null;

  const credit =
    stripHtml(
      info.extmetadata?.Artist?.value ??
        info.extmetadata?.Credit?.value ??
        info.extmetadata?.Attribution?.value ??
        "",
    ).trim() || null;

  return {
    imageUrl,
    imageCredit: credit,
    imageLicense: license,
    imageSourceUrl,
  };
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
