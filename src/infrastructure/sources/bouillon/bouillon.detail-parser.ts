import type { BouillonDetail } from "./bouillon.types";
import { normalizeBouillonPath } from "./bouillon.list-parser";

export const BOUILLON_ORIGIN = "https://www.univ-orleans.fr";

const CANONICAL_RE = /rel="canonical"\s+href="([^"]+)"/i;
const SYSTEM_PATH_RE = /data-drupal-link-system-path="node\/(\d+)"/i;
const TITLE_RE = /<h1\s+class="page-header">\s*([\s\S]*?)\s*<\/h1>/i;
const TIME_RE = /<time\b[^>]*datetime="([^"]+)"[^>]*>/gi;
const IMAGE_FIELD_RE =
  /field--name-field-univ-media-image[\s\S]*?<img\b([^>]+)>/i;
const IMG_SRC_RE = /\bsrc="([^"]+)"/i;
const IMG_WIDTH_RE = /\bwidth="(\d+)"/i;
const IMG_HEIGHT_RE = /\bheight="(\d+)"/i;
const BODY_RE =
  /field--name-body\s+field--type-text-with-summary[\s\S]*?field--item">([\s\S]*?)<\/div>\s*<\/div>/i;
const BILLETWEB_RE =
  /https?:\/\/(?:www\.)?billetweb\.fr\/[^\s"'<>]+/gi;
const LAT_LON_RE = /"lat"\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*"lon"\s*:\s*(-?\d+(?:\.\d+)?)/g;

/**
 * Parse une fiche HTML `/fr/culture/agenda-actualites/...`.
 */
export function parseBouillonDetail(
  html: string,
  options: {
    fallbackPath?: string;
    category?: string | null;
  } = {},
): BouillonDetail {
  if (typeof html !== "string" || html.trim().length === 0) {
    throw new Error("Bouillon detail: empty HTML");
  }

  const nid = SYSTEM_PATH_RE.exec(html)?.[1];
  if (!nid) {
    throw new Error("Bouillon detail: missing node id");
  }

  const titleRaw = TITLE_RE.exec(html)?.[1];
  if (!titleRaw) {
    throw new Error(`Bouillon detail node-${nid}: missing title`);
  }
  const title = decodeHtmlEntities(stripTags(titleRaw)).trim();
  if (!title) {
    throw new Error(`Bouillon detail node-${nid}: empty title`);
  }

  const canonicalUrl =
    CANONICAL_RE.exec(html)?.[1] ??
    (options.fallbackPath
      ? absoluteBouillonUrl(options.fallbackPath)
      : absoluteBouillonUrl(`/node/${nid}`));

  const path = pathFromCanonical(canonicalUrl, options.fallbackPath);

  const times = extractTimes(html);
  if (times.length === 0) {
    throw new Error(`Bouillon detail node-${nid}: missing datetime`);
  }
  const startAt = times[0]!;
  const endAt = times.length >= 2 ? times[1]! : null;
  if (Number.isNaN(Date.parse(startAt))) {
    throw new Error(`Bouillon detail node-${nid}: unparseable start datetime`);
  }
  if (endAt && Number.isNaN(Date.parse(endAt))) {
    throw new Error(`Bouillon detail node-${nid}: unparseable end datetime`);
  }

  const bodyMatch = BODY_RE.exec(html);
  const bodyText = bodyMatch
    ? decodeHtmlEntities(stripTags(bodyMatch[1]!)).trim() || null
    : null;

  const image = extractUniversityImage(html);

  return {
    nid,
    title,
    path,
    canonicalUrl,
    bodyText,
    imageUrl: image.url,
    imageWidth: image.width,
    imageHeight: image.height,
    startAt,
    endAt,
    ...extractCoordinates(html),
    registrationUrl: extractRegistrationUrl(html),
    category: options.category?.trim() || null,
  };
}

export function absoluteBouillonUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${BOUILLON_ORIGIN}${path}`;
}

function pathFromCanonical(
  canonicalUrl: string,
  fallbackPath?: string,
): string {
  try {
    const url = new URL(canonicalUrl);
    if (url.pathname.includes("/culture/agenda-actualites/")) {
      return normalizeBouillonPath(url.pathname);
    }
  } catch {
    // fallback below
  }
  if (fallbackPath) return normalizeBouillonPath(fallbackPath);
  throw new Error(`Bouillon detail: cannot resolve path from ${canonicalUrl}`);
}

function extractTimes(html: string): string[] {
  const times: string[] = [];
  TIME_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TIME_RE.exec(html)) !== null) {
    const value = match[1]!.trim();
    if (value) times.push(value);
  }
  return times;
}

function extractUniversityImage(html: string): {
  url: string | null;
  width: number | null;
  height: number | null;
} {
  const field = IMAGE_FIELD_RE.exec(html)?.[1];
  if (!field) {
    return { url: null, width: null, height: null };
  }

  const src = IMG_SRC_RE.exec(field)?.[1];
  const decoded = src ? decodeHtmlEntities(src).trim() : "";
  const url = decoded
    ? absoluteBouillonUrl(decoded.split("?")[0]!)
    : null;

  const widthRaw = IMG_WIDTH_RE.exec(field)?.[1];
  const heightRaw = IMG_HEIGHT_RE.exec(field)?.[1];
  const width = widthRaw ? Number.parseInt(widthRaw, 10) : Number.NaN;
  const height = heightRaw ? Number.parseInt(heightRaw, 10) : Number.NaN;

  return {
    url,
    width: Number.isFinite(width) && width > 0 ? width : null,
    height: Number.isFinite(height) && height > 0 ? height : null,
  };
}

function extractRegistrationUrl(html: string): string | null {
  BILLETWEB_RE.lastIndex = 0;
  const match = BILLETWEB_RE.exec(html);
  if (!match) return null;
  return match[0]!.replace(/[),.;]+$/, "");
}

function extractCoordinates(html: string): {
  latitude: number | null;
  longitude: number | null;
} {
  LAT_LON_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LAT_LON_RE.exec(html)) !== null) {
    const latitude = Number.parseFloat(match[1]!);
    const longitude = Number.parseFloat(match[2]!);
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      !(latitude === 0 && longitude === 0)
    ) {
      return { latitude, longitude };
    }
  }
  return { latitude: null, longitude: null };
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}
