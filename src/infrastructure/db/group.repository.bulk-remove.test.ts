/**
 * Contrat SQL removeEventsFromGroupForUser — PGlite isolé.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { removeEventsFromGroupForUser } from "@/infrastructure/db/group.repository";
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
  email text NOT NULL
);

CREATE TABLE events (
  id text PRIMARY KEY,
  adapter_id text NOT NULL,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL
);

CREATE TABLE favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  UNIQUE (user_id, event_id)
);

CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  name text NOT NULL
);

CREATE TABLE group_events (
  group_id uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, event_id)
);
`.trim();

type SqlEngine = {
  query: DbQueryable["query"];
  end: () => Promise<void>;
};

async function createEngine(): Promise<SqlEngine> {
  const db = new PGlite();
  await db.exec(SCHEMA_SQL);
  return {
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
  ('e1', 't', 'E1', '2026-10-01T10:00:00Z', '2026-10-01T10:00:00Z'),
  ('e2', 't', 'E2', '2026-10-02T10:00:00Z', '2026-10-02T10:00:00Z'),
  ('e3', 't', 'E3', '2026-10-03T10:00:00Z', '2026-10-03T10:00:00Z')
`.trim(),
  );
  await engine.query(
    `
INSERT INTO groups (id, user_id, name) VALUES
  ($1, $2, 'A'),
  ($3, $2, 'B'),
  ($4, $5, 'Other')
`.trim(),
    [GROUP_A, USER_A, GROUP_B, GROUP_OTHER, USER_B],
  );
  await engine.query(
    `
INSERT INTO favorites (user_id, event_id) VALUES
  ($1, 'e1'), ($1, 'e2'), ($1, 'e3')
`.trim(),
    [USER_A],
  );
  await engine.query(
    `
INSERT INTO group_events (group_id, event_id) VALUES
  ($1, 'e1'),
  ($1, 'e2'),
  ($1, 'e3'),
  ($2, 'e2')
`.trim(),
    [GROUP_A, GROUP_B],
  );
}

async function members(groupId: string): Promise<string[]> {
  const r = await engine.query<{ event_id: string }>(
    `SELECT event_id FROM group_events WHERE group_id = $1 ORDER BY event_id`,
    [groupId],
  );
  return r.rows.map((row) => row.event_id);
}

async function favoriteIds(userId: string): Promise<string[]> {
  const r = await engine.query<{ event_id: string }>(
    `SELECT event_id FROM favorites WHERE user_id = $1 ORDER BY event_id`,
    [userId],
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

describe("removeEventsFromGroupForUser (PGlite)", () => {
  it("retire plusieurs événements ; non sélectionnés préservés", async () => {
    const result = await removeEventsFromGroupForUser(
      USER_A,
      GROUP_A,
      ["e1", "e3"],
      engine,
    );

    expect(result).toEqual({ status: "ok", removedCount: 2 });
    expect(await members(GROUP_A)).toEqual(["e2"]);
  });

  it("favoris et autres carnets inchangés", async () => {
    await removeEventsFromGroupForUser(USER_A, GROUP_A, ["e1", "e2"], engine);

    expect(await favoriteIds(USER_A)).toEqual(["e1", "e2", "e3"]);
    expect(await members(GROUP_B)).toEqual(["e2"]);
    expect(await members(GROUP_A)).toEqual(["e3"]);
  });

  it("carnet d’un autre utilisateur → not_found sans suppression", async () => {
    const result = await removeEventsFromGroupForUser(
      USER_A,
      GROUP_OTHER,
      ["e1"],
      engine,
    );

    expect(result).toEqual({ status: "not_found" });
    expect(await members(GROUP_A)).toEqual(["e1", "e2", "e3"]);
  });

  it("répétition du retrait → ok idempotent", async () => {
    const first = await removeEventsFromGroupForUser(
      USER_A,
      GROUP_A,
      ["e1"],
      engine,
    );
    expect(first).toEqual({ status: "ok", removedCount: 1 });

    const second = await removeEventsFromGroupForUser(
      USER_A,
      GROUP_A,
      ["e1"],
      engine,
    );
    expect(second).toEqual({ status: "ok", removedCount: 0 });
    expect(await members(GROUP_A)).toEqual(["e2", "e3"]);
  });
});
