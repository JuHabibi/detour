import type { IngreAgendaDetail } from "./ingre-agenda.types";

const SHORTLINK_RE = /rel="shortlink"\s+href="https?:\/\/[^"]+\/node\/(\d+)"/i;
const BODY_NODE_RE = /page-node-(\d+)/i;
const PANEL_NODE_RE = /node-ads-agenda\s+node-(\d+)/i;
const TITLE_RE = /<h1\s+class="pane-title">([\s\S]*?)<\/h1>/i;
const ACCROCHE_RE =
  /<div\s+class="field-ads-accroche">\s*([\s\S]*?)\s*<\/div>/i;
const BODY_RE = /<div\s+class="field-body">\s*([\s\S]*?)\s*<\/div>/i;
/** Bloc illustration fiche uniquement (pas logo / body / footer). */
const ILLUSTRATION_FIGURE_RE =
  /<figure\s+class="field-ads-illustration">([\s\S]*?)<\/figure>/i;
const ILLUSTRATION_PANE_RE =
  /pane-node-field-ads-illustration[\s\S]*?<img([^>]+)>/i;
const IMG_TAG_RE = /<img([^>]+)>/i;

/** Placeholder Drupal observé sur les fiches sans visuel dédié. */
const DEFAULT_IMAGE_PATH_MARKERS = [
  "/default_images/",
  "image_defaut",
  "image_default",
] as const;

const THEMATIQUE_RE =
  /field-ads-agenda-thematique">([\s\S]*?)<\/ul>/i;
const DATE_BLOCK_RE =
  /field-ads-agenda-date">([\s\S]*?)<\/ul>/i;
const GRATUIT_RE = /field-ads-agenda-gratuit">([\s\S]*?)<\/ul>/i;
const PUBLIC_RE = /field-ads-agenda-public">([\s\S]*?)<\/ul>/i;
const CANONICAL_RE = /rel="canonical"\s+href="([^"]+)"/i;
const LI_RE = /<li[^>]*>\s*([\s\S]*?)\s*<\/li>/gi;

/**
 * Parse une fiche HTML `/agenda/...` (Drupal node ads-agenda).
 */
export function parseIngreAgendaDetail(
  html: string,
  fallbackPath?: string,
): IngreAgendaDetail {
  if (typeof html !== "string" || html.trim().length === 0) {
    throw new Error("Ingré agenda detail: empty HTML");
  }

  const nid =
    SHORTLINK_RE.exec(html)?.[1] ??
    PANEL_NODE_RE.exec(html)?.[1] ??
    BODY_NODE_RE.exec(html)?.[1];
  if (!nid) {
    throw new Error("Ingré agenda detail: missing node id");
  }

  const titleRaw = TITLE_RE.exec(html)?.[1];
  if (!titleRaw) {
    throw new Error(`Ingré agenda detail node-${nid}: missing title`);
  }
  const title = decodeHtmlEntities(stripTags(titleRaw)).trim();
  if (!title) {
    throw new Error(`Ingré agenda detail node-${nid}: empty title`);
  }

  const canonicalUrl =
    CANONICAL_RE.exec(html)?.[1] ??
    (fallbackPath
      ? absoluteIngreUrl(fallbackPath)
      : absoluteIngreUrl(`/node/${nid}`));

  const path = pathFromCanonical(canonicalUrl, nid, fallbackPath);

  const teaserMatch = ACCROCHE_RE.exec(html);
  const teaser = teaserMatch
    ? decodeHtmlEntities(stripTags(teaserMatch[1]!)).trim() || null
    : null;

  const bodyMatch = BODY_RE.exec(html);
  const bodyText = bodyMatch
    ? decodeHtmlEntities(stripTags(bodyMatch[1]!)).trim() || null
    : null;

  const imageUrl = extractEventIllustrationUrl(html);

  const thematiques = extractListItems(THEMATIQUE_RE.exec(html)?.[1] ?? "");
  const gratuit =
    extractListItems(GRATUIT_RE.exec(html)?.[1] ?? "")[0] ?? null;
  const publicLabel =
    extractListItems(PUBLIC_RE.exec(html)?.[1] ?? "")[0] ?? null;

  const dateBlock = DATE_BLOCK_RE.exec(html)?.[1] ?? null;
  const dateParsed = parseDateBlock(dateBlock);

  return {
    nid,
    title,
    path,
    canonicalUrl,
    teaser,
    bodyText,
    imageUrl,
    thematiques,
    dateRaw: dateBlock
      ? decodeHtmlEntities(stripTags(dateBlock)).trim()
      : null,
    dateStartLabel: dateParsed.startLabel,
    dateEndLabel: dateParsed.endLabel,
    allDay: dateParsed.allDay,
    singleDayStartTime: dateParsed.singleDayStartTime,
    singleDayEndTime: dateParsed.singleDayEndTime,
    gratuit,
    publicLabel,
  };
}

function parseDateBlock(dateBlock: string | null): {
  startLabel: string | null;
  endLabel: string | null;
  allDay: boolean;
  singleDayStartTime: string | null;
  singleDayEndTime: string | null;
} {
  if (!dateBlock) {
    return {
      startLabel: null,
      endLabel: null,
      allDay: false,
      singleDayStartTime: null,
      singleDayEndTime: null,
    };
  }

  const allDay = /\(\s*Jour entier\s*\)/i.test(dateBlock);

  if (/date-display-single/i.test(dateBlock)) {
    const dayLabelRaw =
      /date-display-single"[^>]*>\s*([^<]+)/i.exec(dateBlock)?.[1] ?? "";
    const dayLabel = decodeHtmlEntities(dayLabelRaw).replace(/\s+/g, " ").trim();
    const singleAllDay = /\(\s*Jour entier\s*\)/i.test(dayLabel) || allDay;
    const nestedStart =
      /date-display-start">(\d{1,2}:\d{2})</i.exec(dateBlock)?.[1] ?? null;
    const nestedEnd =
      /date-display-end">(\d{1,2}:\d{2})</i.exec(dateBlock)?.[1] ?? null;
    return {
      startLabel: dayLabel || null,
      endLabel: dayLabel || null,
      allDay: singleAllDay,
      singleDayStartTime: singleAllDay ? null : nestedStart,
      singleDayEndTime: singleAllDay ? null : nestedEnd,
    };
  }

  const rangeStart =
    /date-display-start">([^<]+)</i.exec(dateBlock)?.[1]?.trim() ?? null;
  const rangeEnd =
    /date-display-end">([^<]+)</i.exec(dateBlock)?.[1]?.trim() ?? null;

  const startLabel = rangeStart
    ? decodeHtmlEntities(rangeStart).replace(/\s+/g, " ").trim()
    : null;
  const endLabel = rangeEnd
    ? decodeHtmlEntities(rangeEnd).replace(/\s+/g, " ").trim()
    : startLabel;

  return {
    startLabel,
    endLabel,
    allDay,
    singleDayStartTime: null,
    singleDayEndTime: null,
  };
}

function extractListItems(block: string): string[] {
  const items: string[] = [];
  LI_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LI_RE.exec(block)) !== null) {
    const text = decodeHtmlEntities(stripTags(match[1]!)).trim();
    if (text) items.push(text);
  }
  return items;
}

function pathFromCanonical(
  canonicalUrl: string,
  nid: string,
  fallbackPath?: string,
): string {
  try {
    const url = new URL(canonicalUrl);
    if (url.pathname.startsWith("/agenda/")) return url.pathname;
  } catch {
    // ignore malformed canonical
  }
  if (fallbackPath?.startsWith("/agenda/")) return fallbackPath;
  return `/node/${nid}`;
}

export function absoluteIngreUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith("//")) {
    return `https:${pathOrUrl}`;
  }
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `https://www.ingre.fr${path}`;
}

/**
 * Illustration propre à la fiche (`field-ads-illustration`).
 * Ignore logo/header/body ; null si absente ou image générique Drupal.
 */
export function extractEventIllustrationUrl(html: string): string | null {
  const figure = ILLUSTRATION_FIGURE_RE.exec(html)?.[1];
  const attrs =
    (figure ? IMG_TAG_RE.exec(figure)?.[1] : null) ??
    ILLUSTRATION_PANE_RE.exec(html)?.[1] ??
    null;
  if (!attrs) return null;

  const raw =
    readAttr(attrs, "src") ??
    readAttr(attrs, "data-src") ??
    firstSrcsetUrl(readAttr(attrs, "srcset"));
  if (!raw) return null;

  const absolute = absoluteIngreUrl(raw.trim());
  if (isIngreAgendaDefaultImage(absolute)) return null;
  return absolute;
}

export function isIngreAgendaDefaultImage(url: string): boolean {
  const normalized = url.toLowerCase();
  return DEFAULT_IMAGE_PATH_MARKERS.some((marker) =>
    normalized.includes(marker),
  );
}

function readAttr(attrs: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"`, "i").exec(attrs);
  return match?.[1]?.trim() || null;
}

function firstSrcsetUrl(srcset: string | null): string | null {
  if (!srcset) return null;
  const first = srcset.split(",")[0]?.trim();
  if (!first) return null;
  return first.split(/\s+/)[0] || null;
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
