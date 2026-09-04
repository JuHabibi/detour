"use client";

import { useMemo, useState } from "react";
import type { EventItem, EventRelevance } from "@/data/types";

const DEBUG_LIMIT = 100;

const RELEVANCE_FILTERS: Array<{ id: "all" | EventRelevance; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "culture", label: "culture" },
  { id: "culture_leisure", label: "culture_leisure" },
  { id: "uncertain", label: "uncertain" },
  { id: "out_of_scope", label: "out_of_scope" },
];

export type EventDuplicateDebug = {
  keptTitle: string;
  duplicateTitle: string;
  date: string;
  venue: string | null;
  city: string | null;
  reason: string;
};

export type EventsDebugMeta = {
  rawCount: number;
  dedupedCount: number;
  duplicateCount: number;
  duplicates: EventDuplicateDebug[];
};

type EventsDebugPanelProps = {
  events: EventItem[];
  meta?: EventsDebugMeta;
};

/** Panneau temporaire pour inspecter la qualité des données Orléans. */
export function EventsDebugPanel({ events, meta }: EventsDebugPanelProps) {
  const [open, setOpen] = useState(false);
  const [relevanceFilter, setRelevanceFilter] = useState<"all" | EventRelevance>(
    "all",
  );

  const relevanceCounts = useMemo(() => {
    const counts: Record<EventRelevance, number> = {
      culture: 0,
      culture_leisure: 0,
      uncertain: 0,
      out_of_scope: 0,
    };

    for (const event of events) {
      const key = event.relevance ?? "uncertain";
      counts[key] += 1;
    }

    return counts;
  }, [events]);

  const filtered = useMemo(() => {
    if (relevanceFilter === "all") return events;
    return events.filter(
      (event) => (event.relevance ?? "uncertain") === relevanceFilter,
    );
  }, [events, relevanceFilter]);

  const sample = useMemo(() => filtered.slice(0, DEBUG_LIMIT), [filtered]);

  const stats = useMemo(() => {
    let withImage = 0;
    let withRegistration = 0;
    let withConditions = 0;
    let withCity = 0;
    let withVenue = 0;

    for (const event of sample) {
      if (event.image) withImage += 1;
      if (event.registrationUrl) withRegistration += 1;
      if (event.conditions) withConditions += 1;
      if (event.city) withCity += 1;
      if (event.venue) withVenue += 1;
    }

    return {
      shown: sample.length,
      filtered: filtered.length,
      total: events.length,
      withImage,
      withRegistration,
      withConditions,
      withCity,
      withVenue,
    };
  }, [events.length, filtered.length, sample]);

  return (
    <section className="border-t border-dashed border-line bg-foam/40 px-5 py-8 md:px-8 lg:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-sand">
              Temporaire
            </p>
            <h2 className="mt-1 font-display text-xl tracking-tight">
              Debug données Orléans
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-full border border-line bg-paper px-4 py-2 text-sm text-ink transition-colors hover:border-ink/25"
          >
            {open ? "Masquer" : `Inspecter (${stats.total})`}
          </button>
        </div>

        {open ? (
          <div className="mt-6 space-y-5">
            <p className="text-sm text-cream-dim">
              Affiche jusqu’à {DEBUG_LIMIT} événements après classification et
              déduplication conservatrice — pour vérification manuelle.
            </p>

            {meta ? (
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Stat label="Brut chargé" value={meta.rawCount} />
                <Stat label="Après dédup" value={meta.dedupedCount} />
                <Stat label="Doublons détectés" value={meta.duplicateCount} />
              </dl>
            ) : null}

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
              <Stat label="culture" value={relevanceCounts.culture} />
              <Stat
                label="culture_leisure"
                value={relevanceCounts.culture_leisure}
              />
              <Stat label="uncertain" value={relevanceCounts.uncertain} />
              <Stat label="out_of_scope" value={relevanceCounts.out_of_scope} />
            </dl>

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
              <Stat
                label="Affichés"
                value={`${stats.shown} / ${stats.filtered}`}
              />
              <Stat label="Liste courante" value={stats.total} />
              <Stat label="Avec image" value={stats.withImage} />
              <Stat label="Avec réservation" value={stats.withRegistration} />
              <Stat label="Avec conditions" value={stats.withConditions} />
              <Stat label="Avec ville" value={stats.withCity} />
            </dl>

            <div className="flex flex-wrap gap-2">
              {RELEVANCE_FILTERS.map((item) => {
                const active = relevanceFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRelevanceFilter(item.id)}
                    className={
                      active
                        ? "rounded-full bg-ink px-3 py-1.5 text-xs text-paper"
                        : "rounded-full border border-line bg-paper px-3 py-1.5 text-xs text-ink hover:border-ink/25"
                    }
                  >
                    {item.label}
                    {item.id !== "all" ? (
                      <span className="ml-1 opacity-70">
                        {relevanceCounts[item.id]}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {meta && meta.duplicates.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-display text-lg tracking-tight">
                  Doublons détectés
                </h3>
                <div className="overflow-x-auto rounded-xl border border-line bg-paper">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-line bg-foam/60 text-[10px] uppercase tracking-[0.14em] text-sand">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Conservé</th>
                        <th className="px-3 py-2.5 font-medium">Doublon</th>
                        <th className="px-3 py-2.5 font-medium">Date</th>
                        <th className="px-3 py-2.5 font-medium">Lieu</th>
                        <th className="px-3 py-2.5 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meta.duplicates.map((duplicate, index) => (
                        <tr
                          key={`${duplicate.keptTitle}-${duplicate.duplicateTitle}-${index}`}
                          className="border-b border-line/70 align-top last:border-b-0"
                        >
                          <td className="max-w-[14rem] px-3 py-2.5 font-medium text-ink">
                            {duplicate.keptTitle}
                          </td>
                          <td className="max-w-[14rem] px-3 py-2.5 text-cream-dim">
                            {duplicate.duplicateTitle}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-cream-dim">
                            {formatDebugDate(duplicate.date)}
                          </td>
                          <td className="max-w-[12rem] px-3 py-2.5 text-cream-dim">
                            {[duplicate.venue, duplicate.city]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[10px] text-cream-dim">
                            {duplicate.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-line bg-paper">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-line bg-foam/60 text-[10px] uppercase tracking-[0.14em] text-sand">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Pertinence</th>
                    <th className="px-3 py-2.5 font-medium">Reason</th>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Titre</th>
                    <th className="px-3 py-2.5 font-medium">Catégorie brute</th>
                    <th className="px-3 py-2.5 font-medium">Ville</th>
                    <th className="px-3 py-2.5 font-medium">Lieu</th>
                    <th className="px-3 py-2.5 font-medium">Image</th>
                    <th className="px-3 py-2.5 font-medium">Résa</th>
                    <th className="px-3 py-2.5 font-medium">Source</th>
                    <th className="px-3 py-2.5 font-medium">Conditions</th>
                  </tr>
                </thead>
                <tbody>
                  {sample.map((event) => (
                    <tr
                      key={event.id}
                      className="border-b border-line/70 align-top last:border-b-0"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <RelevanceBadge
                          relevance={event.relevance ?? "uncertain"}
                        />
                      </td>
                      <td className="max-w-[14rem] px-3 py-2.5 font-mono text-[10px] text-cream-dim">
                        {event.relevanceReason ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-cream-dim">
                        <div>{event.dateLabel}</div>
                        {event.time ? <div>{event.time}</div> : null}
                      </td>
                      <td className="max-w-[16rem] px-3 py-2.5 font-medium text-ink">
                        {event.sourceUrl || event.registrationUrl ? (
                          <a
                            href={event.registrationUrl ?? event.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-line underline-offset-2 hover:decoration-ink"
                          >
                            {event.title}
                          </a>
                        ) : (
                          event.title
                        )}
                      </td>
                      <td className="max-w-[10rem] px-3 py-2.5 text-cream-dim">
                        {event.genre || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-cream-dim">
                        {event.city || "—"}
                      </td>
                      <td className="max-w-[12rem] px-3 py-2.5 text-cream-dim">
                        {event.venue || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Flag ok={Boolean(event.image)} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Flag ok={Boolean(event.registrationUrl)} />
                      </td>
                      <td className="max-w-[12rem] px-3 py-2.5 text-cream-dim">
                        {event.source || "—"}
                        {event.sourceUrl ? (
                          <div className="mt-1 truncate text-[10px] text-sand">
                            OpenAgenda
                          </div>
                        ) : null}
                      </td>
                      <td className="max-w-[14rem] px-3 py-2.5 text-cream-dim">
                        {event.conditions || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function formatDebugDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-2.5">
      <dt className="text-[10px] uppercase tracking-[0.14em] text-sand">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}

function Flag({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        ok
          ? "rounded-full bg-mint/30 px-2 py-0.5 text-[10px] font-medium text-ink"
          : "rounded-full bg-line/60 px-2 py-0.5 text-[10px] text-sand"
      }
    >
      {ok ? "oui" : "non"}
    </span>
  );
}

function RelevanceBadge({ relevance }: { relevance: EventRelevance }) {
  const styles: Record<EventRelevance, string> = {
    culture: "bg-mint/35 text-ink",
    culture_leisure: "bg-sky/25 text-ink",
    uncertain: "bg-sun/30 text-ink",
    out_of_scope: "bg-line text-sand",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[relevance]}`}
    >
      {relevance}
    </span>
  );
}
