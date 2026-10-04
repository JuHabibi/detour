export const SJLB_ORIGIN = "https://www.saintjeanleblanc.com";
export const SJLB_LIST_PATH = "/Liste_agenda_1/";
export const SJLB_PAGE_SIZE = 9;

/** Pathname fiche agenda : `/Ress_<id>/<fiche>.html`. */
const SJLB_DETAIL_PATH_RE = /^\/Ress_(\d+)\/([^/]+)\.html$/i;

export type SjlbValidatedListUrl = {
  kind: "list";
  href: string;
};

export type SjlbValidatedDetailUrl = {
  kind: "detail";
  href: string;
  resourceId: string;
  /** Pathname sans slash initial (forme historique du parser). */
  detailPath: string;
};

/**
 * Résolution d’affichage (images, etc.) — pas une validation de collecte.
 * Les pages fetchées passent par `validateSjlbListCollectUrl` /
 * `validateSjlbDetailCollectUrl`.
 */
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

/**
 * Origine de confiance (config) : HTTPS, sans credentials, port par défaut,
 * pathname `/` uniquement. Normalise via `URL.origin`.
 */
export function assertTrustedSjlbOrigin(originInput: string): string {
  let url: URL;
  try {
    url = new URL(originInput);
  } catch {
    throw rejectUrl("trusted origin malformed", originInput);
  }
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    throw rejectUrl("trusted origin must be an origin only", originInput);
  }
  assertHttpsCollectableUrl(url, originInput);
  return url.origin;
}

/** URL de liste collectable (`/Liste_agenda_1/` ou `/ListeAgenda.php`). */
export function validateSjlbListCollectUrl(
  href: string,
  trustedOrigin: string,
): SjlbValidatedListUrl {
  const origin = assertTrustedSjlbOrigin(trustedOrigin);
  const resolved = resolveAgainstTrustedOrigin(href, origin);
  assertSameOrigin(resolved, origin, href);
  if (!isSjlbListPathname(resolved.pathname)) {
    throw rejectUrl("list pathname not allowed", href);
  }
  return { kind: "list", href: resolved.href };
}

/** URL de fiche collectable (`/Ress_<id>/<fiche>.html`). */
export function validateSjlbDetailCollectUrl(
  href: string,
  trustedOrigin: string,
): SjlbValidatedDetailUrl {
  const origin = assertTrustedSjlbOrigin(trustedOrigin);
  const resolved = resolveAgainstTrustedOrigin(href, origin);
  assertSameOrigin(resolved, origin, href);
  const match = SJLB_DETAIL_PATH_RE.exec(resolved.pathname);
  if (!match) {
    throw rejectUrl("detail pathname not allowed", href);
  }
  const resourceId = match[1]!;
  const detailPath = resolved.pathname.replace(/^\//, "");
  return {
    kind: "detail",
    href: resolved.href,
    resourceId,
    detailPath,
  };
}

/** Accepte liste ou détail — utilisé juste avant chaque fetch de collecte. */
export function assertSjlbCollectFetchUrl(
  href: string,
  trustedOrigin: string,
): string {
  const origin = assertTrustedSjlbOrigin(trustedOrigin);
  const resolved = resolveAgainstTrustedOrigin(href, origin);
  assertSameOrigin(resolved, origin, href);
  if (isSjlbListPathname(resolved.pathname)) {
    return resolved.href;
  }
  if (SJLB_DETAIL_PATH_RE.test(resolved.pathname)) {
    return resolved.href;
  }
  throw rejectUrl("collect pathname not allowed", href);
}

function resolveAgainstTrustedOrigin(href: string, trustedOrigin: string): URL {
  try {
    return new URL(href, trustedOrigin);
  } catch {
    throw rejectUrl("malformed", href);
  }
}

function assertSameOrigin(resolved: URL, trustedOrigin: string, href: string): void {
  assertHttpsCollectableUrl(resolved, href);
  if (resolved.origin !== trustedOrigin) {
    throw rejectUrl("origin not allowed", href);
  }
}

function assertHttpsCollectableUrl(url: URL, label: string): void {
  if (url.protocol !== "https:") {
    throw rejectUrl("HTTPS required", label);
  }
  if (url.username !== "" || url.password !== "") {
    throw rejectUrl("credentials not allowed", label);
  }
  // Port explicite non standard (443 → port vide après parse).
  if (url.port !== "") {
    throw rejectUrl("non-default port not allowed", label);
  }
}

function isSjlbListPathname(pathname: string): boolean {
  if (pathname === "/Liste_agenda_1" || pathname === "/Liste_agenda_1/") {
    return true;
  }
  return pathname === "/ListeAgenda.php";
}

function rejectUrl(reason: string, href: string): Error {
  return new Error(`Saint-Jean-le-Blanc URL rejected: ${reason} (${href})`);
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
  const trusted = assertTrustedSjlbOrigin(origin);
  if (pageNumber <= 1) {
    return validateSjlbListCollectUrl(SJLB_LIST_PATH, trusted).href;
  }
  const debut = (pageNumber - 1) * pageSize;
  const fin = debut + pageSize;
  return validateSjlbListCollectUrl(
    `/ListeAgenda.php?IdRubrique=1&p=${pageNumber}&listeDebut=${debut}&listeFin=${fin}`,
    trusted,
  ).href;
}
