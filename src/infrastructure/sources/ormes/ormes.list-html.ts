/**
 * Garde-fou liste Culture Ormes — distingue page EM (éventuellement vide)
 * d’un HTML challenge / inattendu (fail-closed).
 */

export type OrmesListHtmlKind =
  | "events_manager_list"
  | "challenge"
  | "unexpected";

export function classifyOrmesListHtml(html: string): OrmesListHtmlKind {
  if (isOrmesChallengeHtml(html)) return "challenge";
  if (looksLikeOrmesEventsManagerListHtml(html)) return "events_manager_list";
  return "unexpected";
}

/** Challenge anti-bot (ex. haphash) servi en HTTP 200. */
export function isOrmesChallengeHtml(html: string): boolean {
  return /haphash|I Challenge Thee|_challenge|Checking connection, please wait|AI scrapers break the web/i.test(
    html,
  );
}

/**
 * Page liste Events Manager attendue — y compris agenda vide
 * (`<h3>Évènement à venir</h3><ul></ul>` sans fiches).
 */
export function looksLikeOrmesEventsManagerListHtml(html: string): boolean {
  if (isOrmesChallengeHtml(html)) return false;
  if (/recaptcha|hcaptcha|cf-turnstile|captcha|challenge-platform/i.test(html)) {
    return false;
  }

  const hasEmCategory = /em-category-single|em-taxonomy-single/i.test(html);
  const hasH3Upcoming = /<h3>\s*Évènement à venir\s*<\/h3>/i.test(html);
  const hasEventsManager = /events-manager/i.test(html);
  const hasWordPress = /wp-content|wp-includes|WordPress/i.test(html);

  // Structure liste Culture : H3 agenda et/ou wrapper taxonomie EM.
  if (hasH3Upcoming || hasEmCategory) return true;

  // Fallback : plugin EM + WordPress (page catégorie sans H3 exact).
  return hasEventsManager && hasWordPress;
}

/**
 * Fail-closed sur la réponse liste : challenge ou HTML hors EM → throw.
 * Une vraie page agenda vide (EM reconnu, 0 items) ne throw pas.
 */
export function assertOrmesListHtml(html: string, url: string): void {
  const kind = classifyOrmesListHtml(html);
  if (kind === "events_manager_list") return;

  const reason =
    kind === "challenge" ? "challenge_haphash" : "unexpected_html";
  throw new Error(
    `Ormes unexpected_list_html: ${reason} (${url})`,
  );
}
