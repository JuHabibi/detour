/**
 * Contrat TS ↔ SQL pour la facette audience jeune_public.
 * PGlite isolé — COUNT et filtre partagent le même prédicat.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  isJeunePublicAudience,
  sqlJeunePublicAudiencePredicate,
  type AudienceDetectionInput,
} from "@/domain/events/audience-jeune-public";
import { buildExplorerFilterSql } from "@/infrastructure/db/explorer-events.sql";
import type { DbQueryable } from "@/infrastructure/db/postgres";

type SqlEngine = {
  query: DbQueryable["query"];
  end: () => Promise<void>;
};

const SCHEMA_SQL = `
CREATE TABLE events (
  id text PRIMARY KEY,
  adapter_id text NOT NULL DEFAULT 'test',
  title text NOT NULL,
  description text NULL,
  category text NULL,
  is_active boolean NOT NULL DEFAULT true,
  start_at timestamptz NOT NULL,
  end_at timestamptz NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
`.trim();

const FIXTURES: Array<
  AudienceDetectionInput & { id: string; expectMatch: boolean }
> = [
  {
    id: "sole-jp",
    title: "Réveil livres",
    category: "Jeune public",
    expectMatch: true,
  },
  {
    id: "spectacle-jp",
    title: "BULLE",
    category: "Spectacle;Jeune public",
    expectMatch: true,
  },
  {
    id: "passerelle",
    title: "La Passerelle - Inavouable",
    category:
      "Spectacle;Musique;Exposition;Conférence - rencontre - débat;Jeune public",
    expectMatch: false,
  },
  {
    id: "cine-vacances",
    title: "LE ROBOT SAUVAGE",
    category: "CINÉ-VACANCES",
    expectMatch: true,
  },
  {
    id: "oreilles",
    title: "Histoires pour les petites oreilles",
    category: null,
    expectMatch: true,
  },
  {
    id: "enfants-only",
    title: "Concert pop",
    description: "Accueil des enfants bienvenu",
    category: "Musique",
    expectMatch: false,
  },
  {
    id: "tarif-only",
    title: "Opéra",
    description: "Tarif -12 ans : 8€",
    category: "Spectacle",
    expectMatch: false,
  },
  {
    id: "familial",
    title: "Hop ! en famille",
    category: "Sport",
    expectMatch: false,
  },
  {
    id: "age-band",
    title: "Stage d'arts plastiques (6-8 ans)",
    category: "Stage - atelier -  jeu",
    expectMatch: true,
  },
  {
    id: "ados-band",
    title: "Atelier écriture",
    description: "Pour les 12–16 ans",
    category: "Stage - atelier -  jeu",
    expectMatch: true,
  },
  {
    id: "des-14-seul",
    title: "Une histoire du Front Populaire (1934–1938)",
    description: "Conférence historique. Dès 14 ans.",
    category: "Exposition",
    expectMatch: false,
  },
  {
    id: "jp-des-6",
    title: "Spectacle jeune public, dès 6 ans",
    category: "Spectacle",
    expectMatch: true,
  },
];

async function createEngine(): Promise<SqlEngine> {
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
const START = "2026-11-01T18:00:00.000Z";

beforeAll(async () => {
  engine = await createEngine();
});

afterAll(async () => {
  await engine.end();
});

beforeEach(async () => {
  await engine.query("DELETE FROM events");
  for (const fixture of FIXTURES) {
    await engine.query(
      `INSERT INTO events (id, title, description, category, start_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        fixture.id,
        fixture.title,
        fixture.description ?? null,
        fixture.category ?? null,
        START,
      ],
    );
  }
});

describe("audience jeune_public — contrat SQL", () => {
  it("chaque fixture : isJeunePublicAudience === résultat SQL", async () => {
    const predicate = sqlJeunePublicAudiencePredicate("e");
    for (const fixture of FIXTURES) {
      expect(
        isJeunePublicAudience(fixture),
        `TS ${fixture.id}`,
      ).toBe(fixture.expectMatch);

      const result = await engine.query<{ id: string }>(
        `SELECT id FROM events e WHERE e.id = $1 AND ${predicate}`,
        [fixture.id],
      );
      const matched = result.rows.length === 1;
      expect(matched, `SQL ${fixture.id}`).toBe(fixture.expectMatch);
    }
  });

  it("buildExplorerFilterSql audience : COUNT == ids filtrés", async () => {
    const now = new Date("2026-10-01T12:00:00.000Z");
    const { whereSql, params } = buildExplorerFilterSql({
      temporal: { mode: "upcoming", now },
      searchPattern: null,
      productCategory: null,
      cityKey: null,
      audienceJeunePublic: true,
    });

    const countResult = await engine.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM events e WHERE ${whereSql}`,
      params,
    );
    const idsResult = await engine.query<{ id: string }>(
      `SELECT id FROM events e WHERE ${whereSql} ORDER BY id`,
      params,
    );

    const expectedIds = FIXTURES.filter((f) => f.expectMatch)
      .map((f) => f.id)
      .sort();
    expect(countResult.rows[0]?.n).toBe(expectedIds.length);
    expect(idsResult.rows.map((r) => r.id)).toEqual(expectedIds);
  });

  it("intersection type Spectacle + audience", async () => {
    const predicate = sqlJeunePublicAudiencePredicate("e");
    const result = await engine.query<{ id: string }>(
      `SELECT id FROM events e
       WHERE ${predicate}
         AND e.category ILIKE '%Spectacle%'
       ORDER BY id`,
    );
    expect(result.rows.map((r) => r.id)).toContain("spectacle-jp");
    expect(result.rows.map((r) => r.id)).not.toContain("passerelle");
    expect(result.rows.map((r) => r.id)).not.toContain("des-14-seul");
  });
});
