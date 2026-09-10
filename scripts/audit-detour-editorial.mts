/**
 * Audit live « Faites un détour » — lecture seule, aucun fichier métier modifié.
 * Usage : npx tsx --env-file=.env.local scripts/audit-detour-editorial.mts
 */
import { writeFileSync } from "node:fs";
import { EventService } from "../src/application/event.service";
import { getAiConfig } from "../src/config/ai-config";
import { combinedAiScore } from "../src/domain/editorial/highlight-assessment";
import {
  qualifiesAsPassageRare,
  resolveEditorialBadge,
} from "../src/domain/editorial/resolve-editorial-badge";
import { createHighlightAssessmentProvider } from "../src/infrastructure/ai/create-highlight-assessment-provider";
import { createMemoryAiAssessmentCacheStore } from "../src/application/ai/ai-assessment-cache";
import { CompositeEventSourceAdapter } from "../src/infrastructure/composite-event-source.adapter";
import { OrleansEventAdapter } from "../src/infrastructure/sources/orleans/orleans-event.adapter";
import { SaranEventAdapter } from "../src/infrastructure/sources/saran/saran-event.adapter";
import { AI_ASSESSMENT_PROMPT_VERSION } from "../src/infrastructure/ai/openai-highlight-assessment.provider";

const WINDOW_DAYS = 180;
const TOP_N = 50;

/** Composite live historique V2/V3 — Orléans + Saran uniquement (hors DB / Ingré). */
function createBenchmarkLiveEventSource() {
  return new CompositeEventSourceAdapter([
    {
      name: "orleans",
      label: "Orléans / OpenAgenda",
      adapter: new OrleansEventAdapter(),
    },
    {
      name: "saran",
      label: "Ville de Saran",
      adapter: new SaranEventAdapter(),
    },
  ]);
}

function countBy(items: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of items) {
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(out).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  );
}

async function main() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + WINDOW_DAYS);

  const aiConfig = getAiConfig();
  if (AI_ASSESSMENT_PROMPT_VERSION !== "detour-ai-assess-v3.1") {
    throw new Error(
      `Expected promptVersion detour-ai-assess-v3.1, got ${AI_ASSESSMENT_PROMPT_VERSION}`,
    );
  }
  console.error(`promptVersion=${AI_ASSESSMENT_PROMPT_VERSION}`);

  const service = new EventService(
    createBenchmarkLiveEventSource(),
    createHighlightAssessmentProvider(),
    {
      aiConfig: { ...aiConfig, mode: aiConfig.enabled ? "auto" : aiConfig.mode },
      cacheStore: createMemoryAiAssessmentCacheStore(),
    },
  );

  const result = await service.getUpcomingEvents({ from, to });
  const assessmentById = new Map(
    result.aiAssessments.map((item) => [item.eventId, item] as const),
  );
  const slotById = new Map(
    result.highlights.map((item) => [item.event.id, item.slot ?? null] as const),
  );

  const rankedPool = [...result.aiShortlist]
    .map((candidate, index) => {
      const assessment = assessmentById.get(candidate.event.id);
      return { candidate, assessment, index };
    })
    .filter((item) => item.assessment != null)
    .sort((a, b) => {
      const scoreDiff =
        combinedAiScore(b.assessment!) - combinedAiScore(a.assessment!);
      if (scoreDiff !== 0) return scoreDiff;
      return a.index - b.index;
    })
    .slice(0, TOP_N);

  const rows = rankedPool.map(({ candidate, assessment }, rank) => {
    const a = assessment!;
    const badge = resolveEditorialBadge({
      planningNeed: a.planningNeed,
      localRarity: a.localRarity,
      missRisk: a.missRisk,
      confidence: a.confidence,
      reasons: a.reasons,
      hasRegistrationUrl: Boolean(candidate.event.registrationUrl),
    });

    return {
      rank: rank + 1,
      title: candidate.event.title,
      city: candidate.event.city,
      venue: candidate.event.venue,
      startAt: candidate.event.startAt,
      source: candidate.event.source,
      finalSlot: slotById.get(candidate.event.id) ?? null,
      editorialBadge: badge,
      appeal: a.appeal,
      missRisk: a.missRisk,
      planningNeed: a.planningNeed,
      localRarity: a.localRarity,
      likelyDemand: a.likelyDemand,
      confidence: a.confidence,
      aiReasons: a.reasons,
      hasRegistrationUrl: Boolean(candidate.event.registrationUrl),
      combined: combinedAiScore(a),
    };
  });

  const badges = rows.map((r) => r.editorialBadge ?? "(aucun)");
  const cities = rows.map((r) => r.city || "(sans ville)");
  const venues = rows.map((r) => r.venue || "(sans venue)");
  const sources = rows.map((r) => r.source || "(sans source)");
  const slots = result.highlights.map((h) => h.slot ?? "(sans slot)");

  const anomalies: Array<{ type: string; title: string; detail: string }> = [];

  const cityDist = countBy(cities);
  const venueDist = countBy(venues);
  const sourceDist = countBy(sources);

  for (const [city, n] of Object.entries(cityDist)) {
    if (n >= Math.ceil(rows.length * 0.35)) {
      anomalies.push({
        type: "ville-dominante",
        title: city,
        detail: `${n}/${rows.length} dans le top ${rows.length}`,
      });
    }
  }
  for (const [venue, n] of Object.entries(venueDist)) {
    if (n >= 4) {
      anomalies.push({
        type: "lieu-dominant",
        title: venue,
        detail: `${n} événements dans le top éditorial`,
      });
    }
  }

  for (const row of rows) {
    if (
      row.localRarity >= 3 &&
      !qualifiesAsPassageRare(row.localRarity, row.confidence, row.aiReasons)
    ) {
      anomalies.push({
        type: "localRarity-sans-justification",
        title: row.title,
        detail: `localRarity=${row.localRarity} conf=${row.confidence.toFixed(2)} reasons=${row.aiReasons.join(" | ") || "∅"}`,
      });
    }

    if (row.editorialBadge === "Passage rare") {
      const reasonsBlob = row.aiReasons.join(" ").toLowerCase();
      if (
        !/inhabituel|rarement|exceptionnell|raret|rare dans|rare sur/.test(
          reasonsBlob,
        )
      ) {
        anomalies.push({
          type: "badge-incoherent-reasons",
          title: row.title,
          detail: `Passage rare vs reasons: ${row.aiReasons.join(" | ") || "∅"}`,
        });
      }
    }

    if (row.likelyDemand >= 4 && row.appeal < 3 && row.localRarity < 3) {
      anomalies.push({
        type: "likelyDemand-sans-signal-clair",
        title: row.title,
        detail: `likelyDemand=${row.likelyDemand} appeal=${row.appeal} localRarity=${row.localRarity}`,
      });
    }

    if (
      row.planningNeed >= 3 &&
      !row.hasRegistrationUrl &&
      !/reserv|billett|anticip|avance|jauge|complet/i.test(
        row.aiReasons.join(" "),
      )
    ) {
      anomalies.push({
        type: "planningNeed-sans-contrainte",
        title: row.title,
        detail: `planningNeed=${row.planningNeed} sans registrationUrl ni reason contrainte`,
      });
    }
  }

  const report = {
    meta: {
      from: from.toISOString(),
      to: to.toISOString(),
      auditedAt: new Date().toISOString(),
      aiEnabled: aiConfig.enabled,
      aiMode: aiConfig.mode,
      aiSource: result.aiMeta.source,
      shortlistSize: result.aiShortlist.length,
      assessmentsCount: result.aiAssessments.length,
      highlightsCount: result.highlights.length,
      topN: rows.length,
    },
    summaries: {
      badgeDistribution: countBy(badges),
      cityDistribution: cityDist,
      venueDistribution: venueDist,
      sourceDistribution: sourceDist,
      slotDistribution: countBy(slots),
      withoutBadge: rows.filter((r) => !r.editorialBadge).length,
      passageRare: rows.filter((r) => r.editorialBadge === "Passage rare").length,
      aReserver: rows.filter((r) => r.editorialBadge === "À réserver").length,
      aAnticiper: rows.filter((r) => r.editorialBadge === "À anticiper").length,
      pepiteLocale: rows.filter((r) => r.editorialBadge === "Pépite locale")
        .length,
    },
    highlights: result.highlights.map((h) => ({
      title: h.event.title,
      slot: h.slot,
      city: h.event.city,
      badge: resolveEditorialBadge({
        planningNeed: h.aiSelection?.planningNeed,
        localRarity: h.aiSelection?.localRarity,
        missRisk: h.aiSelection?.missRisk,
        confidence: h.aiSelection?.confidence,
        reasons: h.aiSelection?.aiReasons,
        hasRegistrationUrl: Boolean(h.event.registrationUrl),
      }),
    })),
    anomalies,
    rows,
  };

  writeFileSync(
    "scripts/audit-detour-editorial.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ meta: report.meta, summaries: report.summaries, anomaliesCount: anomalies.length }, null, 2));
  console.error(`Wrote scripts/audit-detour-editorial.json (${rows.length} rows)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
