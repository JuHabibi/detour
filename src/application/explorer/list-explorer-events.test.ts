import { describe, expect, it, vi } from "vitest";
import { listExplorerEvents } from "@/application/explorer/list-explorer-events";
import {
  decodeExplorerCursor,
  encodeExplorerCursor,
} from "@/application/explorer/explorer-cursor";
import {
  EXPLORER_DEFAULT_PAGE_SIZE,
  EXPLORER_MAX_PAGE_SIZE,
} from "@/application/explorer/types";
import { getDateRangeForWhenFilter } from "@/domain/time/when-filter";
import {
  buildExplorerFilterSql,
  type ExplorerResolvedFilters,
} from "@/infrastructure/db/explorer-events.repository";
import type { DbQueryable } from "@/infrastructure/db/postgres";

function filters(
  overrides: Partial<ExplorerResolvedFilters> &
    Pick<ExplorerResolvedFilters, "temporal">,
): ExplorerResolvedFilters {
  return {
    searchPattern: null,
    productCategory: null,
    cityKey: null,
    ...overrides,
  };
}

function availabilityFields(overrides?: {
  status?: string | null;
  provider?: string | null;
  url?: string | null;
  checkedAt?: Date | null;
}) {
  return {
    availability_status: overrides?.status ?? null,
    availability_provider: overrides?.provider ?? null,
    availability_provider_event_url: overrides?.url ?? null,
    availability_checked_at: overrides?.checkedAt ?? null,
  };
}

function dbRow(
  id: string,
  startAt: string,
  extras?: {
    endAt?: string | null;
    title?: string;
    venue?: string | null;
    description?: string | null;
    availability?: ReturnType<typeof availabilityFields>;
  },
) {
  return {
    id,
    adapter_id: "orleans",
    title: extras?.title ?? id,
    description: extras?.description ?? null,
    image_url: null,
    start_at: new Date(startAt),
    end_at: extras?.endAt ? new Date(extras.endAt) : null,
    venue: extras?.venue ?? null,
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: "Concert",
    genre: null,
    conditions: null,
    source: null,
    source_url: null,
    registration_url: null,
    is_active: true,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
    last_seen_at: new Date("2026-01-01T00:00:00.000Z"),
    ...(extras?.availability ?? availabilityFields()),
  };
}

function mockClient(handler: (sql: string, params: unknown[]) => { rows: unknown[] }) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) =>
    handler(sql, params),
  );
  return { query, client: { query } as unknown as DbQueryable };
}

describe("buildExplorerFilterSql", () => {
  it("today : intersection bornée start <= to AND end >= from", () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    const range = getDateRangeForWhenFilter("today", now);
    const { whereSql, params } = buildExplorerFilterSql(
      filters({
        temporal: { mode: "bounded", from: range.from, to: range.to! },
      }),
    );
    expect(whereSql).toContain("e.is_active = true");
    expect(whereSql).toContain("e.start_at <= $2");
    expect(whereSql).toContain("COALESCE(e.end_at, e.start_at) >= $1");
    expect(whereSql).not.toContain("start_at BETWEEN");
    expect(whereSql).not.toMatch(/e\.start_at\s*<\s*\$/);
    expect(params).toEqual([range.from.toISOString(), range.to!.toISOString()]);
  });

  it("weekend : mêmes predicats d’intersection", () => {
    const now = new Date("2026-09-09T11:00:00+02:00");
    const range = getDateRangeForWhenFilter("weekend", now);
    const { whereSql, params } = buildExplorerFilterSql(
      filters({
        temporal: { mode: "bounded", from: range.from, to: range.to! },
      }),
    );
    expect(whereSql).toContain("e.start_at <= $2");
    expect(whereSql).toContain("COALESCE(e.end_at, e.start_at) >= $1");
    expect(params[0]).toBe(range.from.toISOString());
    expect(params[1]).toBe(range.to!.toISOString());
  });

  it("upcoming : end >= now, pas de borne haute", () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    const { whereSql, params } = buildExplorerFilterSql(
      filters({ temporal: { mode: "upcoming", now } }),
    );
    expect(whereSql).toContain("COALESCE(e.end_at, e.start_at) >= $1");
    expect(whereSql).not.toContain("e.start_at <=");
    expect(params).toEqual([now.toISOString()]);
  });

  it("search ILIKE title/venue/description paramétré", () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    const { whereSql, params } = buildExplorerFilterSql(
      filters({
        temporal: { mode: "upcoming", now },
        searchPattern: "%Jazz%",
      }),
    );
    expect(whereSql).toContain("e.title ILIKE $2 ESCAPE '\\'");
    expect(whereSql).toContain("COALESCE(e.venue, '') ILIKE $2");
    expect(whereSql).toContain("COALESCE(e.description, '') ILIKE $2");
    expect(params).toEqual([now.toISOString(), "%Jazz%"]);
  });

  it("category → product_category uniquement", () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    const { whereSql, params } = buildExplorerFilterSql(
      filters({
        temporal: { mode: "upcoming", now },
        productCategory: "Musique",
      }),
    );
    expect(whereSql).toContain("e.product_category = $2");
    expect(whereSql).not.toContain("e.category =");
    expect(params).toEqual([now.toISOString(), "Musique"]);
  });

  it("city → city_key uniquement", () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    const { whereSql, params } = buildExplorerFilterSql(
      filters({
        temporal: { mode: "upcoming", now },
        cityKey: "Saran",
      }),
    );
    expect(whereSql).toContain("e.city_key = $2");
    expect(whereSql).not.toContain("e.city =");
    expect(params).toEqual([now.toISOString(), "Saran"]);
  });
});

describe("listExplorerEvents — pagination", () => {
  const now = new Date("2026-09-07T12:00:00.000Z");

  it("première page : ordre stable, nextCursor, totalCount", async () => {
    const rows = [
      dbRow("a", "2026-11-01T18:00:00.000Z"),
      dbRow("b", "2026-11-01T18:00:00.000Z"),
      dbRow("c", "2026-11-01T19:00:00.000Z"),
      dbRow("d", "2026-11-02T10:00:00.000Z"),
    ];
    const { query, client } = mockClient((sql) => {
      if (sql.includes("count(*)")) return { rows: [{ count: "4" }] };
      return { rows: rows.slice(0, 3) };
    });

    const result = await listExplorerEvents(
      { when: "upcoming", limit: 2 },
      { client, now },
    );

    expect(result.events.map((e) => e.id)).toEqual(["a", "b"]);
    expect(result.totalCount).toBe(4);
    expect(decodeExplorerCursor(result.nextCursor!)).toEqual({
      startAt: "2026-11-01T18:00:00.000Z",
      id: "b",
    });

    const pageCall = query.mock.calls.find((call) =>
      String(call[0]).includes("LIMIT"),
    ) as [string, unknown[]] | undefined;
    expect(pageCall![0]).toContain("ORDER BY start_at ASC, id ASC");
    expect(pageCall![0]).toContain("ROW_NUMBER()");
    expect(pageCall![0]).toContain("PARTITION BY");
    expect(pageCall![0]).toContain("representatives");
    expect(pageCall![1]).toEqual([now.toISOString(), 3]);
  });

  it("page suivante : keyset, pas de doublon", async () => {
    const cursor = encodeExplorerCursor({
      startAt: "2026-11-01T18:00:00.000Z",
      id: "b",
    });
    const { query, client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) return { rows: [{ count: "4" }] };
      expect(sql).toContain("start_at > $2");
      expect(sql).toContain("id > $3");
      expect(params[1]).toBe("2026-11-01T18:00:00.000Z");
      expect(params[2]).toBe("b");
      expect(params[3]).toBe(3);
      return {
        rows: [
          dbRow("c", "2026-11-01T19:00:00.000Z"),
          dbRow("d", "2026-11-02T10:00:00.000Z"),
        ],
      };
    });

    const result = await listExplorerEvents(
      { when: "upcoming", cursor, limit: 2 },
      { client, now },
    );
    expect(result.events.map((e) => e.id)).toEqual(["c", "d"]);
    expect(result.nextCursor).toBeNull();
    expect(query).toHaveBeenCalled();
  });

  it("fin de pagination : nextCursor null", async () => {
    const { client } = mockClient((sql) => {
      if (sql.includes("count(*)")) return { rows: [{ count: "2" }] };
      return {
        rows: [
          dbRow("a", "2026-11-01T18:00:00.000Z"),
          dbRow("b", "2026-11-01T19:00:00.000Z"),
        ],
      };
    });
    const result = await listExplorerEvents(
      { when: "upcoming", limit: 2 },
      { client, now },
    );
    expect(result.nextCursor).toBeNull();
  });

  it("limit borné", async () => {
    const { query, client } = mockClient((sql) => {
      if (sql.includes("count(*)")) return { rows: [{ count: "0" }] };
      return { rows: [] };
    });

    await listExplorerEvents({ when: "upcoming" }, { client, now });
    let limitCall = query.mock.calls.find((c) =>
      String(c[0]).includes("LIMIT"),
    ) as [string, unknown[]];
    expect(limitCall[1].at(-1)).toBe(EXPLORER_DEFAULT_PAGE_SIZE + 1);

    query.mockClear();
    await listExplorerEvents({ when: "upcoming", limit: 999 }, { client, now });
    limitCall = query.mock.calls.find((c) =>
      String(c[0]).includes("LIMIT"),
    ) as [string, unknown[]];
    expect(limitCall[1].at(-1)).toBe(EXPLORER_MAX_PAGE_SIZE + 1);
  });

  it("availability attachée", async () => {
    const checkedAt = new Date("2026-09-07T11:00:00.000Z");
    const { client } = mockClient((sql) => {
      if (sql.includes("count(*)")) return { rows: [{ count: "2" }] };
      return {
        rows: [
          dbRow("with-av", "2026-11-01T18:00:00.000Z", {
            availability: availabilityFields({
              status: "sold_out",
              provider: "mapado",
              url: "https://mapado.example/e/1",
              checkedAt,
            }),
          }),
          dbRow("no-av", "2026-11-01T19:00:00.000Z"),
        ],
      };
    });

    const result = await listExplorerEvents(
      { when: "upcoming", limit: 12 },
      { client, now },
    );
    expect(result.events[0]?.availabilityStatus).toBe("sold_out");
    expect(result.events[1]?.availabilityStatus).toBe("unknown");
  });
});

describe("listExplorerEvents — WHEN", () => {
  it("today : passe les bornes Paris de getDateRangeForWhenFilter", async () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    const range = getDateRangeForWhenFilter("today", now);
    const { query, client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        expect(sql).toContain("e.start_at <= $2");
        expect(sql).toContain("COALESCE(e.end_at, e.start_at) >= $1");
        expect(params).toEqual([
          range.from.toISOString(),
          range.to!.toISOString(),
        ]);
        return { rows: [{ count: "1" }] };
      }
      return {
        rows: [
          dbRow("multi", "2026-09-08T10:00:00+02:00", {
            endAt: "2026-09-12T18:00:00+02:00",
          }),
        ],
      };
    });

    const result = await listExplorerEvents({ when: "today" }, { client, now });
    expect(result.events[0]?.id).toBe("multi");
    expect(result.totalCount).toBe(1);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("weekend : bornes samedi–dimanche", async () => {
    const now = new Date("2026-09-09T11:00:00+02:00");
    const range = getDateRangeForWhenFilter("weekend", now);
    const { client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        expect(params).toEqual([
          range.from.toISOString(),
          range.to!.toISOString(),
        ]);
        return { rows: [{ count: "0" }] };
      }
      return { rows: [] };
    });
    await listExplorerEvents({ when: "weekend" }, { client, now });
  });

  it("frontière : événement qui commence pile à range.to inclus", async () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    const range = getDateRangeForWhenFilter("today", now);
    const { query, client } = mockClient((sql) => {
      if (sql.includes("count(*)")) return { rows: [{ count: "1" }] };
      return {
        rows: [dbRow("edge", range.to!.toISOString())],
      };
    });

    const result = await listExplorerEvents({ when: "today" }, { client, now });
    const pageSql = query.mock.calls.find((c) =>
      String(c[0]).includes("ORDER BY"),
    )?.[0] as string;
    expect(pageSql).toContain("e.start_at <= $2");
    expect(result.events[0]?.id).toBe("edge");
  });

  it("upcoming : seul prédicat end >= now", async () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    const { query, client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        expect(sql).toContain("COALESCE(e.end_at, e.start_at) >= $1");
        expect(sql).not.toContain("e.start_at <=");
        expect(params).toEqual([now.toISOString()]);
        return { rows: [{ count: "1" }] };
      }
      return {
        rows: [
          dbRow("ongoing", "2026-09-08T10:00:00+02:00", {
            endAt: "2026-09-12T18:00:00+02:00",
          }),
        ],
      };
    });

    const result = await listExplorerEvents(
      { when: "upcoming" },
      { client, now },
    );
    expect(result.events[0]?.id).toBe("ongoing");
    expect(query).toHaveBeenCalled();
  });
});

describe("listExplorerEvents — SEARCH", () => {
  const now = new Date("2026-09-10T12:00:00+02:00");

  it("match title / venue / description + casse (ILIKE)", async () => {
    const { query, client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        expect(sql).toContain("ILIKE $2 ESCAPE");
        expect(params[1]).toBe("%Jazz%");
        return { rows: [{ count: "1" }] };
      }
      return {
        rows: [
          dbRow("t1", "2026-11-01T18:00:00.000Z", { title: "Soirée JAZZ" }),
        ],
      };
    });

    await listExplorerEvents(
      { when: "upcoming", search: "Jazz" },
      { client, now },
    );
    expect(query).toHaveBeenCalled();
  });

  it("trim conserve la casse tapée ; ILIKE ignore la casse en DB", async () => {
    const { query, client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        expect(params[1]).toBe("%jazz%");
        return { rows: [{ count: "1" }] };
      }
      return { rows: [] };
    });

    await listExplorerEvents(
      { when: "upcoming", search: "  jazz  " },
      { client, now },
    );
    expect(query).toHaveBeenCalled();
  });

  it("recherche vide / espaces → aucun filtre search", async () => {
    const { query, client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        expect(sql).not.toContain("ILIKE");
        expect(params).toEqual([now.toISOString()]);
        return { rows: [{ count: "0" }] };
      }
      return { rows: [] };
    });

    await listExplorerEvents(
      { when: "upcoming", search: "   " },
      { client, now },
    );
  });

  it("aucun résultat : totalCount 0", async () => {
    const { client } = mockClient((sql) => {
      if (sql.includes("count(*)")) return { rows: [{ count: "0" }] };
      return { rows: [] };
    });
    const result = await listExplorerEvents(
      { when: "upcoming", search: "zzzz-introuvable" },
      { client, now },
    );
    expect(result).toEqual({ events: [], totalCount: 0, nextCursor: null });
  });
});

describe("listExplorerEvents — combinaison when + search + pagination", () => {
  it("même WHERE count/page ; cursor après filtres ; pas de doublon", async () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    const range = getDateRangeForWhenFilter("weekend", now);
    const page1Cursor = encodeExplorerCursor({
      startAt: "2026-09-12T18:00:00.000Z",
      id: "jazz-1",
    });

    let countSql = "";
    let pageSql = "";
    const { client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        countSql = sql;
        expect(params).toEqual([
          range.from.toISOString(),
          range.to!.toISOString(),
          "%jazz%",
        ]);
        return { rows: [{ count: "3" }] };
      }
      pageSql = sql;
      expect(params[0]).toBe(range.from.toISOString());
      expect(params[1]).toBe(range.to!.toISOString());
      expect(params[2]).toBe("%jazz%");
      expect(params[3]).toBe("2026-09-12T18:00:00.000Z");
      expect(params[4]).toBe("jazz-1");
      expect(params[5]).toBe(3);
      return {
        rows: [
          dbRow("jazz-2", "2026-09-13T10:00:00.000Z", { title: "Jazz brunch" }),
          dbRow("jazz-3", "2026-09-13T20:00:00.000Z", { title: "Jazz night" }),
        ],
      };
    });

    const result = await listExplorerEvents(
      { when: "weekend", search: "jazz", cursor: page1Cursor, limit: 2 },
      { client, now },
    );

    expect(countSql).toContain("ILIKE");
    expect(countSql).not.toContain("e.start_at >");
    expect(pageSql).toContain("ILIKE");
    expect(pageSql).toContain("start_at > $");
    expect(pageSql).toContain("ROW_NUMBER()");
    expect(result.totalCount).toBe(3);
    expect(result.events.map((e) => e.id)).toEqual(["jazz-2", "jazz-3"]);
    expect(result.events.map((e) => e.id)).not.toContain("jazz-1");
    expect(result.nextCursor).toBeNull();
  });
});

describe("listExplorerEvents — CATEGORY", () => {
  const now = new Date("2026-09-10T12:00:00+02:00");

  it("filtre product_category", async () => {
    const { query, client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        expect(sql).toContain("e.product_category = $2");
        expect(sql).not.toContain("e.category =");
        expect(params).toEqual([now.toISOString(), "Musique"]);
        return { rows: [{ count: "2" }] };
      }
      return { rows: [dbRow("m1", "2026-11-01T18:00:00.000Z")] };
    });

    const result = await listExplorerEvents(
      { when: "upcoming", category: "Musique" },
      { client, now },
    );
    expect(result.totalCount).toBe(2);
    expect(query).toHaveBeenCalled();
  });

  it("absence de filtre category", async () => {
    const { client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        expect(sql).not.toContain("e.product_category =");
        expect(params).toEqual([now.toISOString()]);
        return { rows: [{ count: "0" }] };
      }
      return { rows: [] };
    });
    await listExplorerEvents({ when: "upcoming" }, { client, now });
    await listExplorerEvents(
      { when: "upcoming", category: null },
      { client, now },
    );
  });

  it("category + when", async () => {
    const range = getDateRangeForWhenFilter("today", now);
    const { client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        expect(sql).toContain("e.start_at <=");
        expect(sql).toContain("e.product_category = $3");
        expect(params).toEqual([
          range.from.toISOString(),
          range.to!.toISOString(),
          "Spectacle",
        ]);
        return { rows: [{ count: "1" }] };
      }
      return { rows: [] };
    });
    await listExplorerEvents(
      { when: "today", category: "Spectacle" },
      { client, now },
    );
  });

  it("category + search + totalCount", async () => {
    const { client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        expect(sql).toContain("ILIKE");
        expect(sql).toContain("e.product_category = $3");
        expect(params).toEqual([now.toISOString(), "%jazz%", "Musique"]);
        return { rows: [{ count: "5" }] };
      }
      return { rows: [] };
    });
    const result = await listExplorerEvents(
      { when: "upcoming", search: "jazz", category: "Musique" },
      { client, now },
    );
    expect(result.totalCount).toBe(5);
  });
});

describe("listExplorerEvents — CITY", () => {
  const now = new Date("2026-09-10T12:00:00+02:00");

  it("filtre city_key canonique", async () => {
    const { client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        expect(sql).toContain("e.city_key = $2");
        expect(sql).not.toContain("e.city =");
        expect(params).toEqual([now.toISOString(), "Orléans"]);
        return { rows: [{ count: "3" }] };
      }
      return { rows: [] };
    });
    const result = await listExplorerEvents(
      { when: "upcoming", city: "Orléans" },
      { client, now },
    );
    expect(result.totalCount).toBe(3);
  });

  it("absence de filtre city → pas de clause city_key (NULL inclus)", async () => {
    const { client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        expect(sql).not.toContain("e.city_key =");
        expect(params).toEqual([now.toISOString()]);
        return { rows: [{ count: "10" }] };
      }
      return { rows: [] };
    });
    const result = await listExplorerEvents({ when: "upcoming" }, { client, now });
    expect(result.totalCount).toBe(10);
  });

  it("ville sélectionnée → égalité city_key (exclut NULL)", async () => {
    const { whereSql } = buildExplorerFilterSql(
      filters({
        temporal: { mode: "upcoming", now },
        cityKey: "Saran",
      }),
    );
    expect(whereSql).toContain("e.city_key = $2");
    expect(whereSql).not.toContain("city_key IS NULL");
  });

  it("city + when", async () => {
    const range = getDateRangeForWhenFilter("weekend", now);
    const { client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        expect(params).toEqual([
          range.from.toISOString(),
          range.to!.toISOString(),
          "Saran",
        ]);
        return { rows: [{ count: "2" }] };
      }
      return { rows: [] };
    });
    const result = await listExplorerEvents(
      { when: "weekend", city: "Saran" },
      { client, now },
    );
    expect(result.totalCount).toBe(2);
  });

  it("city + search + totalCount", async () => {
    const { client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        expect(params).toEqual([now.toISOString(), "%théâtre%", "Olivet"]);
        return { rows: [{ count: "1" }] };
      }
      return { rows: [] };
    });
    const result = await listExplorerEvents(
      { when: "upcoming", search: "théâtre", city: "Olivet" },
      { client, now },
    );
    expect(result.totalCount).toBe(1);
  });
});

describe("listExplorerEvents — combinaison complète", () => {
  it("when + search + category + city + pagination filtrée", async () => {
    const now = new Date("2026-09-10T12:00:00+02:00");
    const range = getDateRangeForWhenFilter("weekend", now);
    const cursor = encodeExplorerCursor({
      startAt: "2026-09-12T18:00:00.000Z",
      id: "a",
    });

    let countSql = "";
    let pageSql = "";
    const { client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) {
        countSql = sql;
        expect(params).toEqual([
          range.from.toISOString(),
          range.to!.toISOString(),
          "%jazz%",
          "Musique",
          "Orléans",
        ]);
        expect(sql).not.toContain("e.start_at >");
        return { rows: [{ count: "4" }] };
      }
      pageSql = sql;
      expect(params).toEqual([
        range.from.toISOString(),
        range.to!.toISOString(),
        "%jazz%",
        "Musique",
        "Orléans",
        "2026-09-12T18:00:00.000Z",
        "a",
        3,
      ]);
      return {
        rows: [
          dbRow("b", "2026-09-13T10:00:00.000Z"),
          dbRow("c", "2026-09-13T12:00:00.000Z"),
          dbRow("d", "2026-09-13T14:00:00.000Z"),
        ],
      };
    });

    const result = await listExplorerEvents(
      {
        when: "weekend",
        search: "jazz",
        category: "Musique",
        city: "Orléans",
        cursor,
        limit: 2,
      },
      { client, now },
    );

    expect(countSql).toContain("product_category");
    expect(countSql).toContain("city_key");
    expect(countSql).toContain("ILIKE");
    expect(pageSql).toContain("start_at > $");
    expect(result.totalCount).toBe(4);
    expect(result.events.map((e) => e.id)).toEqual(["b", "c"]);
    expect(result.events.map((e) => e.id)).not.toContain("a");
    expect(decodeExplorerCursor(result.nextCursor!)).toEqual({
      startAt: "2026-09-13T12:00:00.000Z",
      id: "c",
    });
  });
});

describe("listExplorerEvents — dedupe V1 (read model)", () => {
  const now = new Date("2026-09-10T12:00:00.000Z");

  it("10. totalCount lit les representatives (groupes), pas un count rows brut seul", async () => {
    const { query, client } = mockClient((sql) => {
      if (sql.includes("count(*)")) {
        expect(sql).toContain("FROM representatives");
        expect(sql).toContain("ROW_NUMBER()");
        expect(sql).toContain("canonical_title");
        return { rows: [{ count: "3" }] };
      }
      return { rows: [] };
    });

    const result = await listExplorerEvents(
      { when: "upcoming" },
      { client, now },
    );
    expect(result.totalCount).toBe(3);
    expect(query).toHaveBeenCalled();
  });

  it("11. pagination demande limit+1 sur representatives (pas de shrink post-LIMIT)", async () => {
    const { query, client } = mockClient((sql) => {
      if (sql.includes("count(*)")) return { rows: [{ count: "20" }] };
      return {
        rows: Array.from({ length: 13 }, (_, i) =>
          dbRow(`e${i}`, `2026-11-${String(i + 1).padStart(2, "0")}T18:00:00.000Z`),
        ),
      };
    });

    const result = await listExplorerEvents(
      { when: "upcoming", limit: 12 },
      { client, now },
    );
    expect(result.events).toHaveLength(12);
    const pageCall = query.mock.calls.find((c) =>
      String(c[0]).includes("LIMIT"),
    ) as [string, unknown[]];
    expect(pageCall[0]).toContain("FROM representatives");
    expect(pageCall[1].at(-1)).toBe(13);
    expect(result.nextCursor).not.toBeNull();
  });

  it("12. cursor page suivante reste sur (start_at, id) representative", async () => {
    const cursor = encodeExplorerCursor({
      startAt: "2026-11-01T18:00:00.000Z",
      id: "kept-b",
    });
    const { client } = mockClient((sql, params) => {
      if (sql.includes("count(*)")) return { rows: [{ count: "5" }] };
      expect(sql).toContain("start_at > $2");
      expect(sql).toContain("id > $3");
      expect(params[1]).toBe("2026-11-01T18:00:00.000Z");
      expect(params[2]).toBe("kept-b");
      return {
        rows: [
          dbRow("c", "2026-11-02T10:00:00.000Z"),
          dbRow("d", "2026-11-03T10:00:00.000Z"),
        ],
      };
    });

    const result = await listExplorerEvents(
      { when: "upcoming", cursor, limit: 2 },
      { client, now },
    );
    expect(result.events.map((e) => e.id)).toEqual(["c", "d"]);
  });

  it("13. search dans le WHERE filtered (avant grouping)", async () => {
    const { query, client } = mockClient((sql) => {
      if (sql.includes("count(*)")) {
        expect(sql).toMatch(/WITH filtered AS[\s\S]*ILIKE/);
        expect(sql.indexOf("ILIKE")).toBeLessThan(sql.indexOf("ROW_NUMBER()"));
        return { rows: [{ count: "1" }] };
      }
      expect(sql.indexOf("ILIKE")).toBeLessThan(sql.indexOf("ROW_NUMBER()"));
      return {
        rows: [
          dbRow("wanderer-long", "2026-09-12T18:00:00.000Z", {
            title: "Instants suspendus : Trio Wanderer",
          }),
        ],
      };
    });

    const result = await listExplorerEvents(
      { when: "upcoming", search: "Instants suspendus" },
      { client, now },
    );
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.title).toContain("Instants suspendus");
    expect(query).toHaveBeenCalled();
  });
});
