import type { BouillonDetail } from "./bouillon.types";

/**
 * Ratio width/height au-delà duquel l’image Université est traitée comme bannière.
 *
 * Observé sur les fiches Bouillon (Mona Guba, Jesus Christ Superstar) :
 * attributs HTML `width="2800" height="654"` → ratio ≈ 4.28.
 * Une photo paysage « normale » (16:9 ≈ 1.78) reste sous ce seuil ;
 * 2.0 marque clairement une bande typographique trop horizontale pour les cards.
 */
export const BOUILLON_BANNER_ASPECT_RATIO_THRESHOLD = 2;

const BILLETWEB_HOST_RE = /^https?:\/\/(?:www\.)?billetweb\.fr\//i;
const JSON_LD_RE =
  /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const OG_IMAGE_RE =
  /<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/gi;
const OG_IMAGE_RE_ALT =
  /<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/gi;

export type BouillonImageFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type BouillonImageEnrichConfig = {
  fetchImpl: BouillonImageFetch;
  httpTimeoutMs: number;
};

/** True si dimensions HTML fiables et ratio clairement banner-like. */
export function isBannerLikeUniversityImage(detail: {
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
}): boolean {
  if (!detail.imageUrl) return false;
  const { imageWidth: width, imageHeight: height } = detail;
  if (width == null || height == null || width <= 0 || height <= 0) {
    return false;
  }
  return width / height > BOUILLON_BANNER_ASPECT_RATIO_THRESHOLD;
}

export function shouldEnrichBouillonImageFromBilletweb(
  detail: Pick<
    BouillonDetail,
    "imageUrl" | "imageWidth" | "imageHeight" | "registrationUrl"
  >,
): boolean {
  if (!detail.registrationUrl || !BILLETWEB_HOST_RE.test(detail.registrationUrl)) {
    return false;
  }
  return isBannerLikeUniversityImage(detail);
}

/**
 * Enrichissement best-effort : ne throw jamais vers le sync.
 * Remplace uniquement `imageUrl` si une meilleure image Billetweb est trouvée.
 */
export async function enrichBouillonDetailImage(
  detail: BouillonDetail,
  config: BouillonImageEnrichConfig,
): Promise<BouillonDetail> {
  if (!shouldEnrichBouillonImageFromBilletweb(detail)) {
    return detail;
  }

  const registrationUrl = detail.registrationUrl;
  if (!registrationUrl) return detail;

  try {
    const html = await fetchBilletwebHtml(registrationUrl, config);
    const billetwebImageUrl = parseBilletwebEventImageUrl(html);
    if (!billetwebImageUrl) return detail;
    return { ...detail, imageUrl: billetwebImageUrl };
  } catch {
    return detail;
  }
}

/**
 * Image événement Billetweb (pas la bannière page/thumb).
 * Priorité : JSON-LD `Event.image` normalisé, puis `og:image` `/files/event/`.
 */
export function parseBilletwebEventImageUrl(html: string): string | null {
  if (typeof html !== "string" || html.trim().length === 0) return null;

  const fromJsonLd = extractJsonLdEventImage(html);
  if (fromJsonLd) return fromJsonLd;

  for (const candidate of extractOgImages(html)) {
    const normalized = normalizeBilletwebImageUrl(candidate);
    if (isBilletwebEventFileImage(normalized)) {
      return stripQuery(normalized);
    }
  }

  return null;
}

function extractJsonLdEventImage(html: string): string | null {
  JSON_LD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = JSON_LD_RE.exec(html)) !== null) {
    const raw = match[1]!.trim();
    if (!raw) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    for (const node of flattenJsonLdNodes(parsed)) {
      if (!isEventNode(node)) continue;
      const image = node.image;
      const urls = Array.isArray(image)
        ? image
        : typeof image === "string"
          ? [image]
          : [];
      for (const entry of urls) {
        if (typeof entry !== "string") continue;
        const normalized = normalizeBilletwebImageUrl(entry.trim());
        if (isBilletwebEventFileImage(normalized)) {
          return stripQuery(normalized);
        }
      }
    }
  }
  return null;
}

function extractOgImages(html: string): string[] {
  const urls: string[] = [];
  for (const re of [OG_IMAGE_RE, OG_IMAGE_RE_ALT]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      const value = match[1]?.trim();
      if (value) urls.push(value);
    }
  }
  return urls;
}

function flattenJsonLdNodes(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenJsonLdNodes(item));
  }
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const nested = record["@graph"];
  if (Array.isArray(nested)) {
    return [record, ...nested.flatMap((item) => flattenJsonLdNodes(item))];
  }
  return [record];
}

function isEventNode(node: Record<string, unknown>): boolean {
  const type = node["@type"];
  if (typeof type === "string") {
    return type.toLowerCase() === "event";
  }
  if (Array.isArray(type)) {
    return type.some(
      (entry) => typeof entry === "string" && entry.toLowerCase() === "event",
    );
  }
  return false;
}

/**
 * JSON-LD Billetweb expose parfois `/event/{org}/{id}.jpg` (404) ;
 * l’asset réel est sous `/files/event/{org}/{id}.jpg` (présent aussi en og:image).
 */
export function normalizeBilletwebImageUrl(url: string): string {
  return url.replace(
    /^(https?:\/\/(?:www\.)?billetweb\.fr)\/event\//i,
    "$1/files/event/",
  );
}

function isBilletwebEventFileImage(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!/(?:^|\.)billetweb\.fr$/i.test(parsed.hostname)) return false;
    return /\/files\/event\/\d+\/\d+\.(jpe?g|png|webp)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function stripQuery(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.split("?")[0] ?? url;
  }
}

async function fetchBilletwebHtml(
  url: string,
  config: BouillonImageEnrichConfig,
): Promise<string> {
  const response = await config.fetchImpl(url, {
    signal: AbortSignal.timeout(config.httpTimeoutMs),
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "DetourBouillonBot/1.0 (+https://detour.local)",
    },
  });
  if (!response.ok) {
    throw new Error(`Billetweb HTTP ${response.status}`);
  }
  return response.text();
}
