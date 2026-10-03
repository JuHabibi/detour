/**
 * Construction SQL Explorer (filter → normalize → rank → representatives).
 * Alias local `e` réutilisé dans chaque CTE — pas de replaceAll d’alias.
 */

/** Fold SQL (accents FR courants) — aligné sur foldExplorerText pour le latin1 courant. */
const SQL_FOLD_TITLE = `translate(lower(trim(e.title)), 'àáâäãåāăąçćčđďèéêëēėęěğìíîïīįłńñňòóôõöøōřšťùúûüūůýÿžźż’\`', 'aaaaaaaaacccddeeeeeeeegiiiiilnnnoooooooorsstuuuuuuyyzzz  ')`;

const SQL_FOLD_VENUE = `translate(lower(trim(coalesce(e.venue, ''))), 'àáâäãåāăąçćčđďèéêëēėęěğìíîïīįłńñňòóôõöøōřšťùúûüūůýÿžźż’\`', 'aaaaaaaaacccddeeeeeeeegiiiiilnnnoooooooorsstuuuuuuyyzzz  ')`;

/** Lieu normalisé (peut être ''). */
const SQL_VENUE_NORM = `trim(both from regexp_replace(regexp_replace(${SQL_FOLD_VENUE}, '[^a-z0-9[:space:]]', ' ', 'g'), '[[:space:]]+', ' ', 'g'))`;

/**
 * Titre canonique V1 en SQL (année terminale + préfixe court avant :/- ).
 * Doit rester aligné avec canonicalizeExplorerTitle.
 */
const SQL_TITLE_NO_YEAR = `trim(both from regexp_replace(${SQL_FOLD_TITLE}, '[[:space:]]+(19|20)\\d{2}$', ''))`;

const SQL_PREFIX_MATCH = `regexp_match(${SQL_TITLE_NO_YEAR}, '^(.{1,30}?)[[:space:]]*[-:–—][[:space:]]+(.+)$')`;

const SQL_CANONICAL_TITLE = `trim(both from regexp_replace(regexp_replace(
  CASE
    WHEN ${SQL_PREFIX_MATCH} IS NOT NULL
      AND length(trim(both from (${SQL_PREFIX_MATCH})[1])) BETWEEN 1 AND 30
      AND coalesce(array_length(regexp_split_to_array(trim(both from (${SQL_PREFIX_MATCH})[1]), '[[:space:]]+'), 1), 0) BETWEEN 1 AND 3
      AND length(trim(both from regexp_replace(regexp_replace(translate(lower(trim(both from (${SQL_PREFIX_MATCH})[2])), 'àáâäãåāăąçćčđďèéêëēėęěğìíîïīįłńñňòóôõöøōřšťùúûüūůýÿžźż’\`', 'aaaaaaaaacccddeeeeeeeegiiiiilnnnoooooooorsstuuuuuuyyzzz  '), '[^a-z0-9[:space:]]', ' ', 'g'), '[[:space:]]+', ' ', 'g'))) >= 8
      AND trim(both from regexp_replace(regexp_replace(translate(lower(trim(both from (${SQL_PREFIX_MATCH})[1])), 'àáâäãåāăąçćčđďèéêëēėęěğìíîïīįłńñňòóôõöøōřšťùúûüūůýÿžźż’\`', 'aaaaaaaaacccddeeeeeeeegiiiiilnnnoooooooorsstuuuuuuyyzzz  '), '[^a-z0-9[:space:]]', ' ', 'g'), '[[:space:]]+', ' ', 'g')) !~ '^(atelier|visites?|concert|exposition|expo|spectacle|conference|rencontre|projection)([[:space:]]|$)'
    THEN trim(both from (${SQL_PREFIX_MATCH})[2])
    ELSE ${SQL_TITLE_NO_YEAR}
  END
, '[^a-z0-9[:space:]]', ' ', 'g'), '[[:space:]]+', ' ', 'g'))`;

const EXPLORER_BASE_COLUMNS = `
  e.id,
  e.adapter_id,
  e.title,
  e.description,
  e.image_url,
  e.image_credit,
  e.image_license,
  e.image_source_url,
  e.start_at,
  e.end_at,
  e.all_day,
  e.venue,
  e.city,
  e.latitude,
  e.longitude,
  e.category,
  e.genre,
  e.conditions,
  e.source,
  e.source_url,
  e.registration_url,
  e.is_active,
  e.created_at,
  e.updated_at,
  e.last_seen_at,
  e.city_key,
  e.product_category,
  a.status AS availability_status,
  a.provider AS availability_provider,
  a.provider_event_url AS availability_provider_event_url,
  a.checked_at AS availability_checked_at
`.trim();

/** Ordre unique du représentant — injecté dans le ROW_NUMBER(). Alias `e`. */
const EXPLORER_REPRESENTATIVE_ORDER = `
  CASE
    WHEN e.registration_url ~* '^https://' THEN 0
    ELSE 1
  END ASC,
  CASE
    WHEN e.image_url IS NOT NULL AND btrim(e.image_url) <> '' THEN 0
    ELSE 1
  END ASC,
  CASE
    WHEN e.description IS NOT NULL AND length(btrim(e.description)) > 40 THEN 0
    ELSE 1
  END ASC,
  CASE
    WHEN e.conditions IS NOT NULL AND btrim(e.conditions) <> '' THEN 0
    ELSE 1
  END ASC,
  length(e.title) DESC,
  e.id ASC
`.trim();

export type ExplorerKeysetAfter = {
  startAt: Date;
  id: string;
};

/** Bornes temporelles déjà résolues (application/domain) — pas de calendrier en SQL. */
export type ExplorerTemporalFilter =
  | { mode: "bounded"; from: Date; to: Date }
  | { mode: "upcoming"; now: Date }
  /**
   * Frise / `upcoming` + from/to : début dans [from, to], encore actif à `now`.
   * Distinct de `bounded` (intersection d’intervalle Explorer).
   */
  | { mode: "startInWindowUpcoming"; from: Date; to: Date; now: Date };

export type ExplorerResolvedFilters = {
  temporal: ExplorerTemporalFilter;
  /** Pattern ILIKE (`%…%`) ou null = pas de filtre search. */
  searchPattern: string | null;
  /** `product_category` exact, ou null = pas de filtre. */
  productCategory: string | null;
  /** `city_key` exact, ou null = pas de filtre (inclut city_key NULL). */
  cityKey: string | null;
};

/**
 * WHERE partagé COUNT + page (sans cursor), alias `e`.
 * Predicats when = sémantique `isEventInWhenFilter`.
 */
export function buildExplorerFilterSql(filters: ExplorerResolvedFilters): {
  whereSql: string;
  params: unknown[];
} {
  const params: unknown[] = [];
  const parts: string[] = ["e.is_active = true"];

  if (filters.temporal.mode === "bounded") {
    params.push(filters.temporal.from.toISOString());
    const fromIdx = params.length;
    params.push(filters.temporal.to.toISOString());
    const toIdx = params.length;
    parts.push(`e.start_at <= $${toIdx}`);
    parts.push(`COALESCE(e.end_at, e.start_at) >= $${fromIdx}`);
  } else if (filters.temporal.mode === "startInWindowUpcoming") {
    params.push(filters.temporal.from.toISOString());
    const fromIdx = params.length;
    params.push(filters.temporal.to.toISOString());
    const toIdx = params.length;
    params.push(filters.temporal.now.toISOString());
    const nowIdx = params.length;
    parts.push(`e.start_at >= $${fromIdx}`);
    parts.push(`e.start_at <= $${toIdx}`);
    parts.push(`COALESCE(e.end_at, e.start_at) >= $${nowIdx}`);
  } else {
    params.push(filters.temporal.now.toISOString());
    const nowIdx = params.length;
    parts.push(`COALESCE(e.end_at, e.start_at) >= $${nowIdx}`);
  }

  if (filters.searchPattern) {
    params.push(filters.searchPattern);
    const searchIdx = params.length;
    parts.push(`(
      e.title ILIKE $${searchIdx} ESCAPE '\\'
      OR COALESCE(e.venue, '') ILIKE $${searchIdx} ESCAPE '\\'
      OR COALESCE(e.description, '') ILIKE $${searchIdx} ESCAPE '\\'
    )`);
  }

  if (filters.productCategory) {
    params.push(filters.productCategory);
    parts.push(`e.product_category = $${params.length}`);
  }

  if (filters.cityKey) {
    params.push(filters.cityKey);
    parts.push(`e.city_key = $${params.length}`);
  }

  return {
    whereSql: parts.join("\n  AND "),
    params,
  };
}

/**
 * CTE : filter → normalize → rank → representatives (rn = 1).
 * Grouping AVANT count / cursor / limit.
 * Availability : celle de la representative uniquement (V1 — pas de merge).
 */
export function buildExplorerRepresentativesCte(whereSql: string): string {
  return `
WITH filtered AS (
  SELECT
    ${EXPLORER_BASE_COLUMNS}
  FROM events e
  LEFT JOIN event_availability a ON a.event_id = e.id
  WHERE ${whereSql}
),
normalized AS (
  SELECT
    e.*,
    COALESCE(e.end_at, e.start_at) AS end_eff,
    ${SQL_VENUE_NORM} AS venue_norm,
    ${SQL_CANONICAL_TITLE} AS canonical_title
  FROM filtered e
),
ranked AS (
  SELECT
    e.*,
    ROW_NUMBER() OVER (
      PARTITION BY
        COALESCE(e.city_key, ''),
        CASE
          WHEN e.venue_norm = '' THEN e.id
          ELSE e.venue_norm
        END,
        e.start_at,
        e.end_eff,
        CASE
          WHEN e.canonical_title = '' THEN e.id
          ELSE e.canonical_title
        END
      ORDER BY
        ${EXPLORER_REPRESENTATIVE_ORDER}
    ) AS rn
  FROM normalized e
),
representatives AS (
  SELECT *
  FROM ranked
  WHERE rn = 1
)
`.trim();
}

const EXPLORER_PAGE_COLUMNS = `
  id,
  adapter_id,
  title,
  description,
  image_url,
  image_credit,
  image_license,
  image_source_url,
  start_at,
  end_at,
  all_day,
  venue,
  city,
  latitude,
  longitude,
  category,
  genre,
  conditions,
  source,
  source_url,
  registration_url,
  is_active,
  created_at,
  updated_at,
  last_seen_at,
  city_key,
  product_category,
  availability_status,
  availability_provider,
  availability_provider_event_url,
  availability_checked_at
`.trim();

export function buildExplorerCountSql(whereSql: string): string {
  return `
${buildExplorerRepresentativesCte(whereSql)}
SELECT count(*)::text AS count
FROM representatives
`.trim();
}

export function buildExplorerPageSql(params: {
  whereSql: string;
  keysetSql: string;
  limitIdx: number;
}): string {
  return `
${buildExplorerRepresentativesCte(params.whereSql)}
SELECT
  ${EXPLORER_PAGE_COLUMNS}
FROM representatives
${params.keysetSql}
ORDER BY start_at ASC, id ASC
LIMIT $${params.limitIdx}
`.trim();
}

/** Fragments exposés pour tests de contrat SQL ↔ TypeScript. */
export const EXPLORER_DEDUPE_SQL_FRAGMENTS = {
  venueNorm: SQL_VENUE_NORM,
  canonicalTitle: SQL_CANONICAL_TITLE,
  representativeOrder: EXPLORER_REPRESENTATIVE_ORDER,
} as const;
