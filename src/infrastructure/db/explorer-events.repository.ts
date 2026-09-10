import type { DetourEvent } from "@/domain/events/event";
import { attachAvailabilityToEvent } from "@/domain/events/attach-availability";
import type { EventAvailabilityRecord } from "@/domain/events/event-availability";
import {
  mapEventRowToDetourEvent,
  type EventRow,
} from "@/infrastructure/db/event-row.mapper";
import { getPool, type DbQueryable } from "@/infrastructure/db/postgres";

/**
 * Fold SQL (accents FR courants) — aligné sur foldExplorerText pour le latin1 courant.
 * Pas d’extension unaccent requise.
 */
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

type EventRowWithAvailability = EventRow & {
  availability_status: string | null;
  availability_provider: string | null;
  availability_provider_event_url: string | null;
  availability_checked_at: Date | null;
  city_key?: string | null;
  product_category?: string | null;
};

export type ExplorerKeysetAfter = {
  startAt: Date;
  id: string;
};

/** Bornes temporelles déjà résolues (application/domain) — pas de calendrier en SQL. */
export type ExplorerTemporalFilter =
  | { mode: "bounded"; from: Date; to: Date }
  | { mode: "upcoming"; now: Date };

export type ExplorerResolvedFilters = {
  temporal: ExplorerTemporalFilter;
  /** Pattern ILIKE (`%…%`) ou null = pas de filtre search. */
  searchPattern: string | null;
  /** `product_category` exact, ou null = pas de filtre. */
  productCategory: string | null;
  /** `city_key` exact, ou null = pas de filtre (inclut city_key NULL). */
  cityKey: string | null;
};

function db(client?: DbQueryable): DbQueryable {
  return client ?? getPool();
}

function toAvailabilityRecord(
  row: EventRowWithAvailability,
): EventAvailabilityRecord | null {
  if (!row.availability_status || !row.availability_checked_at) {
    return null;
  }
  return {
    eventId: row.id,
    status: row.availability_status as EventAvailabilityRecord["status"],
    provider: row.availability_provider ?? "",
    providerEventUrl: row.availability_provider_event_url,
    checkedAt: row.availability_checked_at,
  };
}

function mapRow(row: EventRowWithAvailability, now: Date): DetourEvent {
  const event = mapEventRowToDetourEvent(row);
  return attachAvailabilityToEvent(event, toAvailabilityRecord(row), now);
}

/**
 * Construit le WHERE partagé COUNT + page (sans cursor), alias `e`.
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
 *
 * Availability : celle de la representative uniquement (V1 — pas de merge).
 */
function buildExplorerRepresentativesCte(whereSql: string): string {
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
    filtered.*,
    COALESCE(filtered.end_at, filtered.start_at) AS end_eff,
    ${SQL_VENUE_NORM.replaceAll("e.", "filtered.")} AS venue_norm,
    ${SQL_CANONICAL_TITLE.replaceAll("e.", "filtered.")} AS canonical_title
  FROM filtered
),
ranked AS (
  SELECT
    normalized.*,
    ROW_NUMBER() OVER (
      PARTITION BY
        COALESCE(normalized.city_key, ''),
        CASE
          WHEN normalized.venue_norm = '' THEN normalized.id
          ELSE normalized.venue_norm
        END,
        normalized.start_at,
        normalized.end_eff,
        CASE
          WHEN normalized.canonical_title = '' THEN normalized.id
          ELSE normalized.canonical_title
        END
      ORDER BY
        CASE
          WHEN normalized.registration_url ~* '^https://' THEN 0
          ELSE 1
        END ASC,
        CASE
          WHEN normalized.image_url IS NOT NULL AND btrim(normalized.image_url) <> '' THEN 0
          ELSE 1
        END ASC,
        CASE
          WHEN normalized.description IS NOT NULL AND length(btrim(normalized.description)) > 40 THEN 0
          ELSE 1
        END ASC,
        CASE
          WHEN normalized.conditions IS NOT NULL AND btrim(normalized.conditions) <> '' THEN 0
          ELSE 1
        END ASC,
        length(normalized.title) DESC,
        normalized.id ASC
    ) AS rn
  FROM normalized
),
representatives AS (
  SELECT *
  FROM ranked
  WHERE rn = 1
)
`.trim();
}

/** Compte les GROUPES filtrés — pas les rows brutes. */
export async function countExplorerEvents(params: {
  filters: ExplorerResolvedFilters;
  client?: DbQueryable;
}): Promise<number> {
  const { whereSql, params: filterParams } = buildExplorerFilterSql(
    params.filters,
  );
  const cte = buildExplorerRepresentativesCte(whereSql);
  const result = await db(params.client).query<{ count: string }>(
    `
${cte}
SELECT count(*)::text AS count
FROM representatives
`.trim(),
    filterParams,
  );
  return Number(result.rows[0]?.count ?? 0);
}

/**
 * Page Explorer keyset sur representatives (start_at, id).
 * Cursor appliqué après grouping ; lit `limit + 1`.
 */
export async function listExplorerEventsPage(params: {
  filters: ExplorerResolvedFilters;
  after?: ExplorerKeysetAfter | null;
  limit: number;
  client?: DbQueryable;
  now?: Date;
}): Promise<{
  events: DetourEvent[];
  nextAfter: ExplorerKeysetAfter | null;
}> {
  const mapNow = params.now ?? new Date();
  const fetchLimit = params.limit + 1;
  const { whereSql, params: filterParams } = buildExplorerFilterSql(
    params.filters,
  );
  const sqlParams = [...filterParams];
  const cte = buildExplorerRepresentativesCte(whereSql);

  let keysetSql = "";
  const after = params.after ?? null;
  if (after) {
    sqlParams.push(after.startAt.toISOString());
    const startIdx = sqlParams.length;
    sqlParams.push(after.id);
    const idIdx = sqlParams.length;
    keysetSql = `
WHERE (
  start_at > $${startIdx}
  OR (start_at = $${startIdx} AND id > $${idIdx})
)`;
  }

  sqlParams.push(fetchLimit);
  const limitIdx = sqlParams.length;

  const result = await db(params.client).query<EventRowWithAvailability>(
    `
${cte}
SELECT
  id,
  adapter_id,
  title,
  description,
  image_url,
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
FROM representatives
${keysetSql}
ORDER BY start_at ASC, id ASC
LIMIT $${limitIdx}
`.trim(),
    sqlParams,
  );

  const rows = result.rows;
  const hasMore = rows.length > params.limit;
  const pageRows = hasMore ? rows.slice(0, params.limit) : rows;
  const events = pageRows.map((row) => mapRow(row, mapNow));

  const last = pageRows[pageRows.length - 1];
  const nextAfter =
    hasMore && last ? { startAt: last.start_at, id: last.id } : null;

  return { events, nextAfter };
}

/** Exposé pour tests SQL / doc — ordre de ranking representative. */
export const EXPLORER_DEDUPE_SQL_FRAGMENTS = {
  venueNorm: SQL_VENUE_NORM,
  canonicalTitle: SQL_CANONICAL_TITLE,
  representativeOrder: EXPLORER_REPRESENTATIVE_ORDER,
} as const;
