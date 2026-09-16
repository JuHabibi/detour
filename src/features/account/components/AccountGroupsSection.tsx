"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGroup } from "@/app/actions/groups";
import type { GroupSummary } from "@/application/groups";
import {
  formatGroupDateRange,
  groupEventCountLabel,
} from "@/features/account/group-display";

type AccountGroupsSectionProps = {
  groups: GroupSummary[];
  onGroupsChange: (groups: GroupSummary[]) => void;
};

export function AccountGroupsSection({
  groups,
  onGroupsChange,
}: AccountGroupsSectionProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Indiquez un nom de groupe.");
      return;
    }

    startTransition(async () => {
      const result = await createGroup(trimmed);
      if (!result.ok) {
        setError(
          result.reason === "invalid"
            ? "Indiquez un nom de groupe."
            : "Impossible de créer ce groupe. Réessayez.",
        );
        return;
      }
      setName("");
      if (result.group) {
        onGroupsChange([
          {
            ...result.group,
            eventCount: 0,
            earliestStartAt: null,
            latestStartAt: null,
          },
          ...groups,
        ]);
      }
      router.refresh();
    });
  }

  return (
    <section className="mt-12 md:mt-16">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-3">
        <h2 className="font-display text-[1.35rem] tracking-tight text-ink md:text-[1.5rem]">
          Mes groupes
        </h2>
        <p className="text-[12px] uppercase tracking-[0.12em] text-sand">
          {groups.length === 0
            ? "Aucun groupe"
            : `${groups.length} groupe${groups.length > 1 ? "s" : ""}`}
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Nom du groupe</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du groupe"
            maxLength={80}
            className="w-full border border-line bg-foam px-3 py-2.5 text-sm text-ink outline-none placeholder:text-sand focus:border-ink"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 shrink-0 items-center justify-center bg-mint px-5 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam disabled:opacity-60"
        >
          {pending ? "Création…" : "Créer un groupe"}
        </button>
      </form>

      {error ? (
        <p className="mt-3 text-sm text-coral" role="alert">
          {error}
        </p>
      ) : null}

      {groups.length === 0 ? (
        <p className="mt-6 text-sm leading-6 text-cream-dim">
          Regroupez des favoris pour un week-end, un séjour, une thématique…
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-t border-line">
          {groups.map((group) => {
            const range = formatGroupDateRange(group);
            return (
              <li
                key={group.id}
                className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="min-w-0">
                  <p className="font-display text-[1.2rem] tracking-tight text-ink">
                    {group.name}
                  </p>
                  <p className="mt-1 text-[13px] text-sand">
                    {groupEventCountLabel(group.eventCount)}
                    {range ? ` · ${range}` : ""}
                  </p>
                </div>
                <Link
                  href={`/account/groups/${group.id}`}
                  className="text-[12px] font-medium uppercase tracking-[0.1em] text-ink underline decoration-mint/70 decoration-2 underline-offset-4 transition-colors hover:decoration-coral"
                >
                  Voir le groupe
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
