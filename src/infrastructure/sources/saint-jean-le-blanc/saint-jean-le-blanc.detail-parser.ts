import {
  absoluteSjlbUrl,
  assertSjlbUsableHtml,
  decodeSjlbHtmlEntities,
  SJLB_ORIGIN,
  stripSjlbTags,
} from "./saint-jean-le-blanc.html";
import type { SjlbDetail } from "./saint-jean-le-blanc.types";

const BOOKING_URL_RE =
  /billet|yurplan|tickandlive|billetweb|billetreduc|ticketing|reservation|billetterie/i;

/**
 * Parse une fiche `Ress_*` (bloc #texte + Infos pratiques).
 * N’invente ni horaire ni occurrence : champs absents → null.
 */
export function parseSjlbDetail(
  html: string,
  detailUrl: string,
  options: { origin?: string } = {},
): SjlbDetail {
  const origin = options.origin ?? SJLB_ORIGIN;
  assertSjlbUsableHtml(html, "detail");

  const resourceId = detailUrl.match(/Ress_(\d+)/i)?.[1];
  if (!resourceId) {
    throw new Error(
      `Saint-Jean-le-Blanc detail: URL missing Ress_id (${detailUrl})`,
    );
  }

  const detailPath =
    detailUrl.match(/Ress_\d+\/[^?#]+/i)?.[0] ?? `Ress_${resourceId}`;

  const texte = extractTexte(html);
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  const title = h1
    ? decodeSjlbHtmlEntities(stripSjlbTags(h1))
    : "";
  if (!title) {
    throw new Error(
      `Saint-Jean-le-Blanc detail: missing h1 title (Ress_${resourceId})`,
    );
  }

  const info = parseInfosPratiques(texte);
  if (!info.date) {
    throw new Error(
      `Saint-Jean-le-Blanc detail: missing Infos pratiques Date (Ress_${resourceId})`,
    );
  }

  const theme =
    decodeOptional(
      (texte.match(/Imprimer la page\s*([^<\n]+)/i) || [])[1]?.trim(),
    ) ||
    decodeOptional(
      (texte.match(/class="thematique">([^<]+)/i) || [])[1]?.trim(),
    );

  const imgSrc =
    (texte.match(/<img[^>]+src="([^"]+)"/i) ||
      html.match(/<div[^>]*id=["']texte["'][\s\S]*?<img[^>]+src="([^"]+)"/i) ||
      [])[1] ?? null;

  const bookingLinks = [
    ...texte.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi),
  ]
    .map((m) => m[1]!)
    .filter((u) => BOOKING_URL_RE.test(u));

  const descriptionText = decodeSjlbHtmlEntities(
    stripSjlbTags(
      texte
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " "),
    ),
  );

  return {
    resourceId,
    detailPath,
    detailUrl: absoluteSjlbUrl(detailUrl, origin),
    title,
    theme,
    dateRaw: info.date,
    horairesRaw: info.horaires,
    lieu: info.lieu,
    adresse: info.adresse,
    descriptionText: descriptionText.length > 0 ? descriptionText : null,
    imageUrl: imgSrc ? absoluteSjlbUrl(imgSrc, origin) : null,
    bookingUrl: bookingLinks[0] ?? null,
    organisateurMention:
      /organis[ée]|association|compagnie|en partenariat/i.test(texte),
  };
}

function extractTexte(html: string): string {
  const match =
    html.match(
      /id=["']texte["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]*id=["']|<\/div>\s*<\/div>\s*<footer|<div id=["']bas)/i,
    ) || html.match(/id=["']texte["'][^>]*>([\s\S]*?)$/i);
  return match?.[1] ?? "";
}

function parseInfosPratiques(texte: string): {
  date: string | null;
  horaires: string | null;
  lieu: string | null;
  adresse: string | null;
} {
  const info: Record<string, string> = {};
  for (const m of texte.matchAll(
    /class="separation"><span>([^<]+)<\/span>\s*<p>([\s\S]*?)<\/p>/gi,
  )) {
    const key = decodeSjlbHtmlEntities(m[1]!).trim().toLowerCase();
    const value = decodeSjlbHtmlEntities(stripSjlbTags(m[2]!));
    if (key && value) info[key] = value;
  }
  return {
    date: info.date ?? null,
    horaires: info.horaires ?? null,
    lieu: info.lieu ?? null,
    adresse: info.adresse ?? null,
  };
}

function decodeOptional(value: string | null | undefined): string | null {
  if (!value) return null;
  const decoded = decodeSjlbHtmlEntities(value).trim();
  return decoded.length > 0 ? decoded : null;
}
