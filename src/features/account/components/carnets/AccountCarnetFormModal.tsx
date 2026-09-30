"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGroup, renameGroup } from "@/app/actions/groups";
import type { GroupSummary } from "@/application/groups";
import { AppModal } from "@/components/ui/AppModal";

type CreateMode = { kind: "create" };
type RenameMode = { kind: "rename"; group: GroupSummary };

export type AccountCarnetFormModalProps = {
  mode: CreateMode | RenameMode;
  onClose: () => void;
  onCreated?: (group: GroupSummary) => void;
  onRenamed?: (groupId: string, name: string) => void;
};

export function AccountCarnetFormModal({
  mode,
  onClose,
  onCreated,
  onRenamed,
}: AccountCarnetFormModalProps) {
  const router = useRouter();
  const nameId = useId();
  const [name, setName] = useState(
    mode.kind === "rename" ? mode.group.name : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isRename = mode.kind === "rename";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Indiquez un nom de carnet.");
      return;
    }

    if (isRename) {
      if (trimmed === mode.group.name) {
        onClose();
        return;
      }
      startTransition(async () => {
        const result = await renameGroup(mode.group.id, trimmed);
        if (!result.ok) {
          setError(
            result.reason === "not_found"
              ? "Ce carnet est introuvable."
              : result.reason === "invalid"
                ? "Indiquez un nom de carnet."
                : "Impossible de renommer. Réessayez.",
          );
          return;
        }
        const nextName = result.group?.name ?? trimmed;
        onRenamed?.(mode.group.id, nextName);
        router.refresh();
        onClose();
      });
      return;
    }

    startTransition(async () => {
      const result = await createGroup(trimmed);
      if (!result.ok) {
        setError(
          result.reason === "limit_reached"
            ? "Vous avez atteint la limite de 4 carnets."
            : result.reason === "invalid"
              ? "Indiquez un nom de carnet."
              : "Impossible de créer ce carnet. Réessayez.",
        );
        return;
      }
      if (result.group) {
        onCreated?.({
          ...result.group,
          eventCount: 0,
          earliestStartAt: null,
          latestStartAt: null,
        });
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <AppModal
      eyebrow="Mes carnets"
      title={
        isRename
          ? "Renommer ce carnet."
          : "Créer une nouvelle collection."
      }
      description={
        isRename
          ? "Le nouveau nom apparaîtra sur la couverture et dans vos filtres."
          : "Donnez-lui une intention. Elle pourra accueillir vos prochaines découvertes."
      }
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center border border-line bg-foam px-4 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="carnet-form"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center bg-ink px-5 text-[12px] font-medium uppercase tracking-[0.1em] text-foam transition-colors hover:bg-coral disabled:opacity-60"
          >
            {pending
              ? isRename
                ? "Enregistrement…"
                : "Création…"
              : isRename
                ? "Enregistrer"
                : "Créer le carnet"}
          </button>
        </>
      }
    >
      <form id="carnet-form" onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
            Nom du carnet
          </span>
          <input
            id={nameId}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Escapade à Nantes"
            maxLength={80}
            autoFocus
            className="mt-2 w-full border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-sand focus:border-ink"
          />
        </label>
        {error ? (
          <p className="text-sm text-coral" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </AppModal>
  );
}
