/**
 * Diagnostic coût SQL Explorer (lecture seule) — B3 mesure.
 *
 * Ne choisit PAS automatiquement DATABASE_URL.
 * Usage :
 *   node --conditions=react-server --import tsx \
 *     scripts/measure-explorer-sql-cost.mts \
 *     --database-url "$EXPLORER_SQL_BENCH_DATABASE_URL"
 *
 * Options :
 *   --database-url <url>   obligatoire (cible locale/staging explicite)
 *   --repeats <n>          répétitions chronométrées après la 1ʳᵉ (défaut 5)
 *   --timeout-ms <n>       statement_timeout (défaut 30000)
 *   --now <iso>            horloge figée (défaut : maintenant)
 *   --out <path>           écrit la note markdown (défaut stdout + scripts/…)
 *
 * Réutilise les builders SQL produit (`explorer-events.sql.ts`) et appelle
 * réellement `listExplorerEvents` pour le parcours applicatif (1ʳᵉ page / append).
 * Aucune écriture ; connexions fermées dans tous les cas.
 *
 * `--conditions=react-server` autorise l’import `server-only` hors Next ;
 * le client injectable évite `getPool()` / DATABASE_URL.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";
import { encodeExplorerCursor, decodeExplorerCursor } from "../src/application/explorer/explorer-cursor";
import { normalizeExplorerSearch } from "../src/application/explorer/normalize-explorer-search";
import {
  EXPLORER_DEFAULT_PAGE_SIZE,
  type ListExplorerEventsQuery,
  type ListExplorerEventsResult,
} from "../src/application/explorer/types";
import {
  getDateRangeForParisDateKeys,
  getDateRangeForWhenFilter,
  type WhenFilter,
} from "../src/domain/time/when-filter";
import {
  buildExplorerCountSql,
  buildExplorerFilterSql,
  buildExplorerPageSql,
  type ExplorerKeysetAfter,
  type ExplorerResolvedFilters,
} from "../src/infrastructure/db/explorer-events.sql";
import { listExplorerEvents } from "../src/application/explorer/list-explorer-events";

/** Aligné sur `DbQueryable` sans réexporter `postgres.ts`. */
type BenchDbQueryable = {
  query: <T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ) => Promise<pg.QueryResult<T>>;
};

type ListExplorerEventsFn = typeof listExplorerEvents;
const DEFAULT_REPEATS = 5;
const DEFAULT_TIMEOUT_MS = 30_000;
/** Rapport APRES le levier produit (ne pas écraser le rapport AVANT commité). */
const DEFAULT_OUT = "scripts/measure-explorer-sql-cost.after.report.md";
const DISTANT_PAGE_INDEX = 4; // 5ᵉ page (0-based après 4 appends) si corpus le permet

type CliArgs = {
  databaseUrl: string;
  repeats: number;
  timeoutMs: number;
  now: Date;
  outPath: string;
};

type TimingStats = {
  firstMs: number;
  samplesMs: number[];
  medianMs: number;
  minMs: number;
  maxMs: number;
};

type ScenarioSpec = {
  id: string;
  label: string;
  filters: ExplorerResolvedFilters;
};

type OpKind = "count" | "page" | "combined";

function usageAndExit(message?: string): never {
  if (message) console.error(message);
  console.error(`Usage:
  node --conditions=react-server --import tsx \\
    scripts/measure-explorer-sql-cost.mts --database-url <postgres-url> [--repeats 5] [--timeout-ms 30000] [--now <iso>] [--out path]`);
  process.exit(1);
}

function parseArgs(argv: string[]): CliArgs {
  let databaseUrl: string | undefined;
  let repeats = DEFAULT_REPEATS;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let now = new Date();
  let outPath = DEFAULT_OUT;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const next = argv[i + 1];
    if (arg === "--database-url") {
      if (!next) usageAndExit("--database-url requires a value");
      databaseUrl = next.trim();
      i += 1;
      continue;
    }
    if (arg === "--repeats") {
      if (!next) usageAndExit("--repeats requires a value");
      repeats = Number(next);
      i += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      if (!next) usageAndExit("--timeout-ms requires a value");
      timeoutMs = Number(next);
      i += 1;
      continue;
    }
    if (arg === "--now") {
      if (!next) usageAndExit("--now requires an ISO timestamp");
      const parsed = new Date(next);
      if (Number.isNaN(parsed.getTime())) usageAndExit("invalid --now");
      now = parsed;
      i += 1;
      continue;
    }
    if (arg === "--out") {
      if (!next) usageAndExit("--out requires a path");
      outPath = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) usageAndExit(`Unknown option: ${arg}`);
  }

  if (!databaseUrl) {
    usageAndExit(
      "Missing --database-url (do not rely on DATABASE_URL automatically).",
    );
  }
  if (!Number.isFinite(repeats) || repeats < 1 || repeats > 30) {
    usageAndExit("--repeats must be between 1 and 30");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
    usageAndExit("--timeout-ms must be >= 1000");
  }

  return { databaseUrl, repeats, timeoutMs, now, outPath };
}

function redactConnectionMode(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const pooler = host.includes("-pooler") || host.includes("pooler");
    return pooler ? "postgres-pooler" : "postgres-direct";
  } catch {
    return "postgres-unparsed";
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
  }
  return Math.round(sorted[mid]! * 10) / 10;
}

function summarize(firstMs: number, samplesMs: number[]): TimingStats {
  return {
    firstMs: Math.round(firstMs * 10) / 10,
    samplesMs: samplesMs.map((ms) => Math.round(ms * 10) / 10),
    medianMs: median(samplesMs),
    minMs: Math.round(Math.min(...samplesMs) * 10) / 10,
    maxMs: Math.round(Math.max(...samplesMs) * 10) / 10,
  };
}

/** Même résolution que `listExplorerEvents` / `resolveFilters`. */
function resolveFilters(params: {
  when: WhenFilter;
  search?: string | null;
  category?: string | null;
  city?: string | null;
  from?: string;
  to?: string;
  now: Date;
}): ExplorerResolvedFilters {
  let temporal: ExplorerResolvedFilters["temporal"];

  if (params.from != null && params.to != null) {
    const window = getDateRangeForParisDateKeys(params.from, params.to);
    if (!window?.to) {
      temporal = { mode: "upcoming", now: params.now };
    } else {
      temporal = {
        mode: "startInWindowUpcoming",
        from: window.from,
        to: window.to,
        now: params.now,
      };
    }
  } else {
    const range = getDateRangeForWhenFilter(params.when, params.now);
    temporal =
      range.to == null
        ? { mode: "upcoming", now: params.now }
        : { mode: "bounded", from: range.from, to: range.to };
  }

  return {
    temporal,
    searchPattern: normalizeExplorerSearch(params.search),
    productCategory: params.category ?? null,
    cityKey: params.city ?? null,
  };
}

function buildCountQuery(filters: ExplorerResolvedFilters): {
  text: string;
  values: unknown[];
} {
  const { whereSql, params } = buildExplorerFilterSql(filters);
  return { text: buildExplorerCountSql(whereSql), values: params };
}

function buildPageQuery(
  filters: ExplorerResolvedFilters,
  after: ExplorerKeysetAfter | null,
  limit: number,
): { text: string; values: unknown[] } {
  const { whereSql, params: filterParams } = buildExplorerFilterSql(filters);
  const sqlParams = [...filterParams];
  let keysetSql = "";
  if (after) {
    sqlParams.push(after.startAt.toISOString());
    const startIdx = sqlParams.length;
    sqlParams.push(after.id);
    const idIdx = sqlParams.length;
    keysetSql = `
WHERE (
  start_at > $${startIdx}
  OR (start_at = $${startIdx} AND id > $${idIdx})
)`;
  }
  sqlParams.push(limit + 1);
  const limitIdx = sqlParams.length;
  return {
    text: buildExplorerPageSql({ whereSql, keysetSql, limitIdx }),
    values: sqlParams,
  };
}

async function configureReadOnlySession(
  client: pg.PoolClient,
  timeoutMs: number,
): Promise<void> {
  await client.query(`SET statement_timeout = ${Math.floor(timeoutMs)}`);
  await client.query("SET application_name = 'detour-explorer-sql-bench'");
}

async function beginReadOnlyTx(client: pg.PoolClient): Promise<void> {
  await client.query("BEGIN READ ONLY");
}

async function endTx(client: pg.PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // connexion déjà fermée / hors transaction
  }
}

async function withConfiguredClient<T>(
  pool: pg.Pool,
  timeoutMs: number,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await configureReadOnlySession(client, timeoutMs);
    await beginReadOnlyTx(client);
    try {
      return await fn(client);
    } finally {
      await endTx(client);
    }
  } finally {
    client.release();
  }
}

async function acquirePair(
  pool: pg.Pool,
): Promise<{ clientA: pg.PoolClient; clientB: pg.PoolClient }> {
  const clientA = await pool.connect();
  let clientB: pg.PoolClient;
  try {
    clientB = await pool.connect();
  } catch (error) {
    clientA.release();
    throw error;
  }
  return { clientA, clientB };
}

async function timeQuery(
  pool: pg.Pool,
  timeoutMs: number,
  text: string,
  values: unknown[],
): Promise<{ ms: number; rowCount: number }> {
  return withConfiguredClient(pool, timeoutMs, async (client) => {
    const start = performance.now();
    const result = await client.query(text, values);
    return {
      ms: performance.now() - start,
      rowCount: result.rowCount ?? result.rows.length,
    };
  });
}

async function timeCombined(
  pool: pg.Pool,
  timeoutMs: number,
  count: { text: string; values: unknown[] },
  page: { text: string; values: unknown[] },
): Promise<{ ms: number; countRows: number; pageRows: number }> {
  const { clientA, clientB } = await acquirePair(pool);
  try {
    await configureReadOnlySession(clientA, timeoutMs);
    await configureReadOnlySession(clientB, timeoutMs);
    await beginReadOnlyTx(clientA);
    await beginReadOnlyTx(clientB);
    try {
      const start = performance.now();
      const [countResult, pageResult] = await Promise.all([
        clientA.query(count.text, count.values),
        clientB.query(page.text, page.values),
      ]);
      return {
        ms: performance.now() - start,
        countRows: countResult.rowCount ?? countResult.rows.length,
        pageRows: pageResult.rowCount ?? pageResult.rows.length,
      };
    } finally {
      await endTx(clientA);
      await endTx(clientB);
    }
  } finally {
    clientA.release();
    clientB.release();
  }
}

async function measureOp(
  pool: pg.Pool,
  timeoutMs: number,
  op: OpKind,
  countQ: { text: string; values: unknown[] },
  pageQ: { text: string; values: unknown[] },
  repeats: number,
): Promise<TimingStats & { rowHint: number }> {
  let firstMs = 0;
  let rowHint = 0;
  const samples: number[] = [];

  for (let i = 0; i < repeats + 1; i += 1) {
    let ms: number;
    if (op === "count") {
      const timed = await timeQuery(pool, timeoutMs, countQ.text, countQ.values);
      ms = timed.ms;
      rowHint = timed.rowCount;
    } else if (op === "page") {
      const timed = await timeQuery(pool, timeoutMs, pageQ.text, pageQ.values);
      ms = timed.ms;
      rowHint = timed.rowCount;
    } else {
      const timed = await timeCombined(pool, timeoutMs, countQ, pageQ);
      ms = timed.ms;
      rowHint = timed.pageRows;
    }
    if (i === 0) firstMs = ms;
    else samples.push(ms);
  }

  return { ...summarize(firstMs, samples), rowHint };
}

/** SET / BEGIN / ROLLBACK / SHOW — hors compteur métier. */
function isTechnicalSql(text: string): boolean {
  const head = text.trimStart().slice(0, 32).toUpperCase();
  return (
    head.startsWith("BEGIN") ||
    head.startsWith("COMMIT") ||
    head.startsWith("ROLLBACK") ||
    head.startsWith("SET ") ||
    head.startsWith("SET\n") ||
    head.startsWith("SHOW ") ||
    head.startsWith("SHOW\n") ||
    head.startsWith("EXPLAIN")
  );
}

type ObservedListRun = {
  ms: number;
  businessQueryCount: number;
  result: ListExplorerEventsResult;
};

/**
 * Deux clients déjà en transaction READ ONLY : dispatch parallèle
 * (count+page) sans sérialiser sur une seule connexion.
 */
function createParallelQueryable(
  clients: [pg.PoolClient, pg.PoolClient],
  onBusinessQuery: () => void,
): BenchDbQueryable {
  const free: pg.PoolClient[] = [...clients];
  const waiters: Array<(client: pg.PoolClient) => void> = [];

  async function checkout(): Promise<pg.PoolClient> {
    const ready = free.pop();
    if (ready) return ready;
    return new Promise((resolveCheckout) => {
      waiters.push(resolveCheckout);
    });
  }

  function checkin(client: pg.PoolClient): void {
    const waiter = waiters.shift();
    if (waiter) waiter(client);
    else free.push(client);
  }

  return {
    async query(text, values) {
      if (!isTechnicalSql(text)) onBusinessQuery();
      const client = await checkout();
      try {
        return await client.query(text, values);
      } finally {
        checkin(client);
      }
    },
  };
}

async function prepareReadOnlyPair(
  pool: pg.Pool,
  timeoutMs: number,
): Promise<{ clientA: pg.PoolClient; clientB: pg.PoolClient }> {
  const { clientA, clientB } = await acquirePair(pool);
  try {
    await configureReadOnlySession(clientA, timeoutMs);
    await configureReadOnlySession(clientB, timeoutMs);
    await beginReadOnlyTx(clientA);
    await beginReadOnlyTx(clientB);
    return { clientA, clientB };
  } catch (error) {
    await endTx(clientA);
    await endTx(clientB);
    clientA.release();
    clientB.release();
    throw error;
  }
}

async function releaseReadOnlyPair(
  clientA: pg.PoolClient,
  clientB: pg.PoolClient,
): Promise<void> {
  try {
    await endTx(clientA);
    await endTx(clientB);
  } finally {
    clientA.release();
    clientB.release();
  }
}

/**
 * Chronomètre uniquement `listExplorerEvents` : acquisition / SET / BEGIN
 * hors chrono ; ROLLBACK / release après (y compris en erreur).
 * Deux connexions prêtes pour le Promise.all count+page.
 */
async function runListExplorerEventsObserved(
  pool: pg.Pool,
  timeoutMs: number,
  listFn: ListExplorerEventsFn,
  query: ListExplorerEventsQuery,
  now: Date,
): Promise<ObservedListRun> {
  const { clientA, clientB } = await prepareReadOnlyPair(pool, timeoutMs);
  let businessQueryCount = 0;
  try {
    const client = createParallelQueryable([clientA, clientB], () => {
      businessQueryCount += 1;
    });
    const start = performance.now();
    const result = await listFn(query, { client, now });
    const ms = performance.now() - start;
    return { ms, businessQueryCount, result };
  } finally {
    await releaseReadOnlyPair(clientA, clientB);
  }
}

function assertProductContract(
  label: string,
  run: ObservedListRun,
  expected: { businessQueries: number; totalCountKind: "number" | "null" },
): void {
  const totalOk =
    expected.totalCountKind === "number"
      ? typeof run.result.totalCount === "number"
      : run.result.totalCount === null;
  if (run.businessQueryCount !== expected.businessQueries || !totalOk) {
    throw new Error(
      `Contrat produit violé (${label}): requêtes métier=${run.businessQueryCount} (attendu ${expected.businessQueries}), totalCount=${String(run.result.totalCount)} (attendu ${expected.totalCountKind})`,
    );
  }
}

/**
 * Témoin SQL historique : préparation hors chrono, Promise.all(count, page)
 * chronométré, nettoyage après.
 */
async function runHistoricalSqlAppend(
  pool: pg.Pool,
  timeoutMs: number,
  countQ: { text: string; values: unknown[] },
  pageQ: { text: string; values: unknown[] },
): Promise<{ ms: number; businessQueryCount: number }> {
  const { clientA, clientB } = await prepareReadOnlyPair(pool, timeoutMs);
  let businessQueryCount = 0;
  try {
    const start = performance.now();
    await Promise.all([
      clientA.query(countQ.text, countQ.values).then(() => {
        businessQueryCount += 1;
      }),
      clientB.query(pageQ.text, pageQ.values).then(() => {
        businessQueryCount += 1;
      }),
    ]);
    return { ms: performance.now() - start, businessQueryCount };
  } finally {
    await releaseReadOnlyPair(clientA, clientB);
  }
}

type ProductPathMeasure = {
  page1: TimingStats & { businessQueries: number; totalCount: number };
  appendApp: TimingStats & { businessQueries: number };
  appendHistoricalSql: TimingStats & { businessQueries: number };
  cursor: string;
};

/**
 * Parcours applicatif réel + témoin SQL historique, mêmes conditions,
 * variantes alternées, 1ʳᵉ exécution distincte des répétitions.
 */
async function measureProductPath(
  pool: pg.Pool,
  timeoutMs: number,
  repeats: number,
  listExplorerEvents: ListExplorerEventsFn,
  now: Date,
  limit: number,
): Promise<ProductPathMeasure | null> {
  const page1Query: ListExplorerEventsQuery = {
    when: "upcoming",
    limit,
  };

  const page1First = await runListExplorerEventsObserved(
    pool,
    timeoutMs,
    listExplorerEvents,
    page1Query,
    now,
  );
  assertProductContract("listExplorerEvents 1ʳᵉ page", page1First, {
    businessQueries: 2,
    totalCountKind: "number",
  });

  const cursor = page1First.result.nextCursor;
  if (!cursor) return null;

  const page1Samples: number[] = [];
  let page1Queries = page1First.businessQueryCount;
  for (let i = 0; i < repeats; i += 1) {
    const run = await runListExplorerEventsObserved(
      pool,
      timeoutMs,
      listExplorerEvents,
      page1Query,
      now,
    );
    assertProductContract(`listExplorerEvents 1ʳᵉ page (rep ${i + 1})`, run, {
      businessQueries: 2,
      totalCountKind: "number",
    });
    page1Samples.push(run.ms);
    page1Queries = run.businessQueryCount;
  }

  const appendQuery: ListExplorerEventsQuery = {
    when: "upcoming",
    limit,
    cursor,
  };

  const decoded = decodeExplorerCursor(cursor);
  const filters = resolveFilters({ when: "upcoming", now });
  const after: ExplorerKeysetAfter = {
    startAt: new Date(decoded.startAt),
    id: decoded.id,
  };
  const countQ = buildCountQuery(filters);
  const pageQ = buildPageQuery(filters, after, limit);

  let appFirstMs = 0;
  let histFirstMs = 0;
  const appSamples: number[] = [];
  const histSamples: number[] = [];
  let appQueries = 0;
  let histQueries = 0;

  for (let i = 0; i < repeats + 1; i += 1) {
    const appFirst = i % 2 === 0;

    let app: ObservedListRun;
    let hist: { ms: number; businessQueryCount: number };

    if (appFirst) {
      app = await runListExplorerEventsObserved(
        pool,
        timeoutMs,
        listExplorerEvents,
        appendQuery,
        now,
      );
      hist = await runHistoricalSqlAppend(pool, timeoutMs, countQ, pageQ);
    } else {
      hist = await runHistoricalSqlAppend(pool, timeoutMs, countQ, pageQ);
      app = await runListExplorerEventsObserved(
        pool,
        timeoutMs,
        listExplorerEvents,
        appendQuery,
        now,
      );
    }

    assertProductContract(`listExplorerEvents append (iter ${i})`, app, {
      businessQueries: 1,
      totalCountKind: "null",
    });
    if (hist.businessQueryCount !== 2) {
      throw new Error(
        `Scénario SQL historique : attendu 2 requêtes métier, observé ${hist.businessQueryCount}`,
      );
    }

    if (i === 0) {
      appFirstMs = app.ms;
      histFirstMs = hist.ms;
    } else {
      appSamples.push(app.ms);
      histSamples.push(hist.ms);
    }
    appQueries = app.businessQueryCount;
    histQueries = hist.businessQueryCount;
  }

  const page1Total = page1First.result.totalCount;
  if (typeof page1Total !== "number") {
    throw new Error("Contrat produit : totalCount numérique attendu après assert");
  }

  return {
    page1: {
      ...summarize(page1First.ms, page1Samples),
      businessQueries: page1Queries,
      totalCount: page1Total,
    },
    appendApp: {
      ...summarize(appFirstMs, appSamples),
      businessQueries: appQueries,
    },
    appendHistoricalSql: {
      ...summarize(histFirstMs, histSamples),
      businessQueries: histQueries,
    },
    cursor,
  };
}

type PageRow = { start_at: Date; id: string };

async function fetchPageCursor(
  pool: pg.Pool,
  timeoutMs: number,
  filters: ExplorerResolvedFilters,
  after: ExplorerKeysetAfter | null,
  limit: number,
): Promise<{
  events: PageRow[];
  nextAfter: ExplorerKeysetAfter | null;
  totalCount: number;
}> {
  const countQ = buildCountQuery(filters);
  const pageQ = buildPageQuery(filters, after, limit);
  const clientPair = await acquirePair(pool);
  const { clientA, clientB } = clientPair;
  try {
    await configureReadOnlySession(clientA, timeoutMs);
    await configureReadOnlySession(clientB, timeoutMs);
    await beginReadOnlyTx(clientA);
    await beginReadOnlyTx(clientB);
    try {
      const [countResult, pageResult] = await Promise.all([
        clientA.query<{ count: string }>(countQ.text, countQ.values),
        clientB.query<PageRow>(pageQ.text, pageQ.values),
      ]);
      const totalCount = Number(countResult.rows[0]?.count ?? 0);
      const rows = pageResult.rows;
      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;
      const last = pageRows[pageRows.length - 1];
      const nextAfter =
        hasMore && last ? { startAt: last.start_at, id: last.id } : null;
      return { events: pageRows, nextAfter, totalCount };
    } finally {
      await endTx(clientA);
      await endTx(clientB);
    }
  } finally {
    clientA.release();
    clientB.release();
  }
}

type ExplainSummary = {
  planningMs: number | null;
  executionMs: number | null;
  nodeTypes: string[];
  seqScans: string[];
  sorts: string[];
  windowAggs: number;
  tempBlocks: { read: number; written: number } | null;
  sharedBlocks: { hit: number; read: number } | null;
};

function walkPlan(
  node: Record<string, unknown>,
  acc: ExplainSummary,
  isRoot = false,
): void {
  const nodeType = String(node["Node Type"] ?? "");
  if (nodeType) acc.nodeTypes.push(nodeType);
  if (nodeType === "Seq Scan") {
    acc.seqScans.push(String(node["Relation Name"] ?? "?"));
  }
  if (nodeType === "Sort") acc.sorts.push(String(node["Sort Method"] ?? "?"));
  if (nodeType === "WindowAgg") acc.windowAggs += 1;

  // Les compteurs Shared/Temp d’un nœud incluent déjà ses enfants : total = racine.
  if (isRoot) {
    const sharedHit = Number(node["Shared Hit Blocks"] ?? 0);
    const sharedRead = Number(node["Shared Read Blocks"] ?? 0);
    acc.sharedBlocks = { hit: sharedHit, read: sharedRead };
    const tempRead = Number(node["Temp Read Blocks"] ?? 0);
    const tempWritten = Number(node["Temp Written Blocks"] ?? 0);
    if (tempRead || tempWritten) {
      acc.tempBlocks = { read: tempRead, written: tempWritten };
    }
  }

  const plans = node["Plans"];
  if (Array.isArray(plans)) {
    for (const child of plans) {
      if (child && typeof child === "object") {
        walkPlan(child as Record<string, unknown>, acc, false);
      }
    }
  }
}

function summarizeExplain(raw: unknown): ExplainSummary {
  const acc: ExplainSummary = {
    planningMs: null,
    executionMs: null,
    nodeTypes: [],
    seqScans: [],
    sorts: [],
    windowAggs: 0,
    tempBlocks: null,
    sharedBlocks: null,
  };
  if (!Array.isArray(raw) || !raw[0] || typeof raw[0] !== "object") return acc;
  const root = raw[0] as Record<string, unknown>;
  acc.planningMs =
    typeof root["Planning Time"] === "number" ? root["Planning Time"] : null;
  acc.executionMs =
    typeof root["Execution Time"] === "number" ? root["Execution Time"] : null;
  const plan = root["Plan"];
  if (plan && typeof plan === "object") {
    walkPlan(plan as Record<string, unknown>, acc, true);
  }
  return acc;
}

async function explainQuery(
  pool: pg.Pool,
  timeoutMs: number,
  text: string,
  values: unknown[],
): Promise<ExplainSummary> {
  const wrapped = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)\n${text}`;
  return withConfiguredClient(pool, timeoutMs, async (client) => {
    const result = await client.query<{ "QUERY PLAN": unknown }>(
      wrapped,
      values,
    );
    return summarizeExplain(result.rows[0]?.["QUERY PLAN"]);
  });
}

async function probeCorpus(
  pool: pg.Pool,
  timeoutMs: number,
  now: Date,
): Promise<{
  pgVersion: string;
  totalEvents: number;
  activeEvents: number;
  activeUpcoming: number;
  indexes: string[];
  topCity: string | null;
  topCategory: string | null;
  frequentSearch: string | null;
  rareSearch: string;
  boundedWhen: WhenFilter;
}> {
  return withConfiguredClient(pool, timeoutMs, async (client) => {
    const version = await client.query<{ server_version: string }>(
      "SHOW server_version",
    );
    const totals = await client.query<{ total: string; active: string }>(`
    SELECT
      count(*)::text AS total,
      count(*) FILTER (WHERE is_active)::text AS active
    FROM events
  `);
    const upcoming = await client.query<{ n: string }>(
      `
    SELECT count(*)::text AS n
    FROM events e
    WHERE e.is_active = true
      AND COALESCE(e.end_at, e.start_at) >= $1
  `,
      [now.toISOString()],
    );
    const idx = await client.query<{ indexname: string }>(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'events'
    ORDER BY indexname
  `);
    const cities = await client.query<{ city_key: string; n: string }>(
      `
    SELECT city_key, count(*)::text AS n
    FROM events e
    WHERE e.is_active = true
      AND e.city_key IS NOT NULL
      AND COALESCE(e.end_at, e.start_at) >= $1
    GROUP BY city_key
    ORDER BY count(*) DESC
    LIMIT 5
  `,
      [now.toISOString()],
    );
    const categories = await client.query<{
      product_category: string;
      n: string;
    }>(
      `
    SELECT product_category, count(*)::text AS n
    FROM events e
    WHERE e.is_active = true
      AND e.product_category IS NOT NULL
      AND COALESCE(e.end_at, e.start_at) >= $1
    GROUP BY product_category
    ORDER BY count(*) DESC
    LIMIT 5
  `,
      [now.toISOString()],
    );

    const tokens = await client.query<{ token: string; n: string }>(
      `
    SELECT lower(m[1]) AS token, count(*)::text AS n
    FROM events e,
      LATERAL regexp_matches(
        lower(coalesce(e.title, '')),
        '[a-zàâäéèêëïîôöùûüç]{4,}',
        'gi'
      ) AS m
    WHERE e.is_active = true
      AND COALESCE(e.end_at, e.start_at) >= $1
    GROUP BY 1
    HAVING count(*) >= 3
    ORDER BY count(*) DESC
    LIMIT 8
  `,
      [now.toISOString()],
    );

    let boundedWhen: WhenFilter = "this-month";
    for (const candidate of [
      "this-month",
      "weekend",
      "next-week",
    ] as WhenFilter[]) {
      const filters = resolveFilters({ when: candidate, now });
      const countQ = buildCountQuery(filters);
      const counted = await client.query<{ count: string }>(
        countQ.text,
        countQ.values,
      );
      if (Number(counted.rows[0]?.count ?? 0) > 0) {
        boundedWhen = candidate;
        break;
      }
    }

    return {
      pgVersion: version.rows[0]?.server_version ?? "unknown",
      totalEvents: Number(totals.rows[0]?.total ?? 0),
      activeEvents: Number(totals.rows[0]?.active ?? 0),
      activeUpcoming: Number(upcoming.rows[0]?.n ?? 0),
      indexes: idx.rows.map((row) => row.indexname),
      topCity: cities.rows[0]?.city_key ?? null,
      topCategory: categories.rows[0]?.product_category ?? null,
      frequentSearch: tokens.rows[0]?.token ?? null,
      rareSearch: "zzzxqdetourrare",
      boundedWhen,
    };
  });
}

function fmtStats(stats: TimingStats): string {
  return `1ʳᵉ=${stats.firstMs}ms · n=${stats.samplesMs.length} · médiane=${stats.medianMs}ms · min=${stats.minMs}ms · max=${stats.maxMs}ms`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const connectionMode = redactConnectionMode(args.databaseUrl);
  const pool = new pg.Pool({
    connectionString: args.databaseUrl,
    max: 4,
    allowExitOnIdle: true,
  });

  const lines: string[] = [];
  const log = (line = "") => {
    lines.push(line);
    console.log(line);
  };

  try {
    const probe = await probeCorpus(pool, args.timeoutMs, args.now);
    const limit = EXPLORER_DEFAULT_PAGE_SIZE;

    log("# Mesure coût SQL Explorer");
    log("");
    log("## Reproduction");
    log("");
    log("```bash");
    log(
      `node --conditions=react-server --import tsx scripts/measure-explorer-sql-cost.mts --database-url \"$EXPLORER_SQL_BENCH_DATABASE_URL\" --repeats ${args.repeats} --timeout-ms ${args.timeoutMs}`,
    );
    log("```");
    log("");
    log("## Environnement");
    log("");
    log(`- now figé : \`${args.now.toISOString()}\``);
    log(`- PostgreSQL : ${probe.pgVersion}`);
    log(`- connexion : ${connectionMode} (URL non journalisée)`);
    log(`- statement_timeout : ${args.timeoutMs} ms ; transaction read-only`);
    log(
      `- volume events : total=${probe.totalEvents}, active=${probe.activeEvents}, active∩upcoming=${probe.activeUpcoming}`,
    );
    log(`- page size Explorer : ${limit}`);
    log(`- index events : ${probe.indexes.join(", ") || "(aucun)"}`);
    log(
      `- corpus choisi : city=\`${probe.topCity ?? "∅"}\`, category=\`${probe.topCategory ?? "∅"}\`, when borné=\`${probe.boundedWhen}\`, search fréquente=\`${probe.frequentSearch ?? "∅"}\``,
    );
    log("");

    const scenarios: ScenarioSpec[] = [
      {
        id: "upcoming",
        label: "1. À venir, sans autre filtre",
        filters: resolveFilters({ when: "upcoming", now: args.now }),
      },
      {
        id: "bounded",
        label: `2. Période bornée avec résultats (${probe.boundedWhen})`,
        filters: resolveFilters({
          when: probe.boundedWhen,
          now: args.now,
        }),
      },
    ];

    if (probe.topCity || probe.topCategory) {
      scenarios.push({
        id: "city-category",
        label: `3. Ville et/ou catégorie (${probe.topCity ?? "—"} / ${probe.topCategory ?? "—"})`,
        filters: resolveFilters({
          when: "upcoming",
          city: probe.topCity,
          category: probe.topCategory,
          now: args.now,
        }),
      });
    }

    if (probe.frequentSearch) {
      scenarios.push({
        id: "search-frequent",
        label: `4. Recherche textuelle fréquente (« ${probe.frequentSearch} »)`,
        filters: resolveFilters({
          when: "upcoming",
          search: probe.frequentSearch,
          now: args.now,
        }),
      });
    }

    scenarios.push({
      id: "search-rare",
      label: `5. Recherche rare / sans résultat (« ${probe.rareSearch} »)`,
      filters: resolveFilters({
        when: "upcoming",
        search: probe.rareSearch,
        now: args.now,
      }),
    });

    log("## Mesures (ms)");
    log("");
    log(
      "La colonne **combiné** chronomètre `Promise.all([count, page])` comme l’app — ce n’est **pas** la somme count+page.",
    );
    log("");
    log(
      "| Scénario | Étape | totalCount | count | page | combiné (parallèle) |",
    );
    log("|---|---|---:|---|---|---|");

    type ScenarioResult = {
      spec: ScenarioSpec;
      totalCount: number;
      page1: Record<OpKind, TimingStats>;
      append: Record<OpKind, TimingStats> | null;
      distant: Record<OpKind, TimingStats> | null;
      explain?: { count: ExplainSummary; page: ExplainSummary };
    };

    const results: ScenarioResult[] = [];

    for (const spec of scenarios) {
      const page1Data = await fetchPageCursor(
        pool,
        args.timeoutMs,
        spec.filters,
        null,
        limit,
      );
      const countQ1 = buildCountQuery(spec.filters);
      const pageQ1 = buildPageQuery(spec.filters, null, limit);

      const page1 = {
        count: await measureOp(
          pool,
          args.timeoutMs,
          "count",
          countQ1,
          pageQ1,
          args.repeats,
        ),
        page: await measureOp(
          pool,
          args.timeoutMs,
          "page",
          countQ1,
          pageQ1,
          args.repeats,
        ),
        combined: await measureOp(
          pool,
          args.timeoutMs,
          "combined",
          countQ1,
          pageQ1,
          args.repeats,
        ),
      };

      log(
        `| ${spec.label} | page 1 | ${page1Data.totalCount} | ${fmtStats(page1.count)} | ${fmtStats(page1.page)} | ${fmtStats(page1.combined)} |`,
      );

      let append: ScenarioResult["append"] = null;
      let distant: ScenarioResult["distant"] = null;

      if (page1Data.nextAfter) {
        const after1 = page1Data.nextAfter;
        const countQa = buildCountQuery(spec.filters);
        const pageQa = buildPageQuery(spec.filters, after1, limit);
        append = {
          count: await measureOp(
            pool,
            args.timeoutMs,
            "count",
            countQa,
            pageQa,
            args.repeats,
          ),
          page: await measureOp(
            pool,
            args.timeoutMs,
            "page",
            countQa,
            pageQa,
            args.repeats,
          ),
          combined: await measureOp(
            pool,
            args.timeoutMs,
            "combined",
            countQa,
            pageQa,
            args.repeats,
          ),
        };
        const cursorLabel = encodeExplorerCursor({
          startAt: after1.startAt.toISOString(),
          id: after1.id,
        }).slice(0, 12);
        log(
          `| ${spec.label} | append (curseur \`${cursorLabel}…\`) | ${page1Data.totalCount} | ${fmtStats(append.count)} | ${fmtStats(append.page)} | ${fmtStats(append.combined)} |`,
        );

        // Page éloignée : avancer DISTANT_PAGE_INDEX fois si possible.
        let cursor: ExplorerKeysetAfter | null = after1;
        let reached: ExplorerKeysetAfter | null = null;
        for (let step = 1; step < DISTANT_PAGE_INDEX && cursor; step += 1) {
          const next = await fetchPageCursor(
            pool,
            args.timeoutMs,
            spec.filters,
            cursor,
            limit,
          );
          cursor = next.nextAfter;
          if (cursor) reached = cursor;
        }
        if (reached) {
          const countQd = buildCountQuery(spec.filters);
          const pageQd = buildPageQuery(spec.filters, reached, limit);
          distant = {
            count: await measureOp(
              pool,
              args.timeoutMs,
              "count",
              countQd,
              pageQd,
              args.repeats,
            ),
            page: await measureOp(
              pool,
              args.timeoutMs,
              "page",
              countQd,
              pageQd,
              args.repeats,
            ),
            combined: await measureOp(
              pool,
              args.timeoutMs,
              "combined",
              countQd,
              pageQd,
              args.repeats,
            ),
          };
          log(
            `| ${spec.label} | page éloignée (~${DISTANT_PAGE_INDEX + 1}) | ${page1Data.totalCount} | ${fmtStats(distant.count)} | ${fmtStats(distant.page)} | ${fmtStats(distant.combined)} |`,
          );
        }
      } else {
        log(
          `| ${spec.label} | append | — | (pas de page suivante) | — | — |`,
        );
      }

      results.push({
        spec,
        totalCount: page1Data.totalCount,
        page1,
        append,
        distant,
      });
    }

    // EXPLAIN sur les cas les plus coûteux (médiane combiné page1).
    const ranked = [...results].sort(
      (a, b) => b.page1.combined.medianMs - a.page1.combined.medianMs,
    );
    const explainTargets = ranked.slice(0, 2);

    log("");
    log("## EXPLAIN (ANALYZE, BUFFERS) — cas les plus coûteux");
    log("");
    log(
      "Plans distincts des chronométrages ordinaires (une exécution ANALYZE chacun).",
    );
    log("");

    for (const target of explainTargets) {
      const countQ = buildCountQuery(target.spec.filters);
      const pageQ = buildPageQuery(target.spec.filters, null, limit);
      const countPlan = await explainQuery(
        pool,
        args.timeoutMs,
        countQ.text,
        countQ.values,
      );
      const pagePlan = await explainQuery(
        pool,
        args.timeoutMs,
        pageQ.text,
        pageQ.values,
      );
      target.explain = { count: countPlan, page: pagePlan };

      const fmtPlan = (label: string, plan: ExplainSummary) => {
        log(`### ${target.spec.label} — ${label}`);
        log("");
        log(
          `- planning=${plan.planningMs ?? "?"} ms · execution=${plan.executionMs ?? "?"} ms`,
        );
        log(
          `- WindowAgg×${plan.windowAggs} · Seq Scan: ${plan.seqScans.join(", ") || "aucun"} · Sort: ${plan.sorts.join(", ") || "aucun"}`,
        );
        if (plan.sharedBlocks) {
          log(
            `- buffers shared hit=${plan.sharedBlocks.hit} read=${plan.sharedBlocks.read}`,
          );
        }
        if (plan.tempBlocks) {
          log(
            `- **temp blocks** read=${plan.tempBlocks.read} written=${plan.tempBlocks.written} (possible débordement disque)`,
          );
        } else {
          log("- pas de temp blocks observés");
        }
        log(
          `- nœuds (ordre parcours): ${[...new Set(plan.nodeTypes)].join(" → ")}`,
        );
        log("");
      };
      fmtPlan("COUNT", countPlan);
      fmtPlan("PAGE", pagePlan);
    }

    // Parcours applicatif réel (listExplorerEvents) + témoin SQL historique
    const productPath = await measureProductPath(
      pool,
      args.timeoutMs,
      args.repeats,
      listExplorerEvents,
      args.now,
      limit,
    );

    log("## Parcours produit — listExplorerEvents (observé)");
    log("");
    log(
      "Appels réels à `listExplorerEvents` via client injectable. **Durées** = uniquement l’appel applicatif (requêtes métier) : acquisition, SET, BEGIN READ ONLY, ROLLBACK et release sont **hors** chrono. Comptage des requêtes métier sur la même exécution chronométrée ; SET/BEGIN/ROLLBACK exclus du compteur.",
    );
    log("");

    if (!productPath) {
      log(
        "- Pas de curseur append disponible après la 1ʳᵉ page upcoming : comparaison append non exécutée.",
      );
    } else {
      const cursorLabel = productPath.cursor.slice(0, 12);
      log(
        `| Variante | requêtes métier observées | totalCount | 1ʳᵉ (ms) | n | médiane | min | max |`,
      );
      log(`|---|---:|---|---:|---:|---:|---:|---:|`);
      log(
        `| listExplorerEvents 1ʳᵉ page | ${productPath.page1.businessQueries} | ${productPath.page1.totalCount} | ${productPath.page1.firstMs} | ${productPath.page1.samplesMs.length} | ${productPath.page1.medianMs} | ${productPath.page1.minMs} | ${productPath.page1.maxMs} |`,
      );
      log(
        `| listExplorerEvents append (curseur \`${cursorLabel}…\`) | ${productPath.appendApp.businessQueries} | null | ${productPath.appendApp.firstMs} | ${productPath.appendApp.samplesMs.length} | ${productPath.appendApp.medianMs} | ${productPath.appendApp.minMs} | ${productPath.appendApp.maxMs} |`,
      );
      log(
        `| scénario SQL historique count+page (témoin, même curseur) | ${productPath.appendHistoricalSql.businessQueries} | — | ${productPath.appendHistoricalSql.firstMs} | ${productPath.appendHistoricalSql.samplesMs.length} | ${productPath.appendHistoricalSql.medianMs} | ${productPath.appendHistoricalSql.minMs} | ${productPath.appendHistoricalSql.maxMs} |`,
      );
      log("");
      log(
        `- Contrôle banc : 1ʳᵉ page = **2** requêtes + total numérique ; append = **1** requête + \`totalCount: null\` (échec dur si divergence).`,
      );
      log(
        `- Append : variantes **alternées** (app ↔ historique) sous même cible, filtres upcoming, limite, curseur et \`now\`.`,
      );
      log(
        `- Connexion de **cette** exécution : **${connectionMode}** (ne pas croiser avec un rapport AVANT sur un autre endpoint).`,
      );
      log(
        `- Delta médiane append (historique SQL − listExplorerEvents) ≈ **${Math.round((productPath.appendHistoricalSql.medianMs - productPath.appendApp.medianMs) * 10) / 10} ms** — latence observée sur ce banc uniquement, pas un gain UX extrapolé.`,
      );
    }

    const upcoming = results.find((r) => r.spec.id === "upcoming");
    const appendCost = upcoming?.append;

    log("");
    log("## Lecture des résultats");
    log("");
    if (productPath) {
      log(
        `- Parcours app (upcoming) : 1ʳᵉ page médiane **${productPath.page1.medianMs} ms** (${productPath.page1.businessQueries} req), append médiane **${productPath.appendApp.medianMs} ms** (${productPath.appendApp.businessQueries} req) — hors setup/teardown de session.`,
      );
      log(
        `- Témoin SQL historique append : médiane **${productPath.appendHistoricalSql.medianMs} ms** (${productPath.appendHistoricalSql.businessQueries} req) — mêmes frontières de chrono.`,
      );
    }
    if (upcoming && appendCost) {
      log(
        `- Section Mesures SQL (builders, hors listExplorerEvents) — append upcoming : count médiane **${appendCost.count.medianMs} ms**, page **${appendCost.page.medianMs} ms**, combiné **${appendCost.combined.medianMs} ms**.`,
      );
    }
    log(
      `- Le ratio des médianes ne prouve pas à lui seul une saturation CPU ; pas d’extrapolation UX.`,
    );

    log("");
    log("## Limites");
    log("");
    log(
      "- Banc unique, corpus existant ; **pas** un cache froid ni un p95 production.",
    );
    log(
      "- Première exécution isolée ; médiane sur répétitions bornées uniquement.",
    );
    log(
      "- Parcours produit : deux connexions READ ONLY pré-ouvertes pour ne pas sérialiser count+page ; le chrono n’inclut pas connect / SET / BEGIN / ROLLBACK / release.",
    );
    log(
      "- Ne pas comparer en % un rapport AVANT (souvent endpoint direct) et une mesure pooler sans le préciser.",
    );
    log("");
    log("## Contrat produit (observé)");
    log("");
    log(
      "- Première page / filtres / reload : **2 requêtes** métier, `totalCount: number`.",
    );
    log(
      "- Append (curseur valide) : **1 requête** métier, `totalCount: null` ; le client conserve le total.",
    );

    log("");
    log(
      "_Note : rapport APRES — parcours mesuré via `listExplorerEvents` ; le témoin « scénario SQL historique » rejoue count+page sans l’action applicative._",
    );

    const outFile = resolve(process.cwd(), args.outPath);
    writeFileSync(outFile, `${lines.join("\n")}\n`, "utf8");
    console.error(`\nReport written to ${args.outPath}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "measure-explorer-sql-cost failed",
  );
  process.exitCode = 1;
});
