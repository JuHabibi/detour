import {
  normalizeCandidate,
} from "./bouillon.title-candidates";
import {
  licenseRequiresCredit,
} from "./bouillon.wikimedia";

export const OPENVERSE_IMAGES_API = "https://api.openverse.org/v1/images/";

export type OpenverseFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type OpenverseImageHit = {
  imageUrl: string;
  imageCredit: string | null;
  imageLicense: string;
  imageSourceUrl: string;
};

export type OpenverseLookupConfig = {
  fetchImpl: OpenverseFetch;
  httpTimeoutMs: number;
  /** Cache process-local par candidat normalisé. */
  candidateCache?: Map<string, OpenverseImageHit | null>;
};

type OpenverseTag = { name?: string } | string;

type OpenverseSearchResult = {
  id?: string;
  title?: string | null;
  creator?: string | null;
  license?: string | null;
  license_version?: string | null;
  thumbnail?: string | null;
  url?: string | null;
  foreign_landing_url?: string | null;
  tags?: OpenverseTag[] | null;
  width?: number | null;
  height?: number | null;
};

/**
 * Openverse en second recours après Wikimedia.
 * Matching exact uniquement ; 0 ou >1 hit clair → null.
 */
export async function lookupOpenverseImageForCandidates(
  candidates: string[],
  config: OpenverseLookupConfig,
): Promise<OpenverseImageHit | null> {
  for (const candidate of candidates) {
    try {
      const hit = await lookupOpenverseImageForCandidate(candidate, config);
      if (hit) return hit;
    } catch {
      // best-effort
    }
  }
  return null;
}

export async function lookupOpenverseImageForCandidate(
  candidate: string,
  config: OpenverseLookupConfig,
): Promise<OpenverseImageHit | null> {
  const cacheKey = normalizeCandidate(candidate);
  if (!cacheKey) return null;

  const cache = config.candidateCache;
  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
  }

  const results = await searchOpenverseImages(candidate, config);
  const clear = results.filter((item) => isClearExactMatch(candidate, item));
  if (clear.length !== 1) {
    cache?.set(cacheKey, null);
    return null;
  }

  const mapped = mapOpenverseResultToHit(clear[0]!);
  cache?.set(cacheKey, mapped);
  return mapped;
}

export async function searchOpenverseImages(
  candidate: string,
  config: OpenverseLookupConfig,
): Promise<OpenverseSearchResult[]> {
  const url = new URL(OPENVERSE_IMAGES_API);
  url.searchParams.set("q", candidate);
  url.searchParams.set("page_size", "5");
  url.searchParams.set("license", "cc0,pdm,by,by-sa");
  url.searchParams.set("mature", "false");

  const response = await config.fetchImpl(url.toString(), {
    signal: AbortSignal.timeout(config.httpTimeoutMs),
    headers: {
      Accept: "application/json",
      "User-Agent": "DetourBouillonBot/1.0 (+https://detour.local)",
    },
  });
  if (!response.ok) {
    throw new Error(`Openverse HTTP ${response.status}`);
  }

  const json = (await response.json()) as {
    results?: OpenverseSearchResult[];
  };
  return Array.isArray(json.results) ? json.results : [];
}

/** Titre / créateur / tag : égalité normalisée uniquement. */
export function isClearExactMatch(
  candidate: string,
  result: OpenverseSearchResult,
): boolean {
  const needle = normalizeCandidate(candidate);
  if (!needle) return false;

  if (normalizeCandidate(result.title ?? "") === needle) return true;
  if (normalizeCandidate(result.creator ?? "") === needle) return true;

  for (const tag of result.tags ?? []) {
    const name = typeof tag === "string" ? tag : (tag?.name ?? "");
    if (normalizeCandidate(name) === needle) return true;
  }
  return false;
}

export function mapOpenverseResultToHit(
  result: OpenverseSearchResult,
): OpenverseImageHit | null {
  const license = normalizeOpenverseLicense(
    result.license,
    result.license_version,
  );
  if (!license) return null;

  const thumbnail = result.thumbnail?.trim();
  if (!thumbnail || !/^https:\/\/api\.openverse\.org\//i.test(thumbnail)) {
    return null;
  }

  const imageSourceUrl = result.foreign_landing_url?.trim();
  if (!imageSourceUrl || !/^https?:\/\//i.test(imageSourceUrl)) {
    return null;
  }

  const credit = result.creator?.trim() || null;
  if (licenseRequiresCredit(license) && !credit) {
    return null;
  }

  // Même host thumbnail ; full_size=true = image pleine via le proxy Openverse
  // (meilleure qualité cards, sans ouvrir next.config aux CDN d’origine).
  return {
    imageUrl: withFullSizeThumbnail(thumbnail),
    imageCredit: credit,
    imageLicense: license,
    imageSourceUrl,
  };
}

/**
 * Codes licence Openverse → libellés Détour.
 * `by` / `by-sa` / `cc0` / `pdm` seulement.
 */
export function normalizeOpenverseLicense(
  license: string | null | undefined,
  version?: string | null,
): string | null {
  if (!license) return null;
  const code = license.trim().toLowerCase();
  if (!code) return null;

  if (
    code.includes("nc") ||
    code.includes("nd") ||
    code === "sampling+" ||
    code === "nc-sampling+"
  ) {
    return null;
  }

  const ver = version?.trim();

  if (code === "cc0") return "CC0";
  if (code === "pdm") return "Public Domain";
  if (code === "by-sa") return ver ? `CC BY-SA ${ver}` : "CC BY-SA";
  if (code === "by") return ver ? `CC BY ${ver}` : "CC BY";
  return null;
}

function withFullSizeThumbnail(thumbnail: string): string {
  try {
    const url = new URL(thumbnail);
    url.searchParams.set("full_size", "true");
    return url.toString();
  } catch {
    return thumbnail;
  }
}
