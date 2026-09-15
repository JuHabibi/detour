#!/usr/bin/env node
/**
 * Benchmark temporaire Home prod (DET-14).
 * Mesure TTFB via curl `time_starttransfer` — comparable aux mesures manuelles.
 *
 * Usage:
 *   node scripts/bench-home-prod.mjs
 *   node scripts/bench-home-prod.mjs --url=https://detour-tan.vercel.app/
 *   node scripts/bench-home-prod.mjs --warm=10 --delay-ms=400
 *
 * Ne touche pas au cache applicatif (pas de query param, pas de purge).
 */

import { spawnSync } from "node:child_process";

const DEFAULT_URL = "https://detour-tan.vercel.app/";
const DEFAULT_WARM = 10;
const DEFAULT_DELAY_MS = 400;

function parseArgs(argv) {
  const out = {
    url: DEFAULT_URL,
    warm: DEFAULT_WARM,
    delayMs: DEFAULT_DELAY_MS,
  };
  for (const arg of argv) {
    if (arg.startsWith("--url=")) out.url = arg.slice("--url=".length);
    else if (arg.startsWith("--warm="))
      out.warm = Math.max(1, Number(arg.slice("--warm=".length)) || DEFAULT_WARM);
    else if (arg.startsWith("--delay-ms="))
      out.delayMs = Math.max(
        0,
        Number(arg.slice("--delay-ms=".length)) || DEFAULT_DELAY_MS,
      );
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Un hit curl séquentiel.
 * Pas de Cache-Control client : on veut mesurer le cache serveur applicatif.
 */
function curlOnce(url) {
  const format = [
    "http_code=%{http_code}",
    "time_starttransfer=%{time_starttransfer}",
    "time_total=%{time_total}",
    "size_download=%{size_download}",
  ].join("\n");

  const result = spawnSync(
    "curl",
    [
      "-sS",
      "-o",
      "/dev/null",
      "-w",
      format,
      "--max-time",
      "120",
      url,
    ],
    { encoding: "utf8" },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `curl exit ${result.status}: ${(result.stderr || "").trim()}`,
    );
  }

  const lines = Object.fromEntries(
    result.stdout
      .trim()
      .split("\n")
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );

  return {
    status: Number(lines.http_code),
    ttfbMs: Math.round(Number(lines.time_starttransfer) * 1000),
    totalMs: Math.round(Number(lines.time_total) * 1000),
    bytes: Number(lines.size_download),
  };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx];
}

function median(sorted) {
  if (sorted.length === 0) return NaN;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

function printHit(index, hit) {
  console.log(`#${index}`);
  console.log(`status=${hit.status}`);
  console.log(`ttfb=${hit.ttfbMs}ms`);
  console.log(`total=${hit.totalMs}ms`);
  console.log(`bytes=${hit.bytes}`);
  console.log("");
}

async function main() {
  const { url, warm, delayMs } = parseArgs(process.argv.slice(2));
  const totalHits = 1 + warm;

  console.log(`bench-home-prod`);
  console.log(`url=${url}`);
  console.log(`hits=${totalHits} (1 first + ${warm} warm)`);
  console.log(`delay_ms=${delayMs}`);
  console.log("");

  /** @type {Array<{ status: number, ttfbMs: number, totalMs: number, bytes: number }>} */
  const hits = [];

  for (let i = 1; i <= totalHits; i += 1) {
    const hit = curlOnce(url);
    hits.push(hit);
    printHit(i, hit);
    if (i < totalHits && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  const first = hits[0];
  const warmHits = hits.slice(1);
  const ttfbWarm = warmHits.map((h) => h.ttfbMs).sort((a, b) => a - b);
  const totalWarm = warmHits.map((h) => h.totalMs).sort((a, b) => a - b);

  console.log("hit | status | ttfb_ms | total_ms | bytes");
  console.log("----+--------+---------+----------+------");
  hits.forEach((h, i) => {
    console.log(
      `${String(i + 1).padStart(3)} | ${String(h.status).padStart(6)} | ${String(h.ttfbMs).padStart(7)} | ${String(h.totalMs).padStart(8)} | ${h.bytes}`,
    );
  });
  console.log("");

  console.log("summary");
  console.log(`first request  ttfb=${first.ttfbMs}ms  total=${first.totalMs}ms`);
  console.log(
    `median warm    ttfb=${median(ttfbWarm)}ms  total=${median(totalWarm)}ms`,
  );
  console.log(
    `p95 warm       ttfb=${percentile(ttfbWarm, 95)}ms  total=${percentile(totalWarm, 95)}ms`,
  );
  console.log(
    `min warm       ttfb=${ttfbWarm[0]}ms  total=${totalWarm[0]}ms`,
  );
  console.log(
    `max warm       ttfb=${ttfbWarm[ttfbWarm.length - 1]}ms  total=${totalWarm[totalWarm.length - 1]}ms`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
