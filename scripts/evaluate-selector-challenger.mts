/**
 * Expérience offline : selector challenger (ranking global) vs production V3.1.
 * Usage : npm run audit:challenger -- scripts/audit-detour-editorial-v3.1.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { selectChallengerGlobalTop10 } from "../src/application/debug/editorial-eval/challenger-global-ranking";
import {
  evaluateEditorialSnapshot,
  formatEditorialEvalReport,
} from "../src/application/debug/editorial-eval/evaluate-snapshot";
import type {
  EditorialAuditSnapshot,
  GoldenSetFile,
} from "../src/application/debug/editorial-eval/types";

const GOLDEN_PATH = resolve(process.cwd(), "scripts/editorial-golden-set.json");

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function main() {
  const snapshotPath = resolve(
    process.cwd(),
    process.argv[2] ?? "scripts/audit-detour-editorial-v3.1.json",
  );
  const golden = loadJson<GoldenSetFile>(GOLDEN_PATH);
  const snapshot = loadJson<EditorialAuditSnapshot>(snapshotPath);

  const production = evaluateEditorialSnapshot({
    snapshot,
    golden,
    versionLabel: "V3.1-production",
  });

  const challengerPicks = selectChallengerGlobalTop10(snapshot.rows ?? [], 10);
  const challengerSnapshot: EditorialAuditSnapshot = {
    meta: { ...(snapshot.meta ?? {}), challenger: "global-editorial-ranking" },
    rows: snapshot.rows,
    highlights: challengerPicks.map((pick) => ({
      title: pick.row.title,
      slot: pick.explainAxis,
      city: pick.row.city,
      startAt: pick.row.startAt,
    })),
  };

  const challenger = evaluateEditorialSnapshot({
    snapshot: challengerSnapshot,
    golden,
    versionLabel: "V3.1-challenger-global",
  });

  console.log(formatEditorialEvalReport(production));
  console.log("\n" + "=".repeat(60) + "\n");
  console.log(formatEditorialEvalReport(challenger));

  console.log("\n" + "=".repeat(60));
  console.log("CHALLENGER TOP10 détail");
  for (const [index, pick] of challengerPicks.entries()) {
    const r = pick.row;
    console.log(
      [
        `${index + 1}.`,
        `score=${pick.editorialScore}`,
        `axis=${pick.explainAxis}`,
        `a/m/p/lr/d=${r.appeal}/${r.missRisk}/${r.planningNeed}/${r.localRarity}/${r.likelyDemand}`,
        r.title.slice(0, 60),
      ].join(" "),
    );
  }

  const prodTitles = new Set(production.radarTop10.map((item) => item.title));
  const chalTitles = new Set(challenger.radarTop10.map((item) => item.title));
  console.log("\nEntrées challenger:", [...chalTitles].filter((t) => !prodTitles.has(t)));
  console.log("Sorties challenger:", [...prodTitles].filter((t) => !chalTitles.has(t)));

  console.log("\nCOMPARAISON");
  for (const report of [production, challenger]) {
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

  const watch = [
    /chameau/i,
    /NACH|endroit partout/i,
    /Portés/i,
    /Hadrien/i,
    /enregistrement d'un CD Live/i,
    /Loto 3000/i,
    /Short Message/i,
    /CANAILLE/i,
    /Floréales/i,
    /Fapy/i,
  ];
  console.log("\nWATCHLIST (rang challenger / editorialScore)");
  for (const re of watch) {
    const idx = challengerPicks.findIndex((pick) => re.test(pick.row.title));
    const row = (snapshot.rows ?? []).find((item) => re.test(item.title));
    if (!row) {
      console.log("?", re, "absent corpus");
      continue;
    }
    const score =
      2 * (row.appeal ?? 0) +
      (row.missRisk ?? 0) +
      (row.planningNeed ?? 0) +
      (row.localRarity ?? 0);
    console.log(
      idx >= 0 ? `IN#${idx + 1}` : "OUT",
      `score=${score}`,
      row.title.slice(0, 50),
    );
  }
}

main();
