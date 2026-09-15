import { describe, expect, it } from "vitest";
import {
  classifyAuthSqlQuery,
  extractPgQueryText,
} from "@/infrastructure/db/home-perf";

describe("classifyAuthSqlQuery", () => {
  it("détecte find_session (SELECT + session)", () => {
    expect(
      classifyAuthSqlQuery(
        `select "primary".*, "join_user"."id" from (select * from "session" where "token" = $1) as "primary" left join "user" as "join_user" on ...`,
      ),
    ).toBe("find_session");
  });

  it("détecte update_session", () => {
    expect(
      classifyAuthSqlQuery(
        `update "session" set "expiresAt" = $1, "updatedAt" = $2 where "token" = $3 returning *`,
      ),
    ).toBe("update_session");
  });

  it("other pour SQL hors session", () => {
    expect(
      classifyAuthSqlQuery(`select event_id from favorites where user_id = $1`),
    ).toBe("other");
  });
});

describe("extractPgQueryText", () => {
  it("extrait string ou config.text, ignore values", () => {
    expect(extractPgQueryText("select 1")).toBe("select 1");
    expect(extractPgQueryText({ text: "select 2", values: ["secret"] })).toBe(
      "select 2",
    );
    expect(extractPgQueryText(null)).toBeNull();
  });
});
