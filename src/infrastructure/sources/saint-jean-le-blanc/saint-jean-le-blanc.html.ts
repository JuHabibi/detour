export const SJLB_ORIGIN = "https://www.saintjeanleblanc.com";
export const SJLB_LIST_PATH = "/Liste_agenda_1/";
export const SJLB_PAGE_SIZE = 9;

export function absoluteSjlbUrl(
  href: string,
  origin: string = SJLB_ORIGIN,
): string {
  try {
    return new URL(href, origin).toString();
  } catch {
    return href;
  }
}

export function decodeSjlbHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&rsquo;/gi, "’")
    .replace(/&lsquo;/gi, "‘")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»")
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&agrave;/gi, "à")
    .replace(/&ocirc;/gi, "ô")
    .replace(/&icirc;/gi, "î")
    .replace(/&ucirc;/gi, "û")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&ouml;/gi, "ö")
    .replace(/&euml;/gi, "ë")
    .replace(/&acirc;/gi, "â")
    .replace(/&ugrave;/gi, "ù")
    .replace(/&hellip;/gi, "…")
    .replace(/&Eacute;/gi, "É")
    .replace(/&Egrave;/gi, "È")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&euro;/gi, "€")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(Number.parseInt(n, 16)),
    );
}

export function stripSjlbTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Challenge / anti-bot HTML — fail-closed. */
export function isSjlbChallengeHtml(html: string): boolean {
  return /haphash|I Challenge Thee|_challenge|captcha|cf-turnstile|Checking connection/i.test(
    html,
  );
}

export function assertSjlbUsableHtml(html: string, context: string): void {
  if (typeof html !== "string" || html.trim().length === 0) {
    throw new Error(`Saint-Jean-le-Blanc ${context}: empty HTML`);
  }
  if (isSjlbChallengeHtml(html)) {
    throw new Error(
      `Saint-Jean-le-Blanc ${context}: unexpected challenge / anti-bot HTML`,
    );
  }
}

/** Construit l’URL de pagination CMS (p 1-based, fenêtres de 9). */
export function buildSjlbListPageUrl(
  pageNumber: number,
  origin: string = SJLB_ORIGIN,
  pageSize: number = SJLB_PAGE_SIZE,
): string {
  if (pageNumber <= 1) {
    return absoluteSjlbUrl(SJLB_LIST_PATH, origin);
  }
  const debut = (pageNumber - 1) * pageSize;
  const fin = debut + pageSize;
  return absoluteSjlbUrl(
    `/ListeAgenda.php?IdRubrique=1&p=${pageNumber}&listeDebut=${debut}&listeFin=${fin}`,
    origin,
  );
}
