/**
 * Contrat SQL ↔ TypeScript pour la déduplication Explorer.
 *
 * Exécute le vrai SQL (fragments + `listExplorerEventsPage`) sur un Postgres isolé :
 * - PGlite (Postgres WASM) par défaut — aucune DATABASE_URL / prod ;
 * - ou `EXPLORER_TEST_DATABASE_URL` (Postgres classique dédié aux tests).
 *
 * Ne pas utiliser `.env.local` / `DATABASE_URL` ici.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";
import { PGlite } from "@electric-sql/pglite";
import {
  canonicalizeExplorerTitle,
  normalizeExplorerVenue,
} from "@/application/explorer/explorer-title-canonical";
import {
  EXPLORER_DEDUPE_SQL_FRAGMENTS,
  listExplorerEventsPage,
  type ExplorerResolvedFilters,
} from "@/infrastructure/db/explorer-events.repository";
import type { DbQueryable } from "@/infrastructure/db/postgres";

type SqlEngine = {
  query: DbQueryable["query"];
  end: () => Promise<void>;
};

const TEST_URL = process.env.EXPLORER_TEST_DATABASE_URL?.trim() || null;

const SCHEMA_SQL = `
CREATE TABLE events (
  id text PRIMARY KEY,
  adapter_id text NOT NULL,
  title text NOT NULL,
  description text NULL,
  image_url text NULL,
  image_credit text NULL,
  image_license text NULL,
  image_source_url text NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NULL,
  all_day boolean NOT NULL DEFAULT false,
  venue text NULL,
  city text NULL,
  latitude double precision NULL,
  longitude double precision NULL,
  category text NULL,
  genre text NULL,
  conditions text NULL,
  source text NULL,
  source_url text NULL,
  registration_url text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL,
  product_category text NULL,
  city_key text NULL
);

CREATE TABLE event_availability (
  event_id text PRIMARY KEY REFERENCES events (id) ON DELETE CASCADE,
  status text NOT NULL,
  provider text NOT NULL,
  provider_event_url text NULL,
  checked_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`.trim();

async function createEngine(): Promise<SqlEngine> {
  if (TEST_URL) {
    if (/neon\.tech|amazonaws\.com|supabase\.co/i.test(TEST_URL)) {
      throw new Error(
        "EXPLORER_TEST_DATABASE_URL seems hosted/shared — use an isolated local Postgres URL only.",
      );
    }
    const client = new Client({ connectionString: TEST_URL });
    await client.connect();
    await client.query("DROP TABLE IF EXISTS event_availability CASCADE");
    await client.query("DROP TABLE IF EXISTS events CASCADE");
    await client.query(SCHEMA_SQL);
    return {
      query: (text, values) => client.query(text, values),
      end: async () => {
        await client.end();
      },
    };
  }

  const db = new PGlite();
  await db.exec(SCHEMA_SQL);
  return {
    query: async (text, values) => {
      const result = await db.query(text, values ?? []);
      return {
        rows: result.rows as never[],
        rowCount: result.rows.length,
        command: "",
        oid: 0,
        fields: [],
      };
    },
    end: async () => {
      await db.close();
    },
  };
}

let engine: SqlEngine;

const START = "2026-09-11T15:30:00.000Z";
const END = "2026-09-11T21:59:00.000Z";
const NOW = new Date("2026-09-01T12:00:00.000Z");

const upcomingFilters: ExplorerResolvedFilters = {
  temporal: { mode: "upcoming", now: NOW },
  searchPattern: null,
  productCategory: null,
  cityKey: null,
};

async function sqlKeys(title: string, venue: string | null) {
  const result = await engine.query<{
    venue_norm: string;
    canonical_title: string;
  }>(
    `
SELECT
  ${EXPLORER_DEDUPE_SQL_FRAGMENTS.venueNorm} AS venue_norm,
  ${EXPLORER_DEDUPE_SQL_FRAGMENTS.canonicalTitle} AS canonical_title
FROM (SELECT $1::text AS title, $2::text AS venue) e
`.trim(),
    [title, venue],
  );
  return result.rows[0]!;
}

type SeedEvent = {
  id: string;
  title: string;
  venue?: string | null;
  registrationUrl?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  conditions?: string | null;
  cityKey?: string | null;
  startAt?: string;
  endAt?: string | null;
};

async function seed(events: SeedEvent[]) {
  await engine.query("DELETE FROM event_availability");
  await engine.query("DELETE FROM events");
  for (const event of events) {
    await engine.query(
      `
INSERT INTO events (
  id, adapter_id, title, description, image_url,
  start_at, end_at, venue, city, registration_url,
  conditions, is_active, last_seen_at, city_key
) VALUES (
  $1, 'contract', $2, $3, $4,
  $5::timestamptz, $6::timestamptz, $7, 'Orléans', $8,
  $9, true, $5::timestamptz, $10
)
`.trim(),
      [
        event.id,
        event.title,
        event.description ?? null,
        event.imageUrl ?? null,
        event.startAt ?? START,
        event.endAt === undefined ? END : event.endAt,
        event.venue === undefined ? "Campo Santo" : event.venue,
        event.registrationUrl ?? null,
        event.conditions ?? null,
        event.cityKey ?? "orleans",
      ],
    );
  }
}

beforeAll(async () => {
  engine = await createEngine();
});

afterAll(async () => {
  await engine?.end();
});

beforeEach(async () => {
  await engine.query("DELETE FROM event_availability");
  await engine.query("DELETE FROM events");
});

describe("Explorer dedupe SQL/TS contract", () => {
  const backend = TEST_URL ? "EXPLORER_TEST_DATABASE_URL" : "PGlite";

  it(`parité clés SQL ↔ TypeScript (${backend})`, async () => {
    const cases: Array<{
      label: string;
      title: string;
      venue: string | null;
    }> = [
      {
        label: "accents",
        title: "Bib créative",
        venue: "Médiathèque d'Orléans",
      },
      {
        label: "ponctuation",
        title: "Duo Zéphyr!",
        venue: "Salle de l'institut…",
      },
      {
        label: "année terminale",
        title: "Hop Pop Hop 2026",
        venue: "Campo Santo",
      },
      {
        label: "préfixe éditorial retiré",
        title: "Culture jazz - Histoire de la batterie dans le jazz",
        venue: "Médiathèque",
      },
      {
        label: "préfixe éditorial conservé (atelier)",
        title: "Atelier : poterie créative",
        venue: "Atelier municipal",
      },
      {
        label: "préfixe conservé (4 mots)",
        title: "Jeux vidéo casque VR : Elixir",
        venue: "Médiathèque",
      },
      { label: "lieu vide", title: "Concert jazz", venue: null },
      { label: "lieu blanc", title: "Concert jazz", venue: "   " },
      { label: "titre ponctuation seule", title: "!!!", venue: "Campo Santo" },
    ];

    const drifts: string[] = [];

    for (const c of cases) {
      const sql = await sqlKeys(c.title, c.venue);
      const tsVenue = normalizeExplorerVenue(c.venue);
      const tsTitle = canonicalizeExplorerTitle(c.title);
      if (sql.venue_norm !== tsVenue || sql.canonical_title !== tsTitle) {
        drifts.push(
          `${c.label}: SQL{venue=${JSON.stringify(sql.venue_norm)}, title=${JSON.stringify(sql.canonical_title)}} vs TS{venue=${JSON.stringify(tsVenue)}, title=${JSON.stringify(tsTitle)}}`,
        );
      }
    }

    expect(drifts, drifts.join("\n") || "ok").toEqual([]);
  });

  it("représentant : HTTPS > image > id ASC", async () => {
    await seed([
      {
        id: "rep-http-img",
        title: "HOP POP HOP",
        registrationUrl: "http://example.com/a",
        imageUrl: "https://cdn.example/a.jpg",
        description: "x".repeat(50),
        conditions: "Gratuit",
      },
      {
        id: "rep-https-noimg",
        title: "Hop Pop Hop 2026",
        registrationUrl: "https://example.com/b",
        imageUrl: null,
        description: null,
        conditions: null,
      },
    ]);

    const httpsWins = await listExplorerEventsPage({
      filters: upcomingFilters,
      limit: 10,
      client: engine,
      now: NOW,
    });
    expect(httpsWins.events.map((e) => e.id)).toEqual(["rep-https-noimg"]);

    await seed([
      {
        id: "rep-https-b",
        title: "Trio Wanderer",
        registrationUrl: "https://example.com/b",
        imageUrl: null,
      },
      {
        id: "rep-https-a",
        title: "Instants suspendus : Trio Wanderer",
        registrationUrl: "https://example.com/a",
        imageUrl: "https://cdn.example/a.jpg",
      },
    ]);

    const imageWins = await listExplorerEventsPage({
      filters: upcomingFilters,
      limit: 10,
      client: engine,
      now: NOW,
    });
    expect(imageWins.events.map((e) => e.id)).toEqual(["rep-https-a"]);

    await seed([
      {
        id: "rep-tie-z",
        title: "Same Title",
        registrationUrl: "https://example.com/z",
        imageUrl: "https://cdn.example/z.jpg",
        description: "x".repeat(50),
        conditions: "Payant",
      },
      {
        id: "rep-tie-a",
        title: "Same Title",
        registrationUrl: "https://example.com/a",
        imageUrl: "https://cdn.example/a.jpg",
        description: "x".repeat(50),
        conditions: "Payant",
      },
    ]);

    const idTieBreak = await listExplorerEventsPage({
      filters: upcomingFilters,
      limit: 10,
      client: engine,
      now: NOW,
    });
    expect(idTieBreak.events.map((e) => e.id)).toEqual(["rep-tie-a"]);
  });

  it("pas de regroupement si lieu ou titre canonique vide", async () => {
    await seed([
      {
        id: "empty-venue-a",
        title: "Same Show",
        venue: null,
      },
      {
        id: "empty-venue-b",
        title: "Same Show",
        venue: "",
      },
    ]);

    const emptyVenue = await listExplorerEventsPage({
      filters: upcomingFilters,
      limit: 10,
      client: engine,
      now: NOW,
    });
    expect(emptyVenue.events.map((e) => e.id).sort()).toEqual([
      "empty-venue-a",
      "empty-venue-b",
    ]);

    await seed([
      {
        id: "empty-title-a",
        title: "!!!",
        venue: "Campo Santo",
      },
      {
        id: "empty-title-b",
        title: "???",
        venue: "Campo Santo",
      },
    ]);

    const emptyTitle = await listExplorerEventsPage({
      filters: upcomingFilters,
      limit: 10,
      client: engine,
      now: NOW,
    });
    expect(emptyTitle.events.map((e) => e.id).sort()).toEqual([
      "empty-title-a",
      "empty-title-b",
    ]);
  });
});
