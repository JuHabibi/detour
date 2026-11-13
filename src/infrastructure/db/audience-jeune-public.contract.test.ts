/**
 * Contrat TS ↔ SQL pour la facette audience jeune_public.
 * PGlite isolé — COUNT et filtre partagent le même prédicat via buildExplorerFilterSql
 * (colonne `audience_jeune_public` calculée comme `isJeunePublicAudience`).
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
  product_category text NULL,
  audience_jeune_public boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  start_at timestamptz NOT NULL,
  end_at timestamptz NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
`.trim();

type Fixture = AudienceDetectionInput & {
  id: string;
  productCategory: string | null;
  expectMatch: boolean;
};

const FIXTURES: Fixture[] = [
  {
    id: "sole-jp",
    title: "Réveil livres",
    category: "Jeune public",
    productCategory: "Jeune public",
    expectMatch: true,
  },
  {
    id: "spectacle-jp",
    title: "BULLE",
    category: "Spectacle;Jeune public",
    productCategory: "Spectacle",
    expectMatch: true,
  },
  {
    id: "passerelle",
    title: "La Passerelle - Inavouable",
    category:
      "Spectacle;Musique;Exposition;Conférence - rencontre - débat;Jeune public",
    productCategory: "Spectacle",
    expectMatch: false,
  },
  {
    id: "cine-vacances",
    title: "LE ROBOT SAUVAGE",
    category: "CINÉ-VACANCES",
    productCategory: "Spectacle",
    expectMatch: true,
  },
  {
    id: "oreilles",
    title: "Histoires pour les petites oreilles",
    category: null,
    productCategory: "Jeune public",
    expectMatch: true,
  },
  {
    id: "enfants-only",
    title: "Concert pop",
    description: "Accueil des enfants bienvenu",
    category: "Musique",
    productCategory: "Musique",
    expectMatch: false,
  },
  {
    id: "tarif-only",
    title: "Opéra",
    description: "Tarif -12 ans : 8€",
    category: "Spectacle",
    productCategory: "Spectacle",
    expectMatch: false,
  },
  {
    id: "familial",
    title: "Hop ! en famille",
    category: "Sport",
    productCategory: "Autre",
    expectMatch: false,
  },
  {
    id: "age-band",
    title: "Stage d'arts plastiques (6-8 ans)",
    category: "Stage - atelier -  jeu",
    productCategory: "Atelier",
    expectMatch: true,
  },
  {
    id: "ados-band",
    title: "Atelier écriture",
    description: "Pour les 12–16 ans",
    category: "Stage - atelier -  jeu",
    productCategory: "Atelier",
    expectMatch: true,
  },
  {
    id: "des-14-seul",
    title: "Une histoire du Front Populaire (1934–1938)",
    description: "Conférence historique. Dès 14 ans.",
    category: "Exposition",
    productCategory: "Exposition",
    expectMatch: false,
  },
  {
    id: "jp-des-6",
    title: "Spectacle jeune public, dès 6 ans",
    category: "Spectacle",
    productCategory: "Spectacle",
    expectMatch: true,
  },
  {
    id: "pour-enfants-theme",
    title: "Conférence : politiques publiques pour les enfants",
    category: "Conférence - rencontre - débat",
    productCategory: "Rencontre",
    expectMatch: false,
  },
  {
    id: "concert-pour-enfants",
    title: "Noël à la salle des fêtes",
    description: "Un concert de Noël pour les enfants mais pas seulement.",
    category: "Musique",
    productCategory: "Musique",
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
    const audience = isJeunePublicAudience(fixture);
    await engine.query(
      `INSERT INTO events (
         id, title, description, category, product_category,
         audience_jeune_public, start_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        fixture.id,
        fixture.title,
        fixture.description ?? null,
        fixture.category ?? null,
        fixture.productCategory,
        audience,
        START,
      ],
    );
  }
});

describe("audience jeune_public — contrat SQL", () => {
  it("chaque fixture : isJeunePublicAudience === prédicat SQL legacy", async () => {
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

  it("colonne audience_jeune_public alignée sur isJeunePublicAudience", async () => {
    const result = await engine.query<{ id: string; audience_jeune_public: boolean }>(
      `SELECT id, audience_jeune_public FROM events ORDER BY id`,
    );
    for (const row of result.rows) {
      const fixture = FIXTURES.find((f) => f.id === row.id);
      expect(fixture).toBeDefined();
      expect(row.audience_jeune_public, row.id).toBe(fixture!.expectMatch);
    }
  });

  it("buildExplorerFilterSql audience : COUNT == ids filtrés (même prédicat colonne)", async () => {
    const now = new Date("2026-10-01T12:00:00.000Z");
    const { whereSql, params } = buildExplorerFilterSql({
      temporal: { mode: "upcoming", now },
      searchPattern: null,
      productCategory: null,
      cityKey: null,
      audienceJeunePublic: true,
    });

    expect(whereSql).toContain("e.audience_jeune_public = true");

    const countResult = await engine.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM events e CROSS JOIN LATERAL (SELECT e.start_at, e.end_at) s WHERE ${whereSql}`,
      params,
    );
    const idsResult = await engine.query<{ id: string }>(
      `SELECT id FROM events e CROSS JOIN LATERAL (SELECT e.start_at, e.end_at) s WHERE ${whereSql} ORDER BY id`,
      params,
    );

    const expectedIds = FIXTURES.filter((f) => f.expectMatch)
      .map((f) => f.id)
      .sort();
    expect(countResult.rows[0]?.n).toBe(expectedIds.length);
    expect(idsResult.rows.map((r) => r.id)).toEqual(expectedIds);
  });

  it("intersection product_category Spectacle + audience via buildExplorerFilterSql", async () => {
    const now = new Date("2026-10-01T12:00:00.000Z");
    const { whereSql, params } = buildExplorerFilterSql({
      temporal: { mode: "upcoming", now },
      searchPattern: null,
      productCategory: "Spectacle",
      cityKey: null,
      audienceJeunePublic: true,
    });

    expect(whereSql).toContain("e.product_category = $");
    expect(whereSql).toContain("e.audience_jeune_public = true");
    expect(whereSql).not.toMatch(/e\.category ILIKE '%Spectacle%'/i);

    const countResult = await engine.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM events e CROSS JOIN LATERAL (SELECT e.start_at, e.end_at) s WHERE ${whereSql}`,
      params,
    );
    const idsResult = await engine.query<{ id: string }>(
      `SELECT id FROM events e CROSS JOIN LATERAL (SELECT e.start_at, e.end_at) s WHERE ${whereSql} ORDER BY id`,
      params,
    );

    const expectedIds = FIXTURES.filter(
      (f) => f.expectMatch && f.productCategory === "Spectacle",
    )
      .map((f) => f.id)
      .sort();

    expect(countResult.rows[0]?.n).toBe(expectedIds.length);
    expect(idsResult.rows.map((r) => r.id)).toEqual(expectedIds);
    expect(expectedIds).toContain("spectacle-jp");
    expect(expectedIds).toContain("cine-vacances");
    expect(expectedIds).toContain("jp-des-6");
    expect(idsResult.rows.map((r) => r.id)).not.toContain("passerelle");
    expect(idsResult.rows.map((r) => r.id)).not.toContain("des-14-seul");
    expect(idsResult.rows.map((r) => r.id)).not.toContain("concert-pour-enfants");
  });
});
