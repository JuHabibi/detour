"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteGroup } from "@/app/actions/groups";
import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";
import { MAX_GROUPS_PER_USER } from "@/application/groups/limits";
import { groupCalendarPath } from "@/domain/calendar/build-event-calendar";
import { AccountCarnetCover } from "@/features/account/components/AccountCarnetCover";
import { AccountCarnetFormModal } from "@/features/account/components/AccountCarnetFormModal";
import {
  dropGroupMemberships,
  renameMemberships,
} from "@/features/account/groups/membership-index";

type AccountCarnetsLibraryProps = {
  groups: GroupSummary[];
  memberships: EventGroupMembership[];
  activeGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  onGroupsChange: (groups: GroupSummary[]) => void;
  onMembershipsChange: (memberships: EventGroupMembership[]) => void;
};

type FormModal =
  | { kind: "create" }
  | { kind: "rename"; group: GroupSummary };

export function AccountCarnetsLibrary({
  groups,
  memberships,
  activeGroupId,
  onSelectGroup,
  onGroupsChange,
  onMembershipsChange,
}: AccountCarnetsLibraryProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [formModal, setFormModal] = useState<FormModal | null>(null);
  const [pending, startTransition] = useTransition();

  const atLimit = groups.length >= MAX_GROUPS_PER_USER;
  /** Legacy > 4 : on conserve toutes les couvertures ; sinon max 4. */
  const visibleGroups = groups;

  function handleDelete(groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setError(null);
    const confirmed = window.confirm(
      `Supprimer le carnet « ${group.name} » ? Les favoris ne seront pas effacés.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteGroup(groupId);
      if (!result.ok) {
        setError(
          result.reason === "not_found"
            ? "Ce carnet est introuvable."
            : "Impossible de supprimer. Réessayez.",
        );
        return;
      }
      onGroupsChange(groups.filter((g) => g.id !== groupId));
      onMembershipsChange(dropGroupMemberships(memberships, groupId));
      router.refresh();
    });
  }

  function handleExport(groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    if (group.eventCount === 0) {
      setError("Ce carnet est vide — rien à exporter.");
      return;
    }
    setError(null);
    window.location.assign(groupCalendarPath(groupId));
  }

  function startRename(groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setError(null);
    setFormModal({ kind: "rename", group });
  }

  return (
    <section className="mt-10 md:mt-12">
      <div className="flex flex-wrap items-center justify-end gap-4">
        {groups.length > 0 ? (
          <p className="mr-auto text-[12px] uppercase tracking-[0.12em] text-sand">
            {groups.length} carnet{groups.length > 1 ? "s" : ""}
            {atLimit ? " · limite atteinte" : ""}
          </p>
        ) : null}
        {atLimit ? (
          <p className="text-[12px] text-sand">
            Vous avez atteint la limite de 4 carnets.
          </p>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              setFormModal({ kind: "create" });
            }}
            className="inline-flex min-h-10 items-center justify-center border border-ink px-4 text-[11px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam disabled:opacity-60"
          >
            + Créer un carnet
          </button>
        )}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-coral" role="alert">
          {error}
        </p>
      ) : null}

      {groups.length === 0 ? (
        <p className="mt-6 text-sm leading-6 text-cream-dim">
          Créez un premier carnet pour ranger un week-end, un séjour, une
          thématique…
        </p>
      ) : (
        <>
          <div className="mt-8 flex gap-5 overflow-x-auto px-2 pb-6 pt-3 snap-x snap-mandatory scrollbar-none md:hidden">
            {visibleGroups.map((group, index) => (
              <AccountCarnetCover
                key={group.id}
                group={group}
                toneIndex={index}
                active={activeGroupId === group.id}
                onSelect={onSelectGroup}
                onRename={startRename}
                onDelete={handleDelete}
                onExport={handleExport}
              />
            ))}
          </div>

          <div className="mt-10 hidden grid-cols-2 gap-x-6 gap-y-10 px-3 pb-4 pt-2 md:grid lg:grid-cols-4 lg:gap-x-8">
            {visibleGroups.map((group, index) => (
              <AccountCarnetCover
                key={group.id}
                group={group}
                toneIndex={index}
                active={activeGroupId === group.id}
                onSelect={onSelectGroup}
                onRename={startRename}
                onDelete={handleDelete}
                onExport={handleExport}
              />
            ))}
          </div>

          {groups.length > 0 ? (
            <div className="mt-8 border-t border-ink/15" />
          ) : null}
        </>
      )}

      {formModal ? (
        <AccountCarnetFormModal
          mode={
            formModal.kind === "create"
              ? { kind: "create" }
              : { kind: "rename", group: formModal.group }
          }
          onClose={() => setFormModal(null)}
          onCreated={(group) => onGroupsChange([group, ...groups])}
          onRenamed={(groupId, name) => {
            onGroupsChange(
              groups.map((g) => (g.id === groupId ? { ...g, name } : g)),
            );
            onMembershipsChange(renameMemberships(memberships, groupId, name));
          }}
        />
      ) : null}
    </section>
  );
}
