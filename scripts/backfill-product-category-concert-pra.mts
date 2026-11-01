/**
 * Backfill PR-A : reclassement concerts `Spectacle` → `Musique`.
 *
 * Réutilise `classifyEventCategory` (SSOT TypeScript) — pas de miroir SQL.
 * Candidats = tags `Spectacle / Concert` ou paire exacte Musique↔Spectacle.
 * Écriture verrouillée : uniquement la transition Spectacle → Musique.
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
import {
  isPraConcertBackfillChange,
  PRA_CONCERT_BACKFILL_FROM,
  PRA_CONCERT_BACKFILL_TO,
} from "./backfill-product-category-concert-pra.guard";

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

/** UPDATE verrouillé en dur : uniquement Spectacle → Musique. */
const APPLY_UPDATE_SQL = `
  UPDATE events
  SET product_category = 'Musique', updated_at = now()
  WHERE id = $1
    AND product_category = 'Spectacle'
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
      before: typeof PRA_CONCERT_BACKFILL_FROM;
      after: typeof PRA_CONCERT_BACKFILL_TO;
    }> = [];

    let skippedOtherTransitions = 0;

    for (const row of rows) {
      const after = classifyEventCategory(toEvent(row));
      const before = row.product_category ?? null;
      if (before === after) continue;
      // Garde-fou sélection : Spectacle → Musique uniquement.
      if (!isPraConcertBackfillChange(before, after)) {
        skippedOtherTransitions += 1;
        continue;
      }
      changes.push({
        id: row.id,
        title: row.title,
        category: row.category,
        adapter_id: row.adapter_id,
        before: PRA_CONCERT_BACKFILL_FROM,
        after: PRA_CONCERT_BACKFILL_TO,
      });
    }

    console.log(
      JSON.stringify(
        {
          mode: APPLY ? "apply" : "dry-run",
          candidates: rows.length,
          changes: changes.length,
          skipped_other_transitions: skippedOtherTransitions,
          allowed_transition: `${PRA_CONCERT_BACKFILL_FROM}→${PRA_CONCERT_BACKFILL_TO}`,
          by_transition: {
            [`${PRA_CONCERT_BACKFILL_FROM}→${PRA_CONCERT_BACKFILL_TO}`]: changes.length,
          },
          rows: changes,
        },
        null,
        2,
      ),
    );

    if (!APPLY) {
      console.error(
        `\nDry-run : ${changes.length} changement(s) / ${rows.length} candidat(s)` +
          (skippedOtherTransitions
            ? ` (${skippedOtherTransitions} autre(s) transition(s) ignorée(s))`
            : "") +
          `. Relancer avec --apply pour écrire.`,
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
      if (!isPraConcertBackfillChange(change.before, change.after)) {
        throw new Error(
          `Transition interdite pour ${change.id}: ${change.before}→${change.after}`,
        );
      }
      const result = await client.query(APPLY_UPDATE_SQL, [change.id]);
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
