import type { BouillonListItem, BouillonListPage } from "./bouillon.types";

export const BOUILLON_LIST_PATH = "/fr/culture/agenda-actualites";

const STRUCTURE_MARKERS = [
  "view-id-univ_agenda",
  "univ-layout-group-agenda",
  "univ-agenda teaser",
] as const;

const ARTICLE_RE =
  /<article\b[^>]*class="[^"]*univ-agenda[^"]*teaser[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;

const HREF_RE =
  /<a\s+href="((?:\/fr)?\/culture\/agenda-actualites\/[^"#?]+)"/i;

const TITLE_RE = /class="[^"]*wrapper-title[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/div>/i;

const CATEGORY_FIELD_RE =
  /field--name-field-univ-agenda-categorie[^>]*>\s*([\s\S]*?)\s*<\/div>/i;

const TOP_LEFT_CATEGORY_RE =
  /class="top-left"[^>]*>\s*([\s\S]*?)\s*<\/div>/i;

const TEASER_BODY_RE =
  /field--name-body[^>]*>\s*([\s\S]*?)\s*<\/div>\s*<\/div>/i;

const PAGER_LAST_RE =
  /pager__item--last[\s\S]*?href="[^"]*[?&]page=(\d+)/i;

const PAGER_ANY_RE = /[?&]page=(\d+)/gi;

/**
 * Parse une page HTML de liste `/fr/culture/agenda-actualites`.
 * Fail-closed si la structure attendue est absente alors qu’un pager annonce des pages.
 */
export function parseBouillonListPage(html: string): BouillonListPage {
  if (typeof html !== "string" || html.trim().length === 0) {
    throw new Error("Bouillon list: empty HTML");
  }

  const hasStructure = STRUCTURE_MARKERS.some((marker) => html.includes(marker));
  const lastPageIndex = resolveLastPageIndex(html);

  const items: BouillonListItem[] = [];
  ARTICLE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ARTICLE_RE.exec(html)) !== null) {
    const body = match[1]!;
    const hrefMatch = HREF_RE.exec(body);
    if (!hrefMatch) {
      throw new Error("Bouillon list: teaser missing event link");
    }
    const path = normalizeBouillonPath(hrefMatch[1]!);

    const titleMatch = TITLE_RE.exec(body);
    if (!titleMatch) {
      throw new Error(`Bouillon list: teaser ${path} missing title`);
    }
    const title = decodeHtmlEntities(stripTags(titleMatch[1]!)).trim();
    if (!title) {
      throw new Error(`Bouillon list: teaser ${path} empty title`);
    }

    const category =
      extractCategory(body, CATEGORY_FIELD_RE) ??
      extractCategory(body, TOP_LEFT_CATEGORY_RE);

    const teaserMatch = TEASER_BODY_RE.exec(body);
    const teaser = teaserMatch
      ? decodeHtmlEntities(stripTags(teaserMatch[1]!)).trim() || null
      : null;

    items.push({ title, path, category, teaser });
  }

  if (!hasStructure && items.length === 0) {
    throw new Error("Bouillon list: unexpected HTML (missing agenda structure)");
  }

  if (lastPageIndex > 0 && items.length === 0) {
    throw new Error(
      "Bouillon list: pager announces pages but no teasers found",
    );
  }

  return { items, lastPageIndex };
}

export function normalizeBouillonPath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.startsWith("/fr/culture/agenda-actualites/")) {
    return trimmed.replace(/\/+$/, "");
  }
  if (trimmed.startsWith("/culture/agenda-actualites/")) {
    return `/fr${trimmed}`.replace(/\/+$/, "");
  }
  throw new Error(`Bouillon list: unexpected event path ${path}`);
}

function resolveLastPageIndex(html: string): number {
  let max = 0;

  const last = PAGER_LAST_RE.exec(html);
  if (last) {
    max = Math.max(max, Number.parseInt(last[1]!, 10));
  }

  PAGER_ANY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PAGER_ANY_RE.exec(html)) !== null) {
    const page = Number.parseInt(m[1]!, 10);
    if (Number.isFinite(page) && page > max) max = page;
  }

  return max;
}

function extractCategory(body: string, re: RegExp): string | null {
  const match = re.exec(body);
  if (!match) return null;
  const value = decodeHtmlEntities(stripTags(match[1]!)).trim();
  return value.length > 0 ? value : null;
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
