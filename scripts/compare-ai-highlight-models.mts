/**
 * Benchmark contrôlé de 3 modèles IA sur un corpus figé.
 *
 * Prérequis :
 *   npx tsx --env-file=.env.local scripts/freeze-ai-highlight-corpus.mts
 *
 * Lancer :
 *   npx tsx --env-file=.env.local scripts/compare-ai-highlight-models.mts
 *
 * IDs API (surchargeables) :
 *   DETOUR_BENCH_MODEL_MINI=gpt-4o-mini
 *   DETOUR_BENCH_MODEL_TERRA=gpt-5.6-terra
 *   DETOUR_BENCH_MODEL_SOL=gpt-5.6-sol
 *
 * Aucun fetch source. Aucune modification runtime/prod.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
  AI_HIGHLIGHT_BATCH_SIZE,
  parseAiHighlightAssessments,
  type AiHighlightAssessment,
} from "../src/domain/ai-highlight-assessment";
import type { DetourEvent } from "../src/domain/events/event";
import {
  hasExplicitLocalRarityReason,
  resolveEditorialBadge,
} from "../src/domain/editorial/resolve-editorial-badge";
import {
  AI_DETOUR_DEFAULT_LIMIT,
  selectAiDetourHighlights,
} from "../src/domain/editorial/select-ai-detour-highlights";
import type { EventHighlight } from "../src/domain/editorial/select-detour-highlights";
import { OPENAI_HIGHLIGHT_SYSTEM_PROMPT } from "../src/infrastructure/ai/openai-highlight-assessment.provider";
import type { AiHighlightCorpus } from "./freeze-ai-highlight-corpus.mts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = join(__dirname, "fixtures", "ai-highlight-corpus.json");
const PRICING_PATH = join(__dirname, "compare-ai-highlight-models.pricing.json");
const OUT_DIR = join(__dirname, "out");
const TEMPERATURE_MINI = 0.2;

type BenchModel = {
  label: "gpt-4o-mini" | "terra" | "sol";
  modelId: string;
};

type ModelPricingUsdPer1M = {
  input: number;
  output: number;
  cachedInput?: number;
  note?: string;
};

/** Paramètres API effectivement envoyés (hors messages / model). */
type ModelRequestParams = {
  temperature: number | "default";
};

/**
 * GPT-5.6 Terra/Sol rejettent temperature=0.2 (HTTP 400) — omettre le champ.
 * gpt-4o-mini conserve 0.2.
 */
function resolveRequestParams(model: BenchModel): ModelRequestParams {
  if (model.label === "terra" || model.label === "sol") {
    return { temperature: "default" };
  }
  return { temperature: TEMPERATURE_MINI };
}

function buildChatCompletionBody(
  model: BenchModel,
  eventsSlice: unknown[],
): Record<string, unknown> {
  const params = resolveRequestParams(model);
  const body: Record<string, unknown> = {
    model: model.modelId,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: OPENAI_HIGHLIGHT_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({ events: eventsSlice }),
      },
    ],
  };
  if (params.temperature !== "default") {
    body.temperature = params.temperature;
  }
  return body;
}

function loadPricing(): Record<string, ModelPricingUsdPer1M> {
  const raw = JSON.parse(readFileSync(PRICING_PATH, "utf8")) as Record<
    string,
    unknown
  >;
  const out: Record<string, ModelPricingUsdPer1M> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("_")) continue;
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    out[key] = {
      input: Number(row.input) || 0,
      output: Number(row.output) || 0,
      cachedInput:
        row.cachedInput == null ? undefined : Number(row.cachedInput),
      note: typeof row.note === "string" ? row.note : undefined,
    };
  }
  return out;
}

function estimateCostUsd(
  pricingTable: Record<string, ModelPricingUsdPer1M>,
  params: {
    modelId: string;
    promptTokens: number;
    completionTokens: number;
    cachedPromptTokens?: number;
  },
): {
  usd: number | null;
  missingPricing: boolean;
} {
  const pricing = pricingTable[params.modelId];
  if (!pricing) return { usd: null, missingPricing: true };
  const cached = Math.min(
    params.cachedPromptTokens ?? 0,
    params.promptTokens,
  );
  const uncached = Math.max(0, params.promptTokens - cached);
  const cachedRate = pricing.cachedInput ?? pricing.input;
  const usd =
    (uncached * pricing.input) / 1_000_000 +
    (cached * cachedRate) / 1_000_000 +
    (params.completionTokens * pricing.output) / 1_000_000;
  return { usd, missingPricing: false };
}

type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedPromptTokens: number;
};

type BatchMetric = {
  batchIndex: number;
  eventCount: number;
  latencyMs: number;
  usage: TokenUsage;
  error?: string;
  /** Détail HTTP brut (sans secrets) — uniquement si réponse non-ok. */
  httpError?: {
    status: number;
    statusText: string;
    responseBody: string;
    modelId: string;
    batchIndex: number;
  };
};

type ModelRunResult = {
  label: BenchModel["label"];
  modelId: string;
  ok: boolean;
  error?: string;
  assessments: AiHighlightAssessment[];
  batches: BatchMetric[];
  apiCalls: number;
  latencyTotalMs: number;
  usage: TokenUsage;
  estimatedCostUsd: number | null;
  missingPricing: boolean;
};

type EditorialDiagnostic = {
  type: string;
  eventId: string;
  title: string;
  modelLabel: string;
  detail: string;
};

function resolveModels(): BenchModel[] {
  return [
    {
      label: "gpt-4o-mini",
      modelId:
        process.env.DETOUR_BENCH_MODEL_MINI?.trim() || "gpt-4o-mini",
    },
    {
      label: "terra",
      modelId:
        process.env.DETOUR_BENCH_MODEL_TERRA?.trim() || "gpt-5.6-terra",
    },
    {
      label: "sol",
      modelId: process.env.DETOUR_BENCH_MODEL_SOL?.trim() || "gpt-5.6-sol",
    },
  ];
}

function emptyUsage(): TokenUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cachedPromptTokens: 0,
  };
}

function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    cachedPromptTokens: a.cachedPromptTokens + b.cachedPromptTokens,
  };
}

function parseUsage(raw: unknown): TokenUsage {
  if (!raw || typeof raw !== "object") return emptyUsage();
  const u = raw as Record<string, unknown>;
  const promptTokens = Number(u.prompt_tokens ?? u.input_tokens ?? 0) || 0;
  const completionTokens =
    Number(u.completion_tokens ?? u.output_tokens ?? 0) || 0;
  const totalTokens =
    Number(u.total_tokens ?? promptTokens + completionTokens) || 0;
  const details =
    (u.prompt_tokens_details as Record<string, unknown> | undefined) ??
    (u.input_tokens_details as Record<string, unknown> | undefined);
  const cachedPromptTokens =
    Number(details?.cached_tokens ?? u.cached_tokens ?? 0) || 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    cachedPromptTokens,
  };
}

async function assessModel(params: {
  model: BenchModel;
  corpus: AiHighlightCorpus;
  apiKey: string;
  baseUrl: string;
  pricingTable: Record<string, ModelPricingUsdPer1M>;
}): Promise<ModelRunResult> {
  const { model, corpus, apiKey, baseUrl, pricingTable } = params;
  const batches: BatchMetric[] = [];
  const assessments: AiHighlightAssessment[] = [];
  let usage = emptyUsage();
  const started = performance.now();

  try {
    for (
      let index = 0;
      index < corpus.providerInputs.length;
      index += AI_HIGHLIGHT_BATCH_SIZE
    ) {
      const batchIndex = Math.floor(index / AI_HIGHLIGHT_BATCH_SIZE);
      const slice = corpus.providerInputs.slice(
        index,
        index + AI_HIGHLIGHT_BATCH_SIZE,
      );
      const expectedIds = slice.map((item) => item.eventId);
      const batchStart = performance.now();

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildChatCompletionBody(model, slice)),
        });

        const latencyMs =
          Math.round((performance.now() - batchStart) * 10) / 10;
        const responseBody = await response.text().catch(() => "");

        if (!response.ok) {
          const httpError = {
            status: response.status,
            statusText: response.statusText,
            responseBody,
            modelId: model.modelId,
            batchIndex,
          };
          let openaiMessage = responseBody;
          try {
            const errJson = JSON.parse(responseBody) as {
              error?: { message?: string };
            };
            if (errJson?.error?.message) {
              openaiMessage = errJson.error.message;
            }
          } catch {
            // body non-JSON : on garde le texte brut
          }
          console.error(
            `[bench] ${model.modelId} HTTP ${response.status}: ${openaiMessage}`,
          );
          batches.push({
            batchIndex,
            eventCount: slice.length,
            latencyMs,
            usage: emptyUsage(),
            error: `HTTP ${response.status} ${response.statusText}\n${responseBody}`,
            httpError,
          });
          throw new Error(
            `${model.modelId} batch ${batchIndex} failed: HTTP ${response.status} ${response.statusText}\n${responseBody}`,
          );
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(responseBody) as Record<string, unknown>;
        } catch {
          throw new Error(
            `${model.modelId} batch ${batchIndex} failed: invalid JSON response body`,
          );
        }

        const batchUsage = parseUsage(payload.usage);
        usage = addUsage(usage, batchUsage);

        const content = (
          payload.choices as
            | Array<{ message?: { content?: string } }>
            | undefined
        )?.[0]?.message?.content;
        if (!content) {
          throw new Error(`empty content batch ${batchIndex}`);
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          throw new Error(`invalid JSON batch ${batchIndex}`);
        }

        const batchAssessments = parseAiHighlightAssessments(
          parsed,
          expectedIds,
        );
        assessments.push(...batchAssessments);
        batches.push({
          batchIndex,
          eventCount: slice.length,
          latencyMs,
          usage: batchUsage,
        });
      } catch (error) {
        const latencyMs =
          Math.round((performance.now() - batchStart) * 10) / 10;
        const message = error instanceof Error ? error.message : String(error);
        if (!batches.some((b) => b.batchIndex === batchIndex && b.error)) {
          batches.push({
            batchIndex,
            eventCount: slice.length,
            latencyMs,
            usage: emptyUsage(),
            error: message,
          });
        }
        throw error;
      }
    }

    const cost = estimateCostUsd(pricingTable, {
      modelId: model.modelId,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      cachedPromptTokens: usage.cachedPromptTokens,
    });

    return {
      label: model.label,
      modelId: model.modelId,
      ok: true,
      assessments,
      batches,
      apiCalls: batches.length,
      latencyTotalMs: Math.round((performance.now() - started) * 10) / 10,
      usage,
      estimatedCostUsd: cost.usd,
      missingPricing: cost.missingPricing,
    };
  } catch (error) {
    const cost = estimateCostUsd(pricingTable, {
      modelId: model.modelId,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      cachedPromptTokens: usage.cachedPromptTokens,
    });
    return {
      label: model.label,
      modelId: model.modelId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      assessments,
      batches,
      apiCalls: batches.length,
      latencyTotalMs: Math.round((performance.now() - started) * 10) / 10,
      usage,
      estimatedCostUsd: cost.usd,
      missingPricing: cost.missingPricing,
    };
  }
}

function toCandidates(events: DetourEvent[]): EventHighlight[] {
  return events.map((event) => ({
    event,
    score: 0,
    planningScore: 0,
    reasons: [],
  }));
}

function normalizeReason(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectDiagnostics(
  modelLabel: string,
  events: DetourEvent[],
  assessments: AiHighlightAssessment[],
): EditorialDiagnostic[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  const out: EditorialDiagnostic[] = [];

  for (const a of assessments) {
    const event = byId.get(a.eventId);
    const title = event?.title ?? a.eventId;
    const reasons = a.reasons ?? [];
    const joined = reasons.join(" | ");
    const normalizedJoined = normalizeReason(joined);

    if (a.localRarity >= 3 && !hasExplicitLocalRarityReason(reasons)) {
      out.push({
        type: "localRarity-sans-justification-locale",
        eventId: a.eventId,
        title,
        modelLabel,
        detail: `localRarity=${a.localRarity} reasons=${joined || "∅"}`,
      });
    }

    if (
      a.localRarity >= 3 &&
      /format (?:rare|original|peu courant|atypique)|peu courant|original/.test(
        normalizedJoined,
      ) &&
      !hasExplicitLocalRarityReason(reasons)
    ) {
      out.push({
        type: "localRarity-format-seulement",
        eventId: a.eventId,
        title,
        modelLabel,
        detail: joined,
      });
    }

    const planningCue =
      /reserv|billett|anticip|avance|jauge|inscription|complet|places limite/.test(
        normalizedJoined,
      );
    if (
      a.planningNeed >= 3 &&
      !event?.registrationUrl &&
      !planningCue
    ) {
      out.push({
        type: "planningNeed-sans-contrainte",
        eventId: a.eventId,
        title,
        modelLabel,
        detail: `planningNeed=${a.planningNeed} hasRegistrationUrl=${Boolean(event?.registrationUrl)}`,
      });
    }

    const demandCue =
      /reconnu|connu|notoriete|populaire|tete d affiche|affiche|forte demande|attirer/.test(
        normalizedJoined,
      );
    if (a.likelyDemand >= 4 && !demandCue) {
      out.push({
        type: "likelyDemand-sans-signal-clair",
        eventId: a.eventId,
        title,
        modelLabel,
        detail: `likelyDemand=${a.likelyDemand} reasons=${joined || "∅"}`,
      });
    }

    if (
      a.confidence >= 0.85 &&
      (reasons.length === 0 ||
        reasons.every((r) => normalizeReason(r).split(" ").length <= 4))
    ) {
      out.push({
        type: "confidence-haute-reasons-vagues",
        eventId: a.eventId,
        title,
        modelLabel,
        detail: `confidence=${a.confidence} reasons=${joined || "∅"}`,
      });
    }

    if (
      /incontournable|a ne pas manquer|must[- ]see|exceptionnel\b|immanquable/.test(
        normalizedJoined,
      )
    ) {
      out.push({
        type: "raison-marketing",
        eventId: a.eventId,
        title,
        modelLabel,
        detail: joined,
      });
    }

    if (
      /presque complet|derniers? places|complet|jauge de \d+|vendu|sold out|places restantes|\d+\s*reservations/.test(
        normalizedJoined,
      )
    ) {
      out.push({
        type: "hallucination-potentielle-disponibilite",
        eventId: a.eventId,
        title,
        modelLabel,
        detail: joined,
      });
    }
  }

  return out;
}

function meanAbsDelta(
  baseline: AiHighlightAssessment[],
  other: AiHighlightAssessment[],
  key: keyof Pick<
    AiHighlightAssessment,
    "appeal" | "missRisk" | "planningNeed" | "localRarity" | "likelyDemand" | "confidence"
  >,
): number | null {
  const baseById = new Map(baseline.map((a) => [a.eventId, a]));
  const deltas: number[] = [];
  for (const a of other) {
    const b = baseById.get(a.eventId);
    if (!b) continue;
    deltas.push(Math.abs(Number(a[key]) - Number(b[key])));
  }
  if (deltas.length === 0) return null;
  return (
    Math.round((deltas.reduce((s, n) => s + n, 0) / deltas.length) * 1000) /
    1000
  );
}

function top10Summary(
  label: string,
  candidates: EventHighlight[],
  assessments: AiHighlightAssessment[],
) {
  const selected = selectAiDetourHighlights(candidates, assessments, {
    limit: AI_DETOUR_DEFAULT_LIMIT,
  });
  return {
    label,
    ids: selected.map((item) => item.event.id),
    titles: selected.map((item) => item.event.title),
    slots: selected.map((item) => item.slot ?? null),
    badges: selected.map((item) =>
      resolveEditorialBadge({
        planningNeed: item.aiSelection?.planningNeed,
        localRarity: item.aiSelection?.localRarity,
        missRisk: item.aiSelection?.missRisk,
        confidence: item.aiSelection?.confidence,
        reasons: item.aiSelection?.aiReasons,
        hasRegistrationUrl: Boolean(item.event.registrationUrl),
      }),
    ),
  };
}

function overlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((id) => setB.has(id)).length;
}

async function main() {
  if (!existsSync(CORPUS_PATH)) {
    console.error(
      `Corpus manquant: ${CORPUS_PATH}\nLance d’abord: npx tsx --env-file=.env.local scripts/freeze-ai-highlight-corpus.mts`,
    );
    process.exit(1);
  }

  const apiKey =
    process.env.DETOUR_AI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error("Clé API manquante (DETOUR_AI_API_KEY ou OPENAI_API_KEY).");
    process.exit(1);
  }

  const baseUrl = (
    process.env.DETOUR_AI_BASE_URL?.trim() || "https://api.openai.com/v1"
  ).replace(/\/$/, "");

  const corpus = JSON.parse(
    readFileSync(CORPUS_PATH, "utf8"),
  ) as AiHighlightCorpus;
  const pricingTable = loadPricing();
  const models = resolveModels();
  const candidates = toCandidates(corpus.events);

  console.error(
    `Corpus ${corpus.meta.shortlistSize} events (frozen ${corpus.meta.frozenAt})`,
  );
  console.error(
    `Models: ${models.map((m) => `${m.label}=${m.modelId}`).join(" | ")}`,
  );

  const runs: ModelRunResult[] = [];
  for (const model of models) {
    console.error(`→ Running ${model.label} (${model.modelId})…`);
    const run = await assessModel({
      model,
      corpus,
      apiKey,
      baseUrl,
      pricingTable,
    });
    runs.push(run);
    console.error(
      `  ${run.ok ? "ok" : "FAIL"} · ${run.latencyTotalMs} ms · tokens ${run.usage.totalTokens} · assessments ${run.assessments.length}`,
    );
  }

  const baseline = runs.find((r) => r.label === "gpt-4o-mini");
  const perEvent = corpus.events.map((event) => {
    const row: Record<string, unknown> = {
      eventId: event.id,
      title: event.title,
      city: event.city,
      venue: event.venue,
      hasRegistrationUrl: Boolean(event.registrationUrl),
    };
    for (const run of runs) {
      const a = run.assessments.find((item) => item.eventId === event.id);
      row[run.label] = a
        ? {
            appeal: a.appeal,
            missRisk: a.missRisk,
            planningNeed: a.planningNeed,
            localRarity: a.localRarity,
            likelyDemand: a.likelyDemand,
            confidence: a.confidence,
            reasons: a.reasons,
          }
        : null;
      if (baseline?.ok && a && baseline.assessments.length) {
        const b = baseline.assessments.find((item) => item.eventId === event.id);
        if (b) {
          row[`delta_vs_mini_${run.label}`] = {
            appeal: a.appeal - b.appeal,
            missRisk: a.missRisk - b.missRisk,
            planningNeed: a.planningNeed - b.planningNeed,
            localRarity: a.localRarity - b.localRarity,
            likelyDemand: a.likelyDemand - b.likelyDemand,
            confidence:
              Math.round((a.confidence - b.confidence) * 1000) / 1000,
          };
        }
      }
    }
    return row;
  });

  const top10 = runs
    .filter((run) => run.ok && run.assessments.length > 0)
    .map((run) => top10Summary(run.label, candidates, run.assessments));

  const miniTop = top10.find((t) => t.label === "gpt-4o-mini");
  const top10Comparison = {
    lists: top10,
    overlapVsMini: Object.fromEntries(
      top10
        .filter((t) => t.label !== "gpt-4o-mini")
        .map((t) => [
          t.label,
          {
            overlap: miniTop ? overlap(miniTop.ids, t.ids) : null,
            entered: miniTop
              ? t.ids.filter((id) => !miniTop.ids.includes(id))
              : [],
            exited: miniTop
              ? miniTop.ids.filter((id) => !t.ids.includes(id))
              : [],
            orderChanged: Boolean(
              miniTop &&
                JSON.stringify(
                  miniTop.ids.filter((id) => t.ids.includes(id)),
                ) !==
                  JSON.stringify(
                    t.ids.filter((id) => miniTop.ids.includes(id)),
                  ),
            ),
          },
        ]),
    ),
  };

  const diagnostics = runs.flatMap((run) =>
    run.ok
      ? collectDiagnostics(run.label, corpus.events, run.assessments)
      : [],
  );

  const diagnosticsByModel = Object.fromEntries(
    runs.map((run) => {
      const items = diagnostics.filter((d) => d.modelLabel === run.label);
      const byType: Record<string, number> = {};
      for (const item of items) {
        byType[item.type] = (byType[item.type] ?? 0) + 1;
      }
      const assessed = Math.max(run.assessments.length, 1);
      return [
        run.label,
        {
          total: items.length,
          rate: Math.round((items.length / assessed) * 1000) / 1000,
          potentialHallucinations: items.filter((d) =>
            d.type.startsWith("hallucination"),
          ).length,
          byType,
        },
      ];
    }),
  );

  const meanDeltasVsMini = Object.fromEntries(
    runs
      .filter((run) => run.label !== "gpt-4o-mini" && run.ok && baseline?.ok)
      .map((run) => [
        run.label,
        {
          appeal: meanAbsDelta(baseline!.assessments, run.assessments, "appeal"),
          missRisk: meanAbsDelta(
            baseline!.assessments,
            run.assessments,
            "missRisk",
          ),
          planningNeed: meanAbsDelta(
            baseline!.assessments,
            run.assessments,
            "planningNeed",
          ),
          localRarity: meanAbsDelta(
            baseline!.assessments,
            run.assessments,
            "localRarity",
          ),
          likelyDemand: meanAbsDelta(
            baseline!.assessments,
            run.assessments,
            "likelyDemand",
          ),
          confidence: meanAbsDelta(
            baseline!.assessments,
            run.assessments,
            "confidence",
          ),
        },
      ]),
  );

  const selectionDiffVsMini = Object.fromEntries(
    top10
      .filter((t) => t.label !== "gpt-4o-mini")
      .map((t) => {
        const overlapCount = miniTop ? overlap(miniTop.ids, t.ids) : 0;
        return [
          t.label,
          {
            overlap: overlapCount,
            differences: miniTop ? 10 - overlapCount : null,
          },
        ];
      }),
  );

  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      corpusPath: CORPUS_PATH,
      corpusFrozenAt: corpus.meta.frozenAt,
      shortlistSize: corpus.meta.shortlistSize,
      batchSize: AI_HIGHLIGHT_BATCH_SIZE,
      requestParamsByModel: Object.fromEntries(
        models.map((m) => [m.modelId, resolveRequestParams(m)]),
      ),
      temperatureCompatibilityNote:
        "Temperature diffère uniquement pour compatibilité API : GPT-5.6 Terra/Sol n'acceptent pas 0.2.",
      systemPromptShared: true,
      models: models.map((m) => ({
        label: m.label,
        modelId: m.modelId,
        requestParams: resolveRequestParams(m),
      })),
      pricingTable,
      note: "Benchmark offline corpus — runtime/prod non modifié.",
    },
    runs: runs.map((run) => ({
      label: run.label,
      modelId: run.modelId,
      ok: run.ok,
      error: run.error,
      apiCalls: run.apiCalls,
      latencyTotalMs: run.latencyTotalMs,
      batches: run.batches,
      usage: run.usage,
      estimatedCostUsd: run.estimatedCostUsd,
      missingPricing: run.missingPricing,
      assessmentsCount: run.assessments.length,
    })),
    perEvent,
    assessmentsByModel: Object.fromEntries(
      runs.map((run) => [run.label, run.assessments]),
    ),
    top10: top10Comparison,
    diagnostics: {
      items: diagnostics,
      byModel: diagnosticsByModel,
    },
    comparison: {
      meanAbsDeltaVsMini: meanDeltasVsMini,
      selectionDiffVsMini,
      costUsd: Object.fromEntries(
        runs.map((run) => [run.label, run.estimatedCostUsd]),
      ),
      latencyMs: Object.fromEntries(
        runs.map((run) => [run.label, run.latencyTotalMs]),
      ),
      suspectRate: Object.fromEntries(
        Object.entries(diagnosticsByModel).map(([label, stats]) => [
          label,
          (stats as { rate: number }).rate,
        ]),
      ),
      potentialHallucinations: Object.fromEntries(
        Object.entries(diagnosticsByModel).map(([label, stats]) => [
          label,
          (stats as { potentialHallucinations: number }).potentialHallucinations,
        ]),
      ),
    },
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(OUT_DIR, `compare-ai-highlight-models-${stamp}.json`);
  const latestPath = join(OUT_DIR, "compare-ai-highlight-models-latest.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  writeFileSync(latestPath, JSON.stringify(report, null, 2));

  console.log(
    JSON.stringify(
      {
        wrote: outPath,
        latest: latestPath,
        models: report.meta.models,
        runs: report.runs.map((r) => ({
          label: r.label,
          modelId: r.modelId,
          ok: r.ok,
          error: r.error,
          latencyTotalMs: r.latencyTotalMs,
          usage: r.usage,
          estimatedCostUsd: r.estimatedCostUsd,
          assessmentsCount: r.assessmentsCount,
        })),
        top10Ids: Object.fromEntries(top10.map((t) => [t.label, t.ids])),
        comparison: report.comparison,
        diagnosticsByModel,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
