/**
 * Backfill PR-B : reclassement projections → `Cinéma`.
 *
 * Réutilise `classifyEventCategory` (SSOT TypeScript) — pas de miroir SQL.
 * Transitions autorisées : Spectacle → Cinéma, Autre → Cinéma.
 *
 * Usage :
 *   npx tsx scripts/backfill-product-category-cinema.mts           # dry-run
 *   npx tsx scripts/backfill-product-category-cinema.mts --apply   # écrit Neon
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { classifyEventCategory } from "../src/domain/events/classify-event-category";
import type { DetourEvent } from "../src/domain/events/event";
import {
  isPraCinemaBackfillChange,
  PRA_CINEMA_BACKFILL_TO,
  type PraCinemaBackfillFrom,
} from "./backfill-product-category-cinema.guard";

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

/**
 * Candidats : actuellement Spectacle ou Autre (où vivent les projections
 * et CINÉ-VACANCES). Le classifieur tranche ensuite.
 */
const CANDIDATE_SQL = `
  SELECT
    id, title, description, venue, city, category, genre,
    product_category, source, adapter_id, start_at, end_at, all_day
  FROM events
  WHERE product_category IN ('Spectacle', 'Autre')
  ORDER BY start_at ASC NULLS LAST, id ASC
`;

/** UPDATE verrouillé : uniquement → Cinéma depuis Spectacle ou Autre. */
const APPLY_UPDATE_SQL = `
  UPDATE events
  SET product_category = 'Cinéma', updated_at = now()
  WHERE id = $1
    AND product_category = $2
    AND product_category IN ('Spectacle', 'Autre')
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
      before: PraCinemaBackfillFrom;
      after: typeof PRA_CINEMA_BACKFILL_TO;
    }> = [];

    let skippedOtherTransitions = 0;

    for (const row of rows) {
      const after = classifyEventCategory(toEvent(row));
      const before = row.product_category ?? null;
      if (before === after) continue;
      if (!isPraCinemaBackfillChange(before, after)) {
        skippedOtherTransitions += 1;
        continue;
      }
      changes.push({
        id: row.id,
        title: row.title,
        category: row.category,
        adapter_id: row.adapter_id,
        before,
        after: PRA_CINEMA_BACKFILL_TO,
      });
    }

    const byTransition: Record<string, number> = {};
    for (const change of changes) {
      const key = `${change.before}→${change.after}`;
      byTransition[key] = (byTransition[key] ?? 0) + 1;
    }

    console.log(
      JSON.stringify(
        {
          mode: APPLY ? "apply" : "dry-run",
          candidates: rows.length,
          changes: changes.length,
          skipped_other_transitions: skippedOtherTransitions,
          allowed_transitions: ["Spectacle→Cinéma", "Autre→Cinéma"],
          by_transition: byTransition,
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
      if (!isPraCinemaBackfillChange(change.before, change.after)) {
        throw new Error(
          `Transition interdite pour ${change.id}: ${change.before}→${change.after}`,
        );
      }
      const result = await client.query(APPLY_UPDATE_SQL, [
        change.id,
        change.before,
      ]);
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
