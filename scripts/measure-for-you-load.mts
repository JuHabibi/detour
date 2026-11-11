/**
 * Benchmark serveur « Pour vous » (hors session Better Auth).
 *
 * Usage :
 *   node --conditions=react-server --import tsx --env-file=.env.local scripts/measure-for-you-load.mts
 *
 * Mesure : lecture profil (si USER_ID), requêtes Explorer par catégorie (parallèle),
 * EXPLAIN (ANALYZE, BUFFERS) sur une page Musique,
 * comparaison modèle waterfall (2 auth + 2 profil) vs bundle unifié (1 auth + 1 profil).
 */
import { Client } from "pg";
import { listExplorerEvents } from "../src/application/explorer/list-explorer-events";
import { FOR_YOU_CANDIDATES_PER_CATEGORY } from "../src/application/personalization/get-for-you-recommendations";
import { getForYouRecommendations } from "../src/application/personalization/get-for-you-recommendations";
import {
  buildExplorerFilterSql,
  buildExplorerPageSql,
  type ExplorerResolvedFilters,
} from "../src/infrastructure/db/explorer-events.sql";
import type { ForYouPreferences } from "../src/domain/personalization/select-for-you-events";

async function timeMs<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  const value = await fn();
  const ms = Math.round((performance.now() - t0) * 10) / 10;
  console.log(`${label}: ${ms}ms`);
  return value;
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL manquant");
    process.exit(2);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const db = {
    query: (sql: string, params?: unknown[]) => client.query(sql, params),
  };

  const userId = process.env.DETOUR_PERF_USER_ID?.trim();
  if (userId) {
    await timeMs("getUserProfile", async () => {
      const result = await client.query(
        `SELECT user_id, interests, availabilities, budget, onboarding_status
         FROM user_profiles WHERE user_id = $1`,
        [userId],
      );
      console.log("  rows=", result.rowCount, "interests=", result.rows[0]?.interests);
      return result.rows[0] ?? null;
    });
  } else {
    console.log("getUserProfile: skip (set DETOUR_PERF_USER_ID pour mesurer)");
  }

  const categories = ["Musique", "Exposition", "Cinéma"] as const;
  const now = new Date();

  console.log("\n--- Explorer par catégorie (séquentiel) ---");
  for (const category of categories) {
    await timeMs(`listExplorerEvents ${category} sequential`, async () => {
      const page = await listExplorerEvents(
        {
          when: "upcoming",
          category,
          limit: FOR_YOU_CANDIDATES_PER_CATEGORY,
        },
        { client: db, now, skipCount: true },
      );
      console.log(`  events=${page.events.length}`);
      return page;
    });
  }

  console.log("\n--- Explorer 3 catégories (Promise.all) ---");
  await timeMs("listExplorerEvents x3 parallel", async () => {
    const pages = await Promise.all(
      categories.map((category) =>
        listExplorerEvents(
          {
            when: "upcoming",
            category,
            limit: FOR_YOU_CANDIDATES_PER_CATEGORY,
          },
          { client: db, now, skipCount: true },
        ),
      ),
    );
    console.log(
      "  counts=",
      pages.map((page) => page.events.length).join(","),
    );
    return pages;
  });

  const prefs: ForYouPreferences = {
    interests: ["Musique", "Exposition", "Cinéma"],
    availabilities: ["flexible"],
    budget: "any",
  };
  console.log("\n--- getForYouRecommendations (3 intérêts) ---");
  const recResult = await timeMs("getForYouRecommendations", async () => {
    const result = await getForYouRecommendations(prefs, {
      client: db,
      now,
    });
    console.log(
      `  candidates=${result.candidateCount} selected=${result.events.length}`,
    );
    return result;
  });

  console.log("\n--- Modèle Home : waterfall vs bundle unifié (SQL seul) ---");
  console.log(
    "  Avant (waterfall client) : 2× auth session + 2× getUserProfile + 1× recommandations",
  );
  console.log(
    "  Après (getMyPersonalizationHome) : 1× auth session + 1× getUserProfile + 1× recommandations",
  );
  console.log(
    "  (auth Better Auth non mesurée ici — le gain principal est 1 RTT client + 1 auth + 1 lecture profil)",
  );

  if (userId) {
    await timeMs("bundle SQL simulé (1 profil + recommandations)", async () => {
      const profile = await client.query(
        `SELECT user_id, interests, availabilities, budget, onboarding_status
         FROM user_profiles WHERE user_id = $1`,
        [userId],
      );
      const row = profile.rows[0];
      if (!row || row.onboarding_status !== "completed") {
        console.log("  forYou=not_configured");
        return null;
      }
      const interests = row.interests as string[];
      const result = await getForYouRecommendations(
        {
          interests,
          availabilities: row.availabilities,
          budget: row.budget,
        },
        { client: db, now },
      );
      console.log(
        `  selected=${result.events.length} (ref parallel=${recResult.events.length})`,
      );
      return result;
    });

    await timeMs(
      "waterfall SQL simulé (2× profil + recommandations)",
      async () => {
        await client.query(
          `SELECT user_id FROM user_profiles WHERE user_id = $1`,
          [userId],
        );
        await client.query(
          `SELECT user_id, interests, availabilities, budget, onboarding_status
           FROM user_profiles WHERE user_id = $1`,
          [userId],
        );
        await getForYouRecommendations(prefs, { client: db, now });
        return null;
      },
    );
  }

  console.log("\n--- EXPLAIN ANALYZE page Musique ---");
  const filters: ExplorerResolvedFilters = {
    temporal: { mode: "upcoming", now },
    searchPattern: null,
    productCategory: "Musique",
    cityKey: null,
  };
  const { whereSql, params: filterParams } = buildExplorerFilterSql(filters);
  const sqlParams = [...filterParams, FOR_YOU_CANDIDATES_PER_CATEGORY + 1];
  const pageSql = buildExplorerPageSql({
    whereSql,
    keysetSql: "",
    limitIdx: sqlParams.length,
  });
  const explain = await client.query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)\n${pageSql}`,
    sqlParams,
  );
  for (const row of explain.rows) {
    console.log(row["QUERY PLAN"] ?? Object.values(row)[0]);
  }

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
