/**
 * Diagnostic temporaire Ormes (prod Vercel) — à retirer après résolution.
 * Ne logue pas de PII ; head tronqué à 200 chars.
 */

export type OrmesHtmlDiagnosis = {
  bodyLength: number;
  hasEmCategory: boolean;
  hasEmEvent: boolean;
  hasH3Upcoming: boolean;
  hasEventsManagerScript: boolean;
  eventHrefCount: number;
  looksLikeChallenge: boolean;
  looksLikeCaptcha: boolean;
  looksLikeRateLimit: boolean;
  looksLikeWordPress: boolean;
  /** true si la page ressemble à l’agenda EM attendu. */
  looksLikeEventsManagerList: boolean;
  head: string;
};

export function diagnoseOrmesHtml(html: string): OrmesHtmlDiagnosis {
  const bodyLength = html.length;
  const hasEmCategory = /em-category-single|em-taxonomy-single/i.test(html);
  const hasEmEvent = /\bem-event\b/i.test(html);
  const hasH3Upcoming = /<h3>\s*Évènement à venir\s*<\/h3>/i.test(html);
  const hasEventsManagerScript = /events-manager/i.test(html);
  const eventHrefCount = (
    html.match(/href=["'][^"']*\/events\/[^"']+/gi) ?? []
  ).length;

  const looksLikeChallenge =
    /haphash|I Challenge Thee|_challenge|Checking connection, please wait|AI scrapers break the web/i.test(
      html,
    );
  const looksLikeCaptcha =
    /recaptcha|hcaptcha|cf-turnstile|captcha|challenge-platform/i.test(html);
  const looksLikeRateLimit =
    /too many requests|rate.?limit|429/i.test(html) ||
    /You have sent \d+ requests/i.test(html);
  const looksLikeWordPress = /wp-content|wp-includes|WordPress/i.test(html);

  const looksLikeEventsManagerList =
    (hasEmCategory || hasH3Upcoming) &&
    eventHrefCount > 0 &&
    !looksLikeChallenge &&
    !looksLikeCaptcha;

  return {
    bodyLength,
    hasEmCategory,
    hasEmEvent,
    hasH3Upcoming,
    hasEventsManagerScript,
    eventHrefCount,
    looksLikeChallenge,
    looksLikeCaptcha,
    looksLikeRateLimit,
    looksLikeWordPress,
    looksLikeEventsManagerList,
    head: html.slice(0, 200).replace(/\s+/g, " "),
  };
}

export function logOrmesFetchDiagnostic(params: {
  phase: "list" | "detail";
  url: string;
  status: number;
  contentType: string | null;
  contentLengthHeader: string | null;
  html: string;
  parsedItemCount?: number;
}): void {
  const diagnosis = diagnoseOrmesHtml(params.html);
  console.info("[detour:ormes:diag]", {
    phase: params.phase,
    url: params.url,
    status: params.status,
    contentType: params.contentType,
    contentLengthHeader: params.contentLengthHeader,
    bodyLength: diagnosis.bodyLength,
    markers: {
      emCategory: diagnosis.hasEmCategory,
      emEvent: diagnosis.hasEmEvent,
      h3Upcoming: diagnosis.hasH3Upcoming,
      eventsManagerScript: diagnosis.hasEventsManagerScript,
      wordpress: diagnosis.looksLikeWordPress,
    },
    eventHrefCountBeforeParse: diagnosis.eventHrefCount,
    parsedItemCount: params.parsedItemCount ?? null,
    challenge: diagnosis.looksLikeChallenge,
    captcha: diagnosis.looksLikeCaptcha,
    rateLimitHint: diagnosis.looksLikeRateLimit,
    looksLikeEventsManagerList: diagnosis.looksLikeEventsManagerList,
    head: diagnosis.head,
  });
}
