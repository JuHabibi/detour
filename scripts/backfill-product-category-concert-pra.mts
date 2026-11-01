/**
 * Backfill PR-A : reclassement concerts `Spectacle` → `Musique`.
 *
 * Réutilise `classifyEventCategory` (SSOT TypeScript) — pas de miroir SQL.
 * Candidats = tags `Spectacle / Concert` ou paire exacte Musique↔Spectacle.
 *
 * Usage :
 *   npx tsx scripts/backfill-product-category-concert-pra.mts           # dry-run
 *   npx tsx scripts/backfill-product-category-concert-pra.mts --apply   # écrit Neon
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { classifyEventCategory } from "../src/domain/events/classify-event-category";
import type { DetourEvent } from "../src/domain/events/event";

const APPLY = process.argv.includes("--apply");

function loadDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  const envPath = resolve(process.cwd(), ".env.local");
  const env = readFileSync(envPath, "utf8");
  const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  if (!url) throw new Error("DATABASE_URL manquante (.env.local ou env)");
  return url;
}

type CandidateRow = {
  id: string;
  title: string;
  description: string | null;
  venue: string | null;
  city: string | null;
  category: string | null;
  genre: string | null;
  product_category: string | null;
  source: string | null;
  adapter_id: string;
  start_at: Date;
  end_at: Date | null;
  all_day: boolean | null;
};

/** Même filtre tag que l’override PR-A (agnostique adapter / source). */
const CANDIDATE_SQL = `
  SELECT
    id, title, description, venue, city, category, genre,
    product_category, source, adapter_id, start_at, end_at, all_day
  FROM events
  WHERE
    trim(category) ILIKE 'Spectacle / Concert'
    OR trim(category) ILIKE 'Spectacle/Concert'
    OR trim(category) ILIKE 'Concert / Spectacle'
    OR (
      array_length(string_to_array(category, ';'), 1) = 2
      AND lower(trim(split_part(category, ';', 1))) IN ('musique', 'spectacle')
      AND lower(trim(split_part(category, ';', 2))) IN ('musique', 'spectacle')
      AND lower(trim(split_part(category, ';', 1)))
        <> lower(trim(split_part(category, ';', 2)))
    )
  ORDER BY start_at ASC NULLS LAST, id ASC
`;

function toEvent(row: CandidateRow): DetourEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: null,
    startAt:
      row.start_at instanceof Date
        ? row.start_at.toISOString()
        : String(row.start_at),
    endAt:
      row.end_at instanceof Date
        ? row.end_at.toISOString()
        : row.end_at
          ? String(row.end_at)
          : null,
    ...(row.all_day ? { allDay: true as const } : {}),
    venue: row.venue,
    city: row.city,
    latitude: null,
    longitude: null,
    category: row.category,
    genre: row.genre,
    conditions: null,
    source: row.source,
    sourceUrl: null,
    registrationUrl: null,
  };
}

async function main() {
  const client = new Client({ connectionString: loadDatabaseUrl() });
  await client.connect();

  try {
    const { rows } = await client.query<CandidateRow>(CANDIDATE_SQL);

    const changes: Array<{
      id: string;
      title: string;
      category: string | null;
      adapter_id: string;
      before: string | null;
      after: string;
    }> = [];

    for (const row of rows) {
      const after = classifyEventCategory(toEvent(row));
      const before = row.product_category ?? null;
      if (before === after) continue;
      changes.push({
        id: row.id,
        title: row.title,
        category: row.category,
        adapter_id: row.adapter_id,
        before,
        after,
      });
    }

    console.log(
      JSON.stringify(
        {
          mode: APPLY ? "apply" : "dry-run",
          candidates: rows.length,
          changes: changes.length,
          by_transition: Object.fromEntries(
            [...new Set(changes.map((c) => `${c.before ?? "(null)"}→${c.after}`))].map(
              (key) => [key, changes.filter((c) => `${c.before ?? "(null)"}→${c.after}` === key).length],
            ),
          ),
          rows: changes,
        },
        null,
        2,
      ),
    );

    if (!APPLY) {
      console.error(
        `\nDry-run : ${changes.length} changement(s) / ${rows.length} candidat(s). Relancer avec --apply pour écrire.`,
      );
      return;
    }

    if (changes.length === 0) {
      console.error("Rien à appliquer (idempotent).");
      return;
    }

    await client.query("BEGIN");
    let updated = 0;
    for (const change of changes) {
      const result = await client.query(
        `UPDATE events
         SET product_category = $1, updated_at = now()
         WHERE id = $2
           AND product_category IS NOT DISTINCT FROM $3`,
        [change.after, change.id, change.before],
      );
      updated += result.rowCount ?? 0;
    }
    await client.query("COMMIT");
    console.error(`Appliqué : ${updated} ligne(s) mise(s) à jour.`);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    await client.end();
  }
}

await main();
