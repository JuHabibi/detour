"use client";

import { useRef, useState } from "react";
import { removeFavorite } from "@/app/actions/favorites";
import { RemoveFavoriteConfirmModal } from "@/components/favorites/RemoveFavoriteConfirmModal";

type RemoveTarget = {
  eventId: string;
  returnFocusTo: HTMLElement | null;
};

/**
 * Un seul parcours pour les quatre surfaces : le serveur décide si le retrait
 * exige une confirmation, puis effectue la suppression transactionnelle.
 */
export function useRemoveFavorite({
  onRemoved,
  onUnauthenticated,
  fallbackFocusSelector,
}: {
  onRemoved: (eventId: string) => void;
  onUnauthenticated?: (eventId: string) => void;
  fallbackFocusSelector?: string;
}) {
  const [target, setTarget] = useState<RemoveTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  async function execute(
    current: RemoveTarget,
    confirmed: boolean,
  ): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);

    try {
      const result = await removeFavorite(current.eventId, confirmed);
      if (result.ok) {
        setTarget(null);
        onRemoved(current.eventId);
        return;
      }
      if (result.reason === "confirmation_required") {
        setTarget(current);
        return;
      }

      setTarget(null);
      if (result.reason === "unauthenticated" && onUnauthenticated) {
        onUnauthenticated(current.eventId);
        return;
      }
      setError("Impossible de retirer ce favori. Réessayez.");
    } catch (cause) {
      console.error("[detour:favorites] removeFavorite failed", cause);
      setTarget(null);
      setError("Impossible de retirer ce favori. Réessayez.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function requestRemove(eventId: string): void {
    const returnFocusTo =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    void execute({ eventId, returnFocusTo }, false);
  }

  const confirmation = target ? (
    <RemoveFavoriteConfirmModal
      onCancel={() => {
        if (!inFlight.current) setTarget(null);
      }}
      onConfirm={() => void execute(target, true)}
      returnFocusTo={target.returnFocusTo}
      fallbackFocusSelector={fallbackFocusSelector}
      pending={pending}
    />
  ) : null;

  return {
    requestRemove,
    confirmation,
    error,
    clearError: () => setError(null),
    pending,
  };
}
