import {
  gainForLabel,
  countSlots,
  distributionStats,
  matchGoldenItem,
  ndcgAtK,
} from "@/application/debug/editorial-eval/metrics";
import type {
  EditorialAuditSnapshot,
  GoldenLabel,
  GoldenSetFile,
  GoldenSetItem,
  SnapshotHighlight,
  SnapshotRow,
} from "@/application/debug/editorial-eval/types";
import {
  isJudgeableLabel,
  resolveGoldenLabel,
} from "@/application/debug/editorial-eval/types";

const K = 10;

export type EditorialEvalReport = {
  versionLabel: string;
  radarTop10: Array<{
    title: string;
    slot: string | null;
    label: GoldenLabel | null;
  }>;
  mustRecallAt10: {
    hit: number;
    eligible: number;
    recall: number | null;
  };
  precisionAt10: {
    must: number;
    maybe: number;
    no: number;
    unlabeled: number;
    /** UNJUDGEABLE dans le top-k : exclu de la qualité, reporté à part. */
    unjudgeable: number;
    /** (MUST + MAYBE) / 10 — unlabeled et UNJUDGEABLE contribuent 0, pas NO. */
    score: number;
  };
  ndcgAt10: number;
  ndcgRule: string;
  goldenHits: {
    mustSelected: string[];
    mustMissed: string[];
    maybeSelected: string[];
    noSelected: string[];
  };
  slotDistribution: Record<string, number>;
  emptySlots: string[];
  assessmentStats: Record<
    string,
    { mean: number; median: number; min: number; max: number; n: number }
  >;
  availabilityInRadar: "ok_zero" | "violation" | "non_mesurable";
  discoveryDuplicates: "non_mesurable" | number;
  reasonFactuality: "revue_humaine";
  corpusSize: number;
  labeledInCorpus: number;
};

export function evaluateEditorialSnapshot(params: {
  snapshot: EditorialAuditSnapshot;
  golden: GoldenSetFile;
  versionLabel: string;
}): EditorialEvalReport {
  const { snapshot, golden, versionLabel } = params;
  const items = golden.items;

  /** Unités golden jugeables présentes dans le corpus (clé = eventId canonique). */
  const judgeableUnitsInCorpus = new Map<string, GoldenSetItem>();
  const eligibleMustUnits = new Set<string>();
  const seenTitles = new Set<string>();

  const registerCorpusItem = (
    row: SnapshotRow | SnapshotHighlight,
  ): void => {
    seenTitles.add(`${row.title}|${row.startAt ?? ""}`);
    const matched = matchGoldenItem(row, items);
    if (!matched) return;
    const label = resolveGoldenLabel(matched);
    if (!isJudgeableLabel(label)) return;
    judgeableUnitsInCorpus.set(matched.eventId, matched);
    if (label === "MUST") eligibleMustUnits.add(matched.eventId);
  };

  for (const row of snapshot.rows ?? []) registerCorpusItem(row);
  for (const highlight of snapshot.highlights ?? []) {
    registerCorpusItem(highlight);
  }

  const idealGains = [...judgeableUnitsInCorpus.values()].map((item) =>
    gainForLabel(resolveGoldenLabel(item)),
  );

  const radar = (snapshot.highlights ?? []).slice(0, K);
  const radarMatched = radar.map((highlight) => ({
    highlight,
    golden: matchGoldenItem(highlight, items),
  }));

  /** Une unité golden ne crédite qu’une fois dans le top-k. */
  const creditedUnitIds = new Set<string>();
  const radarLabels: Array<GoldenLabel | null> = [];
  const gains: number[] = [];

  for (const entry of radarMatched) {
    const matched = entry.golden;
    const label = matched ? resolveGoldenLabel(matched) : null;
    if (!matched || !label) {
      radarLabels.push(null);
      gains.push(0);
      continue;
    }
    if (label === "UNJUDGEABLE") {
      radarLabels.push("UNJUDGEABLE");
      gains.push(0);
      continue;
    }
    if (creditedUnitIds.has(matched.eventId)) {
      radarLabels.push(label);
      gains.push(0);
      continue;
    }
    creditedUnitIds.add(matched.eventId);
    radarLabels.push(label);
    gains.push(gainForLabel(label));
  }

  let must = 0;
  let maybe = 0;
  let no = 0;
  let unlabeled = 0;
  let unjudgeable = 0;
  for (const label of radarLabels) {
    if (label === "MUST") must += 1;
    else if (label === "MAYBE") maybe += 1;
    else if (label === "NO") no += 1;
    else if (label === "UNJUDGEABLE") unjudgeable += 1;
    else unlabeled += 1;
  }

  const mustSelectedIds = new Set(
    radarMatched
      .filter(
        (entry) =>
          entry.golden && resolveGoldenLabel(entry.golden) === "MUST",
      )
      .map((entry) => entry.golden!.eventId),
  );

  const mustSelected = [...mustSelectedIds].map(
    (eventId) =>
      items.find((item) => item.eventId === eventId)?.titleMatch ?? eventId,
  );

  const mustMissed = [...eligibleMustUnits]
    .filter((eventId) => !mustSelectedIds.has(eventId))
    .map(
      (eventId) =>
        items.find((item) => item.eventId === eventId)?.titleMatch ?? eventId,
    );

  const maybeSelected = [
    ...new Set(
      radarMatched
        .filter(
          (entry) =>
            entry.golden && resolveGoldenLabel(entry.golden) === "MAYBE",
        )
        .map((entry) => entry.golden!.titleMatch),
    ),
  ];

  const noSelected = [
    ...new Set(
      radarMatched
        .filter(
          (entry) => entry.golden && resolveGoldenLabel(entry.golden) === "NO",
        )
        .map((entry) => entry.golden!.titleMatch),
    ),
  ];

  const slotDistribution = countSlots(radar.map((item) => item.slot));
  const emptySlots = Object.entries(slotDistribution)
    .filter(([, count]) => count === 0)
    .map(([slot]) => slot);

  const dims = [
    "appeal",
    "missRisk",
    "planningNeed",
    "localRarity",
    "likelyDemand",
    "confidence",
  ] as const;
  const assessmentStats: EditorialEvalReport["assessmentStats"] = {};
  for (const dim of dims) {
    const values = (snapshot.rows ?? [])
      .map((row) => row[dim])
      .filter((value): value is number => typeof value === "number");
    assessmentStats[dim] = distributionStats(values);
  }

  return {
    versionLabel,
    radarTop10: radarMatched.map((entry) => ({
      title: entry.highlight.title,
      slot: entry.highlight.slot ?? null,
      label: entry.golden ? resolveGoldenLabel(entry.golden) : null,
    })),
    mustRecallAt10: {
      hit: mustSelectedIds.size,
      eligible: eligibleMustUnits.size,
      recall:
        eligibleMustUnits.size === 0
          ? null
          : mustSelectedIds.size / eligibleMustUnits.size,
    },
    precisionAt10: {
      must,
      maybe,
      no,
      unlabeled,
      unjudgeable,
      score: (must + maybe) / K,
    },
    ndcgAt10: ndcgAtK(gains, idealGains, K),
    ndcgRule:
      "gain: MUST=3 MAYBE=1 NO=0; unlabeled/UNJUDGEABLE=0; IDCG = unités golden jugeables uniques du corpus",
    goldenHits: {
      mustSelected,
      mustMissed,
      maybeSelected,
      noSelected,
    },
    slotDistribution,
    emptySlots,
    assessmentStats,
    availabilityInRadar: measureAvailability(radar),
    discoveryDuplicates: "non_mesurable",
    reasonFactuality: "revue_humaine",
    corpusSize: seenTitles.size || (snapshot.rows?.length ?? 0),
    labeledInCorpus: judgeableUnitsInCorpus.size,
  };
}

function measureAvailability(
  radar: SnapshotHighlight[],
): EditorialEvalReport["availabilityInRadar"] {
  const hasField = radar.some(
    (item) =>
      item.availabilityStatus !== undefined && item.availabilityStatus !== null,
  );
  if (!hasField) return "non_mesurable";
  const soldOut = radar.filter(
    (item) =>
      item.availabilityStatus === "sold_out" ||
      item.availabilityStatus === "sold_out_online",
  );
  return soldOut.length === 0 ? "ok_zero" : "violation";
}

export function formatEditorialEvalReport(report: EditorialEvalReport): string {
  const lines: string[] = [];
  lines.push(`VERSION ${report.versionLabel}`);
  lines.push("Radar top10:");
  for (const [index, item] of report.radarTop10.entries()) {
    lines.push(
      `  ${index + 1}. [${item.slot ?? "?"}] (${item.label ?? "unlabeled"}) ${item.title}`,
    );
  }
  const recall = report.mustRecallAt10;
  lines.push(
    `MUST recall@10: ${recall.hit}/${recall.eligible}` +
      (recall.recall == null ? " (n/a)" : ` = ${recall.recall.toFixed(3)}`),
  );
  lines.push(`nDCG@10: ${report.ndcgAt10.toFixed(3)}`);
  lines.push(
    `Composition@10: MUST=${report.precisionAt10.must} MAYBE=${report.precisionAt10.maybe} NO=${report.precisionAt10.no} unlabeled=${report.precisionAt10.unlabeled} UNJUDGEABLE=${report.precisionAt10.unjudgeable} | precision(MUST+MAYBE)/10=${report.precisionAt10.score.toFixed(2)}`,
  );
  lines.push(
    `Slots: ${Object.entries(report.slotDistribution)
      .map(([slot, count]) => `${slot}=${count}`)
      .join(" ")}`,
  );
  if (report.emptySlots.length > 0) {
    lines.push(`Slots vides: ${report.emptySlots.join(", ")}`);
  }
  lines.push("Moyennes assessment (corpus rows):");
  for (const [dim, stats] of Object.entries(report.assessmentStats)) {
    lines.push(
      `  ${dim}: mean=${stats.mean.toFixed(2)} median=${stats.median.toFixed(2)} min=${stats.min} max=${stats.max} n=${stats.n}`,
    );
  }
  lines.push(
    `MUST sélectionnés (${report.goldenHits.mustSelected.length}): ${report.goldenHits.mustSelected.join(" | ") || "—"}`,
  );
  lines.push(
    `MUST manqués (${report.goldenHits.mustMissed.length}): ${report.goldenHits.mustMissed.join(" | ") || "—"}`,
  );
  lines.push(
    `MAYBE sélectionnés (${report.goldenHits.maybeSelected.length}): ${report.goldenHits.maybeSelected.join(" | ") || "—"}`,
  );
  lines.push(
    `NO sélectionnés (${report.goldenHits.noSelected.length}): ${report.goldenHits.noSelected.join(" | ") || "—"}`,
  );
  lines.push(`Disponibilité Radar: ${report.availabilityInRadar}`);
  lines.push(`Duplications discoveryKey: ${report.discoveryDuplicates}`);
  lines.push(`Reason factuality: ${report.reasonFactuality}`);
  lines.push(
    `Unités jugeables dans corpus (IDCG): ${report.labeledInCorpus}`,
  );
  return lines.join("\n");
}
