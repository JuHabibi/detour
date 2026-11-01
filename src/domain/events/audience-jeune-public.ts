/**
 * Facette audience Explorer « jeune_public » — source de vérité unique.
 *
 * Constantes + `isJeunePublicAudience` = règles métier.
 * `sqlJeunePublicAudiencePredicate` = projection SQL de ces constantes
 * (contrat garanti par golden tests PGlite : TS ↔ SQL).
 *
 * Ne modifie pas `product_category` / classifieur de type.
 */

export const EXPLORER_AUDIENCE_JEUNE_PUBLIC = "jeune_public" as const;
export type ExplorerAudienceId = typeof EXPLORER_AUDIENCE_JEUNE_PUBLIC;

export type AudienceDetectionInput = {
  title?: string | null;
  description?: string | null;
  /** Tags source bruts (souvent `;`-séparés, OpenAgenda). */
  category?: string | null;
};

/** Phrases / publics jeunesse explicites (texte déjà normalisé, sans accents). */
export const JEUNE_PUBLIC_STRONG_PHRASES = [
  "jeune public",
  "petites oreilles",
  "grandes oreilles",
  "comptine",
  "comptines",
  "reveil livres",
  "bebes lecteurs",
  "bebe lecteur",
  "histoires pour les petites oreilles",
  "histoires pour les grandes oreilles",
  "histoires pour petites oreilles",
  "histoires pour grandes oreilles",
  "tout-petit",
  "tout petit",
  "tout-petits",
  "tout petits",
  "pour les ados",
  "pour ados",
  "pour les enfants",
  "pour enfants",
] as const;

/**
 * Tranches d’âge cibles (public de l’activité) — pas les seuils « dès / à partir de ».
 * ASCII only, partagé JS + SQL POSIX.
 */
export const JEUNE_PUBLIC_AGE_BAND_ALTERNATION = [
  String.raw`[0-9]{1,2}\s*[-/a]\s*[0-9]{1,2}\s*ans`,
  String.raw`pour les\s+[0-9]{1,2}\s*[-/a]\s*[0-9]{1,2}\s*ans`,
  String.raw`de\s+[0-9]{1,2}\s*a\s+[0-9]{1,2}\s*ans`,
  String.raw`de\s+[0-9]{1,2}\s*a\s+[0-9]{1,2}\s*mois`,
  String.raw`0\s*[-/a]\s*3`,
  String.raw`0\s*[-/a]\s*18\s*mois`,
  String.raw`[0-9]{1,2}\s*mois\s*a\s*[0-9]{1,2}\s*ans`,
].join("|");

export const JEUNE_PUBLIC_AGE_BAND_REGEX_SOURCE =
  String.raw`(^|[^a-z0-9])(` +
  JEUNE_PUBLIC_AGE_BAND_ALTERNATION +
  String.raw`)([^a-z0-9]|$)`;

export function normalizeAudienceText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSourceTags(category: string | null | undefined): string[] {
  if (!category?.trim()) return [];
  return category
    .split(";")
    .map((part) => normalizeAudienceText(part))
    .filter(Boolean);
}

function isJeunePublicTag(tag: string): boolean {
  return tag === "jeune public" || tag.startsWith("jeune public ");
}

function isCineVacancesTag(tag: string): boolean {
  return tag.includes("cine-vacances") || tag.includes("cine vacances");
}

function hasStrongYouthPhrase(text: string): boolean {
  if (!text) return false;
  if (/\bbebe\b|\bbebes\b/.test(text)) return true;
  if (/\bados\b|\badolescent/.test(text)) return true;
  for (const phrase of JEUNE_PUBLIC_STRONG_PHRASES) {
    if (text.includes(phrase)) return true;
  }
  return false;
}

/** Tranches N–M ans / « pour les 12-16 ans » — pas « dès 14 ans ». */
function hasTargetAgeBand(text: string): boolean {
  if (!text) return false;
  return new RegExp(JEUNE_PUBLIC_AGE_BAND_REGEX_SOURCE).test(text);
}

export function hasStrongJeunePublicTextSignal(text: string): boolean {
  return hasStrongYouthPhrase(text) || hasTargetAgeBand(text);
}

/**
 * Tag JP avec au plus un compagnon (ex. `Spectacle;Jeune public`).
 * Refuse les dumps multi-familles type Passerelle (≥2 `;`).
 */
function hasJeunePublicWithAtMostOneCompanion(tags: string[]): boolean {
  if (!tags.some(isJeunePublicTag)) return false;
  return tags.length <= 2;
}

/**
 * Audience jeunesse — V1 conservatrice.
 *
 * Accepte :
 * - tag source seul « Jeune public », ou JP + un seul autre tag ;
 * - série CINÉ-VACANCES ;
 * - formulations jeunesse / ados explicites ;
 * - tranches d’âge cibles (« 6-8 ans », « pour les 12-16 ans »).
 *
 * Refuse : « dès / à partir de N ans » seuls, « enfants » générique seul,
 * famille/conte seuls, tarifs −12 ans, multi-tags Passerelle sans texte fort.
 */
export function isJeunePublicAudience(input: AudienceDetectionInput): boolean {
  const tags = splitSourceTags(input.category);
  const text = normalizeAudienceText(
    [input.title, input.description].filter(Boolean).join(" "),
  );

  if (tags.some(isCineVacancesTag)) return true;
  if (hasJeunePublicWithAtMostOneCompanion(tags)) return true;
  if (hasStrongJeunePublicTextSignal(text)) return true;
  return false;
}

function sqlFoldExpr(columnExpr: string): string {
  // Mapping 1:1 strict (60→60) : œŒ–—’` → oo--␠␠ — un décalage transformait « 12–16 » en « 12o16 ».
  return `translate(lower(trim(coalesce(${columnExpr}, ''))), 'àáâäãåāăąçćčđďèéêëēėęěğìíîïīįłńñňòóôõöøōřšťùúûüūůýÿžźżœŒ–—’\`', 'aaaaaaaaacccddeeeeeeeegiiiiiilnnnooooooorstuuuuuuyyzzzoo--  ')`;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Prédicat SQL booléen — mêmes règles que `isJeunePublicAudience`.
 * Alias table événements (défaut `e`).
 */
export function sqlJeunePublicAudiencePredicate(alias = "e"): string {
  const cat = sqlFoldExpr(`${alias}.category`);
  const title = sqlFoldExpr(`${alias}.title`);
  const description = sqlFoldExpr(`${alias}.description`);
  const textBlob = `regexp_replace(${title} || ' ' || ${description}, '[[:space:]]+', ' ', 'g')`;
  const rawCat = `coalesce(${alias}.category, '')`;

  const phraseSql = JEUNE_PUBLIC_STRONG_PHRASES.map(
    (phrase) => `${textBlob} LIKE ${sqlString("%" + phrase + "%")}`,
  ).join("\n      OR ");

  const strongSql = `(
      ${textBlob} ~ ${sqlString("(^|[^a-z0-9])bebe(s)?([^a-z0-9]|$)")}
      OR ${textBlob} ~ ${sqlString("(^|[^a-z0-9])ados([^a-z0-9]|$)")}
      OR ${textBlob} ~ ${sqlString("(^|[^a-z0-9])adolescent")}
      OR ${phraseSql}
      OR ${textBlob} ~ ${sqlString(JEUNE_PUBLIC_AGE_BAND_REGEX_SOURCE)}
    )`;

  const hasJpTag = `(
      ${cat} = 'jeune public'
      OR ${cat} LIKE 'jeune public;%'
      OR ${cat} LIKE '%;jeune public'
      OR ${cat} LIKE '%;jeune public;%'
      OR ${cat} LIKE 'jeune public %'
      OR ${cat} LIKE '%;jeune public %'
    )`;

  // 0 ou 1 séparateur ';' ⇒ tag seul ou JP + un compagnon.
  const jpAtMostOneCompanion = `(
      ${hasJpTag}
      AND (length(${rawCat}) - length(replace(${rawCat}, ';', ''))) <= 1
    )`;

  const cineVacances = `(
      ${cat} LIKE '%cine-vacances%'
      OR ${cat} LIKE '%cine vacances%'
    )`;

  return `(
    ${cineVacances}
    OR ${jpAtMostOneCompanion}
    OR ${strongSql}
  )`;
}
