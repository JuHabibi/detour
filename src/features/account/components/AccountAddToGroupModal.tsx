"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addFavoritesToGroup,
  createGroupWithFavorites,
  type BulkGroupMutationResult,
} from "@/app/actions/groups";
import type { GroupSummary } from "@/application/groups";

type AccountAddToGroupModalProps = {
  eventIds: string[];
  /** Titre affiché (ex. nom d’un event ou « 3 favoris »). */
  heading: string;
  groups: GroupSummary[];
  onClose: () => void;
  onGroupsChange?: (groups: GroupSummary[]) => void;
  /** Appelé après un ajout réussi (bulk : sortie mode sélection). */
  onSuccess?: () => void;
};

function formatBulkStatus(result: Extract<BulkGroupMutationResult, { ok: true }>): string {
  const { addedCount, alreadyMemberCount, missingCount } = result;
  if (addedCount === 0 && alreadyMemberCount > 0 && missingCount === 0) {
    return alreadyMemberCount === 1
      ? "Déjà dans ce groupe."
      : `Déjà dans ce groupe (${alreadyMemberCount}).`;
  }
  const parts: string[] = [];
  if (addedCount > 0) {
    parts.push(
      addedCount === 1
        ? "1 ajouté"
        : `${addedCount} ajoutés`,
    );
  }
  if (alreadyMemberCount > 0) {
    parts.push(
      alreadyMemberCount === 1
        ? "1 déjà présent"
        : `${alreadyMemberCount} déjà présents`,
    );
  }
  if (missingCount > 0) {
    parts.push(
      missingCount === 1
        ? "1 introuvable"
        : `${missingCount} introuvables`,
    );
  }
  return parts.length > 0 ? `${parts.join(" · ")}.` : "Aucun changement.";
}

export function AccountAddToGroupModal({
  eventIds,
  heading,
  groups,
  onClose,
  onGroupsChange,
  onSuccess,
}: AccountAddToGroupModalProps) {
  const router = useRouter();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [newName, setNewName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  function handleResult(
    result: BulkGroupMutationResult,
    options?: { created?: boolean; groupId?: string },
  ) {
    if (!result.ok) {
      setError(
        result.reason === "not_found" || result.reason === "event_not_found"
          ? "Impossible d’ajouter à ce groupe."
          : result.reason === "invalid"
            ? "Sélection invalide."
            : "Impossible d’ajouter. Réessayez.",
      );
      return;
    }

    if (result.group) {
      onGroupsChange?.([
        {
          ...result.group,
          eventCount: result.addedCount,
          earliestStartAt: null,
          latestStartAt: null,
        },
        ...groups,
      ]);
    } else if (options?.groupId && result.addedCount > 0) {
      onGroupsChange?.(
        groups.map((group) =>
          group.id === options.groupId
            ? {
                ...group,
                eventCount: group.eventCount + result.addedCount,
              }
            : group,
        ),
      );
    }

    const prefix = options?.created ? "Groupe créé · " : "";
    setStatus(`${prefix}${formatBulkStatus(result)}`);
    onSuccess?.();
    router.refresh();
  }

  function handlePick(groupId: string) {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const result = await addFavoritesToGroup(groupId, eventIds);
      handleResult(result, { groupId });
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Indiquez un nom de groupe.");
      return;
    }

    startTransition(async () => {
      const result = await createGroupWithFavorites(trimmed, eventIds);
      if (result.ok) setNewName("");
      handleResult(result, { created: true });
    });
  }

  const countLabel =
    eventIds.length === 1
      ? "1 favori"
      : `${eventIds.length} favoris`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] flex max-h-[min(90vh,36rem)] w-full max-w-md flex-col border border-line bg-foam px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pb-6 sm:pt-6"
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sand">
            Ajouter à un groupe
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre"
            className="flex size-9 shrink-0 items-center justify-center text-sand transition-colors hover:text-ink"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        <h2
          id={titleId}
          className="mt-3 font-display text-[1.4rem] font-semibold leading-[1.08] tracking-tight text-ink"
        >
          {heading}
        </h2>
        <p className="mt-1 text-[12px] uppercase tracking-[0.12em] text-sand">
          {countLabel}
        </p>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
          {groups.length === 0 ? (
            <p className="text-sm leading-6 text-cream-dim">
              Aucun groupe pour l’instant. Créez-en un ci-dessous.
            </p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {groups.map((group) => (
                <li key={group.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handlePick(group.id)}
                    className="flex w-full items-center justify-between gap-3 py-3.5 text-left transition-colors hover:text-coral disabled:opacity-60"
                  >
                    <span className="min-w-0 truncate font-display text-[1.05rem] text-ink">
                      {group.name}
                    </span>
                    <span className="shrink-0 text-[12px] uppercase tracking-[0.1em] text-sand">
                      Choisir
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={handleCreate} className="mt-5 border-t border-line pt-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
            Créer un groupe
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nom"
              maxLength={80}
              className="min-w-0 flex-1 border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-sand focus:border-ink"
            />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center bg-mint px-4 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam disabled:opacity-60"
            >
              Créer
            </button>
          </div>
        </form>

        {status ? (
          <p className="mt-4 text-sm text-sand" role="status" aria-live="polite">
            {status}{" "}
            <Link href="/account" className="underline underline-offset-4">
              Voir Mes groupes
            </Link>
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm text-coral" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
