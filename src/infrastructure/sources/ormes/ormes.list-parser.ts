import type { OrmesListItem, OrmesListPage } from "./ormes.types";

export const ORMES_ORIGIN = "https://www.ville-ormes.fr";
export const ORMES_CULTURE_LIST_PATH = "/events/categories/culture/";

/** Absolu depuis href relatif ou absolu Ormes. */
export function absoluteOrmesUrl(href: string, base = ORMES_ORIGIN): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/**
 * Parse la page catégorie Culture (liste « Évènement à venir »).
 * Pagination optionnelle via `.em-pagination a.page-numbers`.
 */
export function parseOrmesListPage(
  html: string,
  pageUrl: string,
): OrmesListPage {
  const section = extractUpcomingSection(html);
  const items: OrmesListItem[] = [];
  const seen = new Set<string>();

  const liRe =
    /<li>\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*(?:-\s*([\s\S]*?))?\s*<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = liRe.exec(section)) !== null) {
    const url = absoluteOrmesUrl(decodeHtmlEntities(match[1]!), pageUrl);
    const slug = slugFromEventUrl(url);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    items.push({
      slug,
      title: collapseWs(decodeHtmlEntities(stripTags(match[2]!))),
      url,
      dateHint: match[3]
        ? collapseWs(decodeHtmlEntities(stripTags(match[3])))
        : null,
    });
  }

  return {
    items,
    nextPageUrl: findNextPageUrl(html, pageUrl),
  };
}

function extractUpcomingSection(html: string): string {
  // Préférer le H3 structuré — évite le faux positif og:description Yoast.
  const h3 = html.match(
    /<h3>\s*Évènement à venir\s*<\/h3>\s*<ul>([\s\S]*?)<\/ul>/i,
  );
  if (h3) return h3[1]!;

  const taxonomy = html.match(
    /em-category-single[\s\S]*?<ul>([\s\S]*?)<\/ul>/i,
  );
  if (taxonomy) return taxonomy[1]!;

  return html;
}

function findNextPageUrl(html: string, pageUrl: string): string | null {
  const pagination = html.match(
    /<div[^>]*class="[^"]*em-pagination[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  );
  if (!pagination) return null;

  const current = pagination[1]!.match(
    /<span[^>]*class="[^"]*page-numbers current[^"]*"[^>]*>\s*(\d+)\s*<\/span>/i,
  );
  const currentN = current ? Number.parseInt(current[1]!, 10) : 1;
  const nextN = currentN + 1;

  const links = [
    ...pagination[1]!.matchAll(
      /<a[^>]*class="[^"]*page-numbers[^"]*"[^>]*href="([^"]+)"[^>]*>\s*(\d+)\s*<\/a>/gi,
    ),
  ];
  for (const link of links) {
    if (Number.parseInt(link[2]!, 10) === nextN) {
      return absoluteOrmesUrl(decodeHtmlEntities(link[1]!), pageUrl);
    }
  }

  const next = pagination[1]!.match(
    /<a[^>]*class="[^"]*next page-numbers[^"]*"[^>]*href="([^"]+)"/i,
  );
  return next ? absoluteOrmesUrl(decodeHtmlEntities(next[1]!), pageUrl) : null;
}

export function slugFromEventUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    const match = path.match(/\/events\/([^/]+)$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function collapseWs(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&rsquo;/gi, "’")
    .replace(/&lsquo;/gi, "‘")
    .replace(/&rdquo;/gi, "”")
    .replace(/&ldquo;/gi, "“")
    .replace(/&hellip;/gi, "…")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(Number.parseInt(n, 16)),
    );
}
