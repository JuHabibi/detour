"use client";

import { useCallback, useState, useTransition } from "react";
import { addFavorite } from "@/app/actions/favorites";
import type { EventDetailSurface } from "@/components/event/EventDetailModal";
import { useRemoveFavorite } from "@/components/favorites/useRemoveFavorite";
import type { EventItem } from "@/data/types";

type PersonalOps = {
  favorites: ReadonlySet<string>;
  addFavoriteLocally: (eventId: string) => void;
  rollbackFavoriteAdd: (eventId: string) => void;
  removeFavoriteLocally: (eventId: string) => void;
};

type UseEventPersonalActionsParams = PersonalOps & {
  userId: string | null;
  isSessionPending: boolean;
  /** Chemin de retour post-auth (ex. `/` ou `/explorer`). */
  returnPath: string;
};

/**
 * Interactions favoris / carnets / détail partagées Home ↔ Explorer.
 * Une page = un `usePersonalData` + ce hook — pas de provider.
 */
export function useEventPersonalActions({
  userId,
  isSessionPending,
  returnPath,
  favorites,
  addFavoriteLocally,
  rollbackFavoriteAdd,
  removeFavoriteLocally,
}: UseEventPersonalActionsParams) {
  const isAuthenticated = Boolean(userId);
  const [organizeEvent, setOrganizeEvent] = useState<EventItem | null>(null);
  const [organizeTrigger, setOrganizeTrigger] = useState<HTMLElement | null>(
    null,
  );
  const [authFavoriteEventId, setAuthFavoriteEventId] = useState<string | null>(
    null,
  );
  const [authFavoriteTrigger, setAuthFavoriteTrigger] =
    useState<HTMLElement | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [detail, setDetail] = useState<{
    event: EventItem;
    surface: EventDetailSurface;
    trigger: HTMLElement | null;
  } | null>(null);

  function openFavoriteAuth(eventId: string) {
    setAuthFavoriteTrigger(
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    );
    setAuthFavoriteEventId(eventId);
  }

  const {
    requestRemove,
    confirmation: removeConfirmation,
    error: removeError,
    clearError: clearRemoveError,
  } = useRemoveFavorite({
    onRemoved: removeFavoriteLocally,
    onUnauthenticated: openFavoriteAuth,
  });

  const openEventDetail = useCallback(
    (
      event: EventItem,
      surface: EventDetailSurface,
      trigger: HTMLElement,
    ) => {
      setDetail({ event, surface, trigger });
    },
    [],
  );

  const closeEventDetail = useCallback(() => {
    setDetail(null);
  }, []);

  function closeFavoriteAuth() {
    setAuthFavoriteEventId(null);
    setAuthFavoriteTrigger(null);
  }

  function toggleFavorite(id: string) {
    setFavoriteError(null);
    clearRemoveError();

    if (isSessionPending) return;
    if (!isAuthenticated || !userId) {
      openFavoriteAuth(id);
      return;
    }

    if (favorites.has(id)) {
      requestRemove(id);
      return;
    }

    addFavoriteLocally(id);

    startTransition(async () => {
      try {
        const result = await addFavorite(id);

        if (result.ok) return;

        rollbackFavoriteAdd(id);

        if (result.reason === "unauthenticated") {
          openFavoriteAuth(id);
          return;
        }
        setFavoriteError("Impossible d’enregistrer ce détour. Réessayez.");
      } catch (error) {
        console.error("[detour] toggleFavorite failed", error);
        rollbackFavoriteAdd(id);
        setFavoriteError("Impossible d’enregistrer ce détour. Réessayez.");
      }
    });
  }

  function handleOrganizeCarnets(event: EventItem) {
    if (isSessionPending) return;
    if (!isAuthenticated || !userId) {
      openFavoriteAuth(event.id);
      return;
    }
    setOrganizeTrigger(
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    );
    setOrganizeEvent(event);
  }

  function closeOrganizeModal() {
    setOrganizeEvent(null);
    setOrganizeTrigger(null);
  }

  const handlePendingFavoriteSaved = useCallback(
    (eventId: string) => {
      addFavoriteLocally(eventId);
    },
    [addFavoriteLocally],
  );

  function clearErrors() {
    setFavoriteError(null);
    clearRemoveError();
  }

  return {
    returnPath,
    isAuthenticated,
    toggleFavorite,
    handleOrganizeCarnets,
    organizeEvent,
    organizeTrigger,
    closeOrganizeModal,
    authFavoriteEventId,
    authFavoriteTrigger,
    closeFavoriteAuth,
    favoriteError,
    removeError,
    clearErrors,
    removeConfirmation,
    handlePendingFavoriteSaved,
    detail,
    openEventDetail,
    closeEventDetail,
  };
}
