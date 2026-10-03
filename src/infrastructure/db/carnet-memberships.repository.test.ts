/**
 * Contrat transactionnel applyEventCarnetMembershipsForUser — PGlite isolé.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { applyEventCarnetMembershipsForUser } from "@/infrastructure/db/carnet-memberships.repository";
import type { DbQueryable } from "@/infrastructure/db/postgres";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const GROUP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GROUP_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const GROUP_OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const SCHEMA_SQL = `
CREATE TABLE "user" (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id text PRIMARY KEY,
  adapter_id text NOT NULL,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE TABLE groups (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE group_events (
  group_id uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, event_id)
);
`.trim();

type SqlEngine = {
  query: DbQueryable["query"];
  end: () => Promise<void>;
  raw: PGlite;
};

async function createEngine(): Promise<SqlEngine> {
  const db = new PGlite();
  await db.exec(SCHEMA_SQL);
  return {
    raw: db,
    query: async (text, values) => {
      const result = await db.query(text, values ?? []);
      return {
        rows: result.rows as never[],
        rowCount: result.rowCount ?? result.affectedRows ?? result.rows.length,
        command: result.command ?? "",
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

async function seedBase() {
  await engine.query(`DELETE FROM group_events`);
  await engine.query(`DELETE FROM favorites`);
  await engine.query(`DELETE FROM groups`);
  await engine.query(`DELETE FROM events`);
  await engine.query(`DELETE FROM "user"`);

  await engine.query(
    `INSERT INTO "user" (id, name, email) VALUES ($1, 'A', 'a@test.fr'), ($2, 'B', 'b@test.fr')`,
    [USER_A, USER_B],
  );
  await engine.query(
    `
INSERT INTO events (id, adapter_id, title, start_at, last_seen_at) VALUES
  ('e1', 't', 'Event 1', '2026-10-01T10:00:00Z', '2026-10-01T10:00:00Z'),
  ('e2', 't', 'Event 2', '2026-10-02T10:00:00Z', '2026-10-02T10:00:00Z'),
  ('e3', 't', 'Event 3', '2026-10-03T10:00:00Z', '2026-10-03T10:00:00Z')
`.trim(),
  );
  await engine.query(
    `
INSERT INTO groups (id, user_id, name) VALUES
  ($1, $2, 'Carnet A'),
  ($3, $2, 'Carnet B'),
  ($4, $5, 'Carnet autre')
`.trim(),
    [GROUP_A, USER_A, GROUP_B, GROUP_OTHER, USER_B],
  );
}

async function favoriteIds(userId: string): Promise<string[]> {
  const r = await engine.query<{ event_id: string }>(
    `SELECT event_id FROM favorites WHERE user_id = $1 ORDER BY event_id`,
    [userId],
  );
  return r.rows.map((row) => row.event_id);
}

async function members(groupId: string): Promise<string[]> {
  const r = await engine.query<{ event_id: string }>(
    `SELECT event_id FROM group_events WHERE group_id = $1 ORDER BY event_id`,
    [groupId],
  );
  return r.rows.map((row) => row.event_id);
}

beforeAll(async () => {
  engine = await createEngine();
});

afterAll(async () => {
  await engine?.end();
});

beforeEach(async () => {
  await seedBase();
});

describe("applyEventCarnetMembershipsForUser (PGlite)", () => {
  it("ajout et retrait réussis + favori créé si besoin", async () => {
    await engine.query(
      `INSERT INTO group_events (group_id, event_id) VALUES ($1, 'e1')`,
      [GROUP_A],
    );

    const result = await applyEventCarnetMembershipsForUser({
      userId: USER_A,
      eventIds: ["e1"],
      addGroupIds: [GROUP_B],
      removeGroupIds: [GROUP_A],
      client: engine,
    });

    expect(result).toEqual({ status: "ok" });
    expect(await favoriteIds(USER_A)).toEqual(["e1"]);
    expect(await members(GROUP_A)).toEqual([]);
    expect(await members(GROUP_B)).toEqual(["e1"]);
  });

  it("échec après une première écriture → rollback intégral (favori inclus)", async () => {
    let favoriteInserts = 0;
    const failingClient: DbQueryable = {
      query: async (text, values) => {
        const sql = text.trim();
        if (/^INSERT INTO favorites/i.test(sql)) {
          favoriteInserts += 1;
        }
        if (
          favoriteInserts > 0 &&
          /^WITH wanted AS/i.test(sql)
        ) {
          throw new Error("simulated failure after favorite write");
        }
        return engine.query(text, values);
      },
    };

    await expect(
      applyEventCarnetMembershipsForUser({
        userId: USER_A,
        eventIds: ["e1"],
        addGroupIds: [GROUP_A],
        removeGroupIds: [],
        client: failingClient,
      }),
    ).rejects.toThrow(/simulated failure/);

    expect(await favoriteIds(USER_A)).toEqual([]);
    expect(await members(GROUP_A)).toEqual([]);
  });

  it("carnet d’un autre utilisateur → aucune écriture", async () => {
    const result = await applyEventCarnetMembershipsForUser({
      userId: USER_A,
      eventIds: ["e1"],
      addGroupIds: [GROUP_OTHER],
      removeGroupIds: [],
      client: engine,
    });

    expect(result).toEqual({ status: "not_found" });
    expect(await favoriteIds(USER_A)).toEqual([]);
    expect(await members(GROUP_OTHER)).toEqual([]);
    expect(await members(GROUP_A)).toEqual([]);
  });

  it("nouvelle tentative idempotente (déjà membre / déjà retiré)", async () => {
    const first = await applyEventCarnetMembershipsForUser({
      userId: USER_A,
      eventIds: ["e1"],
      addGroupIds: [GROUP_A],
      removeGroupIds: [],
      client: engine,
    });
    expect(first).toEqual({ status: "ok" });

    const second = await applyEventCarnetMembershipsForUser({
      userId: USER_A,
      eventIds: ["e1"],
      addGroupIds: [GROUP_A],
      removeGroupIds: [GROUP_B],
      client: engine,
    });
    expect(second).toEqual({ status: "ok" });
    expect(await members(GROUP_A)).toEqual(["e1"]);
    expect(await members(GROUP_B)).toEqual([]);
    expect(await favoriteIds(USER_A)).toEqual(["e1"]);
  });

  it("appartenances partielles non concernées préservées", async () => {
    // GROUP_A contient e1+e2 ; on n’opère que sur e1 → e2 reste.
    await engine.query(
      `INSERT INTO favorites (user_id, event_id) VALUES ($1, 'e1'), ($1, 'e2')`,
      [USER_A],
    );
    await engine.query(
      `
INSERT INTO group_events (group_id, event_id) VALUES
  ($1, 'e1'),
  ($1, 'e2'),
  ($2, 'e2')
`.trim(),
      [GROUP_A, GROUP_B],
    );

    const result = await applyEventCarnetMembershipsForUser({
      userId: USER_A,
      eventIds: ["e1"],
      addGroupIds: [GROUP_B],
      removeGroupIds: [GROUP_A],
      client: engine,
    });

    expect(result).toEqual({ status: "ok" });
    expect(await members(GROUP_A)).toEqual(["e2"]);
    expect(await members(GROUP_B).then((ids) => ids.sort())).toEqual([
      "e1",
      "e2",
    ]);
    expect(await favoriteIds(USER_A)).toEqual(["e1", "e2"]);
  });

  it("E1 dans A, E2 hors A : ajout à B sans toucher A", async () => {
    await engine.query(
      `INSERT INTO favorites (user_id, event_id) VALUES ($1, 'e1'), ($1, 'e2')`,
      [USER_A],
    );
    await engine.query(
      `INSERT INTO group_events (group_id, event_id) VALUES ($1, 'e1')`,
      [GROUP_A],
    );

    const result = await applyEventCarnetMembershipsForUser({
      userId: USER_A,
      eventIds: ["e1", "e2"],
      addGroupIds: [GROUP_B],
      removeGroupIds: [],
      client: engine,
    });

    expect(result).toEqual({ status: "ok" });
    expect(await members(GROUP_A)).toEqual(["e1"]);
    expect(await members(GROUP_B).then((ids) => ids.sort())).toEqual([
      "e1",
      "e2",
    ]);
    expect(await favoriteIds(USER_A)).toEqual(["e1", "e2"]);
  });
});
