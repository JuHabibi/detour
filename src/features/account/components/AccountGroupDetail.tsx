"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteGroup,
  removeEventFromGroup,
  renameGroup,
} from "@/app/actions/groups";
import type { EventItem } from "@/data/types";
import { eventCalendarPath } from "@/domain/calendar/build-event-calendar";
import { AccountGroupEventCard } from "@/features/account/components/AccountGroupEventCard";
import {
  nextSelectedIds,
  selectAllIds,
  selectAllToggleLabel,
  shouldShowBulkBar,
} from "@/features/account/group-selection";
import { takeServerListIfChanged } from "@/features/account/take-server-list-if-changed";
import { cn } from "@/lib/cn";

type AccountGroupDetailProps = {
  groupId: string;
  initialName: string;
  initialEvents: EventItem[];
};

export function AccountGroupDetail({
  groupId,
  initialName,
  initialEvents,
}: AccountGroupDetailProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [draftName, setDraftName] = useState(initialName);
  const [events, setEvents] = useState(initialEvents);
  const [eventsPropSnapshot, setEventsPropSnapshot] = useState(initialEvents);
  const serverEvents = takeServerListIfChanged(
    initialEvents,
    eventsPropSnapshot,
  );
  if (serverEvents) {
    setEventsPropSnapshot(serverEvents);
    setEvents(serverEvents);
  }

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [renaming, setRenaming] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsId = useId();
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!settingsRef.current?.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSettingsOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [settingsOpen]);

  const countLabel =
    events.length === 0
      ? "Aucun événement"
      : `${events.length} événement${events.length > 1 ? "s" : ""}`;

  const selectedCount = selectedIds.size;
  const allSelected =
    events.length > 0 && selectedCount === events.length;
  const selectAllLabel = selectAllToggleLabel(selectedCount, events.length);
  const showBulkBar = shouldShowBulkBar(selectionMode, selectedCount);

  const selectedList = useMemo(
    () => events.filter((event) => selectedIds.has(event.id)),
    [events, selectedIds],
  );

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function enterSelectionMode() {
    setSelectionMode(true);
    setSelectedIds(new Set());
    setNotice(null);
    setRenaming(false);
    setSettingsOpen(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => nextSelectedIds(current, id));
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(selectAllIds(events.map((event) => event.id)));
  }

  function handleRename(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const trimmed = draftName.trim();
    if (!trimmed) {
      setError("Indiquez un nom de groupe.");
      return;
    }
    if (trimmed === name) {
      setRenaming(false);
      return;
    }

    startTransition(async () => {
      const result = await renameGroup(groupId, trimmed);
      if (!result.ok) {
        setError(
          result.reason === "not_found"
            ? "Ce groupe est introuvable."
            : result.reason === "invalid"
              ? "Indiquez un nom de groupe."
              : "Impossible de renommer. Réessayez.",
        );
        return;
      }
      setName(result.group?.name ?? trimmed);
      setDraftName(result.group?.name ?? trimmed);
      setRenaming(false);
      setNotice("Nom mis à jour.");
      router.refresh();
    });
  }

  function handleDelete() {
    setError(null);
    setNotice(null);
    setSettingsOpen(false);
    const confirmed = window.confirm(
      `Supprimer le groupe « ${name} » ? Les événements ne seront pas effacés.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteGroup(groupId);
      if (!result.ok) {
        setError(
          result.reason === "not_found"
            ? "Ce groupe est introuvable."
            : "Impossible de supprimer. Réessayez.",
        );
        return;
      }
      router.push("/account");
      router.refresh();
    });
  }

  function handleRemoveEvent(eventId: string) {
    setError(null);
    setNotice(null);
    const previous = events;
    setEvents((current) => current.filter((item) => item.id !== eventId));
    setSelectedIds((current) => {
      if (!current.has(eventId)) return current;
      const next = new Set(current);
      next.delete(eventId);
      return next;
    });

    startTransition(async () => {
      const result = await removeEventFromGroup(groupId, eventId);
      if (result.ok) {
        router.refresh();
        return;
      }
      setEvents(previous);
      setError(
        result.reason === "not_found"
          ? "Impossible de retirer cet événement."
          : "Impossible de retirer cet événement. Réessayez.",
      );
    });
  }

  function handleBulkRemove() {
    if (selectedList.length === 0) return;
    setError(null);
    setNotice(null);
    const ids = selectedList.map((event) => event.id);
    const previous = events;
    setEvents((current) => current.filter((item) => !ids.includes(item.id)));
    exitSelectionMode();

    startTransition(async () => {
      const results = await Promise.all(
        ids.map((id) => removeEventFromGroup(groupId, id)),
      );
      if (results.every((result) => result.ok)) {
        router.refresh();
        return;
      }
      setEvents(previous);
      setError("Impossible de retirer certains événements. Réessayez.");
    });
  }

  /** Téléchargements ICS unitaires (DET-19) — en attendant un export groupe. */
  function handleBulkAgenda() {
    if (selectedList.length === 0) return;
    for (const event of selectedList) {
      const link = document.createElement("a");
      link.href = eventCalendarPath(event.id);
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    setNotice(
      selectedList.length === 1
        ? "Fichier agenda téléchargé."
        : `${selectedList.length} fichiers agenda téléchargés.`,
    );
  }

  return (
    <div className={showBulkBar ? "pb-24" : undefined}>
      <Link
        href="/account"
        className="text-[11px] font-medium uppercase tracking-[0.14em] text-sand transition-colors hover:text-ink"
      >
        ← Mon compte
      </Link>

      <header className="mt-6 md:mt-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
              Groupe
            </p>
            <h1 className="mt-2 font-display text-[2rem] leading-[1.02] tracking-tight text-ink md:text-[2.4rem]">
              {name}
            </h1>
            <p className="mt-2 text-[12px] uppercase tracking-[0.12em] text-sand">
              {countLabel}
            </p>
          </div>

          <div className="relative shrink-0" ref={settingsRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={settingsOpen}
              aria-controls={settingsId}
              onClick={() => setSettingsOpen((open) => !open)}
              disabled={pending}
              className="flex size-8 items-center justify-center text-sand transition-colors hover:text-ink disabled:opacity-60"
              aria-label="Options du groupe"
            >
              <span aria-hidden className="text-base leading-none tracking-widest">
                ···
              </span>
            </button>
            {settingsOpen ? (
              <div
                id={settingsId}
                role="menu"
                className="absolute right-0 z-20 mt-1 min-w-[11rem] border border-line bg-foam py-1 shadow-sm"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-paper"
                  onClick={() => {
                    setSettingsOpen(false);
                    setDraftName(name);
                    setRenaming(true);
                  }}
                >
                  Renommer
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-sand transition-colors hover:bg-paper hover:text-coral"
                  onClick={handleDelete}
                >
                  Supprimer
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {renaming ? (
          <form
            onSubmit={handleRename}
            className="mt-5 flex max-w-md flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={80}
              autoFocus
              aria-label="Nouveau nom du groupe"
              className="min-w-0 flex-1 border-b border-line bg-transparent px-0 py-1.5 text-sm text-ink outline-none focus:border-ink"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink underline decoration-line underline-offset-4 disabled:opacity-60"
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftName(name);
                  setRenaming(false);
                }}
                className="text-[11px] font-medium uppercase tracking-[0.1em] text-sand transition-colors hover:text-ink"
              >
                Annuler
              </button>
            </div>
          </form>
        ) : null}
      </header>

      {error ? (
        <p className="mt-4 text-sm text-coral" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-4 text-sm text-sand" role="status" aria-live="polite">
          {notice}
        </p>
      ) : null}

      {events.length === 0 ? (
        <p className="mt-12 text-sm leading-6 text-cream-dim">
          Ce groupe est vide. Ajoutez des favoris depuis Mon compte.
        </p>
      ) : (
        <div className="mt-10">
          <div
            className={cn(
              "mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-2",
              selectionMode && "justify-between",
            )}
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <button
                  type="button"
                  onClick={() =>
                    selectionMode ? exitSelectionMode() : enterSelectionMode()
                  }
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-sand underline decoration-line underline-offset-4 transition-colors hover:text-ink"
                >
                  {!selectionMode ? (
                    <span
                      aria-hidden
                      className="inline-block size-[11px] border border-current opacity-70"
                    />
                  ) : null}
                  {selectionMode ? "Annuler" : "Choisir plusieurs événements"}
                </button>
                {selectionMode ? (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-[11px] font-medium uppercase tracking-[0.12em] text-sand/80 transition-colors hover:text-ink"
                  >
                    {selectAllLabel}
                  </button>
                ) : null}
              </div>
              {!selectionMode ? (
                <p className="max-w-sm text-[12px] leading-5 text-sand/70">
                  Ajoutez plusieurs événements à l’agenda ou retirez-les du
                  groupe.
                </p>
              ) : null}
            </div>
            {selectionMode ? (
              <span
                className="text-[11px] tracking-[0.06em] text-sand/70"
                aria-live="polite"
              >
                {selectedCount === 0
                  ? "Aucun sélectionné"
                  : `${selectedCount} sélectionné${selectedCount > 1 ? "s" : ""}`}
              </span>
            ) : null}
          </div>

          {/*
            Largeur grille plafonnée (~3×380px + gaps) pour éviter des cards
            trop larges dans le shell 1440px+.
          */}
          <div className="mx-auto w-full max-w-[72rem]">
            <div className="grid grid-cols-1 justify-items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {events.map((event) => (
                <AccountGroupEventCard
                  key={event.id}
                  event={event}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(event.id)}
                  onToggleSelect={toggleSelect}
                  onRemove={handleRemoveEvent}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {showBulkBar ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <div className="pointer-events-auto flex max-h-14 w-full max-w-sm flex-col justify-center gap-1.5 border border-line bg-foam/95 px-3 py-2 shadow-sm backdrop-blur-sm sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-2">
            <p className="text-[11px] tracking-[0.08em] text-sand sm:shrink-0">
              {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
            </p>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <button
                type="button"
                onClick={handleBulkAgenda}
                disabled={pending}
                className="inline-flex h-8 items-center justify-center bg-mint px-3 text-[11px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam disabled:opacity-60"
              >
                Ajouter à mon agenda
              </button>
              <button
                type="button"
                onClick={handleBulkRemove}
                disabled={pending}
                className="inline-flex h-8 items-center justify-center px-3 text-[11px] font-medium uppercase tracking-[0.1em] text-sand transition-colors hover:text-coral disabled:opacity-60"
              >
                Retirer du groupe
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
