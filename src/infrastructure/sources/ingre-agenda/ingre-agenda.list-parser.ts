import type {
  IngreAgendaListItem,
  IngreAgendaListPage,
} from "./ingre-agenda.types";

const ARTICLE_RE =
  /<article\b[^>]*\bid="node-(\d+)"[^>]*class="[^"]*node-ads-agenda[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;

const TITLE_LINK_RE =
  /<h3>\s*<a\s+href="(\/agenda\/[^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i;

const TEASER_RE =
  /<div\s+class="field-ads-accroche">\s*([\s\S]*?)\s*<\/div>/i;

const PAGER_LAST_RE =
  /pager-last[^>]*>\s*<a[^>]*href="([^"]*page=(\d+)[^"]*)"/i;

const PAGER_ANY_RE = /href="[^"]*[?&]page=(\d+)/gi;

const PAGER_ACTIVE_RE = /<li class="active"><span>(\d+)<\/span><\/li>/i;

/**
 * Parse une page HTML de liste `/agenda` (Drupal ads-agenda teasers).
 * Throw si la structure attendue est absente alors qu’un pager annonce des pages.
 */
export function parseIngreAgendaListPage(html: string): IngreAgendaListPage {
  if (typeof html !== "string" || html.trim().length === 0) {
    throw new Error("Ingré agenda list: empty HTML");
  }

  const items: IngreAgendaListItem[] = [];
  ARTICLE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ARTICLE_RE.exec(html)) !== null) {
    const nid = match[1]!;
    const body = match[2]!;
    const titleMatch = TITLE_LINK_RE.exec(body);
    if (!titleMatch) {
      throw new Error(
        `Ingré agenda list: article node-${nid} missing title link`,
      );
    }
    const path = titleMatch[1]!;
    const title = decodeHtmlEntities(stripTags(titleMatch[2]!)).trim();
    if (!title) {
      throw new Error(`Ingré agenda list: article node-${nid} empty title`);
    }
    const teaserMatch = TEASER_RE.exec(body);
    const teaser = teaserMatch
      ? decodeHtmlEntities(stripTags(teaserMatch[1]!)).trim() || null
      : null;
    items.push({ nid, title, path, teaser });
  }

  const lastPageIndex = resolveLastPageIndex(html);

  if (lastPageIndex > 0 && items.length === 0) {
    throw new Error(
      "Ingré agenda list: pager announces pages but no teasers found",
    );
  }

  return { items, lastPageIndex };
}

function resolveLastPageIndex(html: string): number {
  let max = 0;

  const last = PAGER_LAST_RE.exec(html);
  if (last) {
    max = Math.max(max, Number.parseInt(last[2]!, 10));
  }

  PAGER_ANY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PAGER_ANY_RE.exec(html)) !== null) {
    const page = Number.parseInt(m[1]!, 10);
    if (page > max) max = page;
  }

  // Sur la dernière page Drupal, l’onglet actif est un <span>N</span> 1-based
  // sans href (ex. « 4 » → index 3) alors que pager-last a disparu.
  const active = PAGER_ACTIVE_RE.exec(html);
  if (active) {
    const oneBased = Number.parseInt(active[1]!, 10);
    if (Number.isFinite(oneBased) && oneBased >= 1) {
      max = Math.max(max, oneBased - 1);
    }
  }

  return max;
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
