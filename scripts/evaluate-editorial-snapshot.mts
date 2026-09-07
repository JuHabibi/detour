/**
 * Harness d’évaluation éditoriale offline — lecture seule.
 * Usage :
 *   npm run audit:evaluate -- scripts/audit-detour-editorial-v3.1.json
 *   npm run audit:evaluate -- --golden scripts/editorial-golden-set-v2.json scripts/audit-detour-editorial-v3.1.json
 */
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
  evaluateEditorialSnapshot,
  formatEditorialEvalReport,
} from "../src/application/debug/editorial-eval/evaluate-snapshot";
import type {
  EditorialAuditSnapshot,
  GoldenSetFile,
} from "../src/application/debug/editorial-eval/types";

const DEFAULT_GOLDEN_PATH = resolve(
  process.cwd(),
  "scripts/editorial-golden-set.json",
);

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function versionLabelFromPath(path: string): string {
  const name = basename(path);
  if (/v2/i.test(name)) return "V2";
  if (/v3\.1/i.test(name)) return "V3.1";
  if (/v3/i.test(name)) return "V3";
  return name.replace(/\.json$/i, "");
}

function parseArgs(argv: string[]): { goldenPath: string; snapshots: string[] } {
  const snapshots: string[] = [];
  let goldenPath = DEFAULT_GOLDEN_PATH;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--golden") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("--golden requires a path");
      }
      goldenPath = resolve(process.cwd(), next);
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) continue;
    snapshots.push(arg);
  }
  return { goldenPath, snapshots };
}

function main() {
  const { goldenPath, snapshots } = parseArgs(process.argv.slice(2));
  if (snapshots.length === 0) {
    console.error(
      "Usage: npm run audit:evaluate -- [--golden scripts/editorial-golden-set-v2.json] <snapshot.json> [...]",
    );
    process.exitCode = 1;
    return;
  }

  const golden = loadJson<GoldenSetFile>(goldenPath);
  console.error(`golden=${goldenPath} (version=${golden.version})`);

  const reports = snapshots.map((arg) => {
    const path = resolve(process.cwd(), arg);
    const snapshot = loadJson<EditorialAuditSnapshot>(path);
    return evaluateEditorialSnapshot({
      snapshot,
      golden,
      versionLabel: versionLabelFromPath(path),
    });
  });

  for (const [index, report] of reports.entries()) {
    if (index > 0) console.log("\n" + "=".repeat(60) + "\n");
    console.log(formatEditorialEvalReport(report));
  }

  if (reports.length >= 2) {
    console.log("\n" + "=".repeat(60));
    console.log("COMPARAISON");
    for (const report of reports) {
      const recall = report.mustRecallAt10.recall;
      console.log(
        [
          report.versionLabel,
          `recall=${recall == null ? "n/a" : recall.toFixed(3)}`,
          `ndcg=${report.ndcgAt10.toFixed(3)}`,
          `M/Mb/N/U=${report.precisionAt10.must}/${report.precisionAt10.maybe}/${report.precisionAt10.no}/${report.precisionAt10.unlabeled}`,
          `mustMiss=${report.goldenHits.mustMissed.length}`,
        ].join(" | "),
      );
    }
  }
}

main();
