import {
  absoluteSjlbUrl,
  assertSjlbUsableHtml,
  decodeSjlbHtmlEntities,
  SJLB_ORIGIN,
  stripSjlbTags,
} from "./saint-jean-le-blanc.html";
import type {
  SjlbListItem,
  SjlbListPage,
} from "./saint-jean-le-blanc.types";

const ITEM_SPLIT_RE = /class="[^"]*item_agenda[^"]*"/i;
const THEME_RE = /class="thematique">([^<]+)/i;
const DAY_RE = /<strong>(\d+)<\/strong>/i;
const MONTH_RE = /<\/strong>\s*<\/?br\s*\/?>\s*([^<]+)/i;
const HREF_RE = /<h3>\s*<a[^>]*href="([^"]+)"/i;
const TITLE_INNER_RE = /<h3>\s*<a[^>]*>([\s\S]*?)<\/a>/i;
const IMG_RE =
  /<div class="image">\s*<img[^>]+src="([^"]+)"|<img[^>]+src="([^"]+)"/i;
const ANCHOR_RE = /id="([^"]+)"\s+class="agenda"/i;
const PAGER_RE = /ListeAgenda\.php\?[^"'>\s]+/gi;

/**
 * Parse une page liste agenda SJLB (`.item_agenda`).
 * Throw si HTML challenge / structure critique absente (appelant : page 1).
 */
export function parseSjlbListPage(
  html: string,
  options: { origin?: string; requireItems?: boolean } = {},
): SjlbListPage {
  const origin = options.origin ?? SJLB_ORIGIN;
  assertSjlbUsableHtml(html, "list");

  const items: SjlbListItem[] = [];
  const parts = html.split(ITEM_SPLIT_RE).slice(1);

  for (const part of parts) {
    const chunk = part.slice(0, 4000);
    const hrefMatch = HREF_RE.exec(chunk);
    if (!hrefMatch) {
      throw new Error(
        "Saint-Jean-le-Blanc list: .item_agenda without detail link",
      );
    }
    const detailPath = hrefMatch[1]!.replace(/^\//, "");
    const resourceId = detailPath.match(/Ress_(\d+)/i)?.[1];
    if (!resourceId) {
      throw new Error(
        `Saint-Jean-le-Blanc list: detail href missing Ress_id (${detailPath})`,
      );
    }

    const titleInner = TITLE_INNER_RE.exec(chunk)?.[1] ?? "";
    const title = decodeSjlbHtmlEntities(stripSjlbTags(titleInner));
    if (!title) {
      throw new Error(
        `Saint-Jean-le-Blanc list: empty title for Ress_${resourceId}`,
      );
    }

    const themeRaw = THEME_RE.exec(chunk)?.[1]?.trim() ?? null;
    const theme = themeRaw
      ? decodeSjlbHtmlEntities(themeRaw).trim() || null
      : null;
    const dayLabel = DAY_RE.exec(chunk)?.[1] ?? null;
    const monthLabel =
      MONTH_RE.exec(chunk)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
    const imgMatch = IMG_RE.exec(chunk);
    const imgSrc = imgMatch?.[1] ?? imgMatch?.[2] ?? null;
    const listAnchor = ANCHOR_RE.exec(chunk)?.[1] ?? null;

    items.push({
      resourceId,
      listAnchor,
      title,
      theme,
      dayLabel,
      monthLabel,
      detailPath,
      detailUrl: absoluteSjlbUrl(detailPath, origin),
      imageUrl: imgSrc ? absoluteSjlbUrl(imgSrc, origin) : null,
    });
  }

  const pageNumbers = resolvePageNumbers(html);
  const lastPageNumber = pageNumbers.length
    ? Math.max(...pageNumbers)
    : items.length > 0
      ? 1
      : 0;

  if (options.requireItems !== false && items.length === 0) {
    throw new Error(
      "Saint-Jean-le-Blanc list: 0 .item_agenda on page (structure missing or empty corpus)",
    );
  }

  if (lastPageNumber > 1 && items.length === 0) {
    throw new Error(
      "Saint-Jean-le-Blanc list: pager announces pages but no .item_agenda found",
    );
  }

  return { items, pageNumbers, lastPageNumber: Math.max(lastPageNumber, 1) };
}

function resolvePageNumbers(html: string): number[] {
  const pages = new Set<number>([1]);
  PAGER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PAGER_RE.exec(html)) !== null) {
    const href = match[0]!;
    const p = /(?:\?|&)p=(\d+)/i.exec(href)?.[1];
    if (p) {
      const n = Number.parseInt(p, 10);
      if (Number.isFinite(n) && n >= 1) pages.add(n);
    }
  }
  return [...pages].sort((a, b) => a - b);
}
