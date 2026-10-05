"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listMyFavoriteEvents } from "@/app/actions/favorites";
import type { ListMyFavoriteEventsResult } from "@/app/actions/favorites";
import { getMyCarnetEvents } from "@/app/actions/groups";
import type { GetMyCarnetEventsResult } from "@/app/actions/groups";
import type { GroupSummary } from "@/application/groups";
import {
  usePersonalData,
  type CarnetsSnapshot,
} from "@/components/personal/usePersonalData";
import type { EventItem } from "@/data/types";
import type { FriseView } from "@/features/frise/frise-url-state";
import { authClient } from "@/lib/auth-client";

const EMPTY_FAVORITES: ReadonlySet<string> = new Set();
const EMPTY_EVENTS: EventItem[] = [];

type UseFrisePersonalDataParams = {
  view: FriseView;
  notebookId: string | null;
  /** Après hydratation carnets (succès) — corrections sélection/URL côté page. */
  onGroupsLoaded?: (groups: GroupSummary[]) => void;
  /** Carnet sélectionné introuvable — correction sélection/URL côté page. */
  onNotebookMissing?: () => void;
  listFavoriteEvents?: () => Promise<ListMyFavoriteEventsResult>;
  getCarnetEvents?: (groupId: string) => Promise<GetMyCarnetEventsResult>;
};

type LoadHandlers = {
  /** false → ne plus toucher l’état (requête obsolète). */
  isCurrent: () => boolean;
  onLoading: (loading: boolean) => void;
};

/**
 * Compteur de génération local. Chaque famille de requêtes en possède un
 * pour qu’elles ne s’invalident pas entre elles.
 */
export function createRequestGate() {
  let generation = 0;
  return {
    begin() {
      const id = ++generation;
      return { isCurrent: () => id === generation };
    },
    invalidate() {
      generation += 1;
    },
  };
}

export async function runFavoriteEventsLoad(
  load: () => Promise<ListMyFavoriteEventsResult>,
  handlers: LoadHandlers & {
    onSuccess: (events: EventItem[]) => void;
    onError: (message: string) => void;
  },
): Promise<void> {
  const { isCurrent, onLoading, onSuccess, onError } = handlers;
  if (!isCurrent()) return;

  onLoading(true);

  try {
    const result = await load();
    if (!isCurrent()) return;
    if (!result.ok) {
      onError("Impossible de charger vos favoris.");
      return;
    }
    onSuccess(result.events);
  } catch {
    if (!isCurrent()) return;
    onError("Impossible de charger vos favoris.");
  } finally {
    if (isCurrent()) onLoading(false);
  }
}

export type CarnetEventsLoadFailure = {
  message: string;
  missing: boolean;
};

/** Transformation locale utilisée par `removeEventLocally`. */
export function removeEventFromPersonalCorpora(
  id: string,
  corpora: {
    ids: ReadonlySet<string>;
    favoriteEvents: EventItem[];
    notebookEvents: EventItem[];
  },
): {
  ids: Set<string>;
  favoriteEvents: EventItem[];
  notebookEvents: EventItem[];
} {
  const ids = new Set(corpora.ids);
  ids.delete(id);
  return {
    ids,
    favoriteEvents: corpora.favoriteEvents.filter((event) => event.id !== id),
    notebookEvents: corpora.notebookEvents.filter((event) => event.id !== id),
  };
}

export async function runCarnetEventsLoad(
  notebookId: string,
  load: (groupId: string) => Promise<GetMyCarnetEventsResult>,
  handlers: LoadHandlers & {
    onSuccess: (data: { events: EventItem[]; name: string }) => void;
    onError: (failure: CarnetEventsLoadFailure) => void;
  },
): Promise<void> {
  const { isCurrent, onLoading, onSuccess, onError } = handlers;
  if (!isCurrent()) return;

  onLoading(true);

  try {
    const result = await load(notebookId);
    if (!isCurrent()) return;
    if (!result.ok) {
      onError({
        message:
          result.reason === "not_found"
            ? "Ce carnet est introuvable."
            : "Impossible de charger ce carnet.",
        missing: result.reason === "not_found",
      });
      return;
    }
    onSuccess({ events: result.events, name: result.group.name });
  } catch {
    if (!isCurrent()) return;
    onError({
      message: "Impossible de charger ce carnet.",
      missing: false,
    });
  } finally {
    if (isCurrent()) onLoading(false);
  }
}

/**
 * Orchestration frise : contenu favoris, contenu carnet sélectionné,
 * erreurs/loading associés. IDs favoris + état carnets via `usePersonalData`.
 */
export function useFrisePersonalData({
  view,
  notebookId,
  onGroupsLoaded,
  onNotebookMissing,
  listFavoriteEvents = listMyFavoriteEvents,
  getCarnetEvents = getMyCarnetEvents,
}: UseFrisePersonalDataParams) {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const userId = session?.user?.id ?? null;

  const onGroupsLoadedRef = useRef(onGroupsLoaded);
  const onNotebookMissingRef = useRef(onNotebookMissing);

  useEffect(() => {
    onGroupsLoadedRef.current = onGroupsLoaded;
    onNotebookMissingRef.current = onNotebookMissing;
  }, [onGroupsLoaded, onNotebookMissing]);

  const handleCarnetsLoaded = useCallback((snapshot: CarnetsSnapshot) => {
    onGroupsLoadedRef.current?.(snapshot.groups);
  }, []);

  const {
    favorites,
    groups,
    carnetsLoading,
    addFavoriteLocally,
    rollbackFavoriteAdd,
    removeFavoriteLocally,
    setFavoriteIdsAuthoritative,
  } = usePersonalData({
    userId,
    isSessionPending,
    loadCarnets: view === "notebook",
    onCarnetsLoaded: handleCarnetsLoaded,
  });

  const [favoriteEvents, setFavoriteEvents] = useState<EventItem[]>([]);
  const [favoriteEventsLoading, setFavoriteEventsLoading] = useState(false);
  const [favoriteEventsError, setFavoriteEventsError] = useState<string | null>(
    null,
  );

  const [notebookEvents, setNotebookEvents] = useState<EventItem[]>([]);
  const [notebookLoading, setNotebookLoading] = useState(false);
  const [notebookError, setNotebookError] = useState<string | null>(null);
  const [notebookName, setNotebookName] = useState<string | null>(null);

  const favoriteEventsGateRef = useRef(createRequestGate());
  const carnetEventsGateRef = useRef(createRequestGate());

  const removeEventLocally = useCallback(
    (id: string) => {
      removeFavoriteLocally(id);
      setFavoriteEvents((current) =>
        removeEventFromPersonalCorpora(id, {
          ids: EMPTY_FAVORITES,
          favoriteEvents: current,
          notebookEvents: EMPTY_EVENTS,
        }).favoriteEvents,
      );
      setNotebookEvents((current) =>
        removeEventFromPersonalCorpora(id, {
          ids: EMPTY_FAVORITES,
          favoriteEvents: EMPTY_EVENTS,
          notebookEvents: current,
        }).notebookEvents,
      );
    },
    [removeFavoriteLocally],
  );

  useEffect(() => {
    const requestGate = favoriteEventsGateRef.current;

    if (view !== "favorites") {
      requestGate.invalidate();
      return;
    }

    const gate = requestGate.begin();
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setFavoriteEventsError(null);
      void runFavoriteEventsLoad(listFavoriteEvents, {
        isCurrent: gate.isCurrent,
        onLoading: setFavoriteEventsLoading,
        onSuccess: (events) => {
          setFavoriteEvents(events);
          setFavoriteEventsError(null);
          setFavoriteIdsAuthoritative(events.map((item) => item.id));
        },
        onError: (message) => {
          setFavoriteEvents([]);
          setFavoriteEventsError(message);
        },
      });
    });

    return () => {
      cancelled = true;
      requestGate.invalidate();
    };
  }, [view, listFavoriteEvents, setFavoriteIdsAuthoritative]);

  useEffect(() => {
    const requestGate = carnetEventsGateRef.current;

    if (view !== "notebook" || !notebookId) {
      requestGate.invalidate();
      return;
    }

    const gate = requestGate.begin();
    const requestedId = notebookId;
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setNotebookError(null);
      void runCarnetEventsLoad(requestedId, getCarnetEvents, {
        isCurrent: gate.isCurrent,
        onLoading: setNotebookLoading,
        onSuccess: (data) => {
          setNotebookEvents(data.events);
          setNotebookName(data.name);
          setNotebookError(null);
        },
        onError: (failure) => {
          setNotebookEvents([]);
          setNotebookName(null);
          setNotebookError(failure.message);
          if (failure.missing) {
            onNotebookMissingRef.current?.();
          }
        },
      });
    });

    return () => {
      cancelled = true;
      requestGate.invalidate();
    };
  }, [view, notebookId, getCarnetEvents]);

  const notebookActive = view === "notebook" && Boolean(notebookId);

  return {
    favoriteIds: favorites,
    favoriteEvents: view === "favorites" ? favoriteEvents : EMPTY_EVENTS,
    favoriteEventsLoading: view === "favorites" && favoriteEventsLoading,
    favoriteEventsError: view === "favorites" ? favoriteEventsError : null,
    groups: view === "notebook" ? groups : [],
    groupsLoading: view === "notebook" && carnetsLoading,
    notebookEvents: notebookActive ? notebookEvents : EMPTY_EVENTS,
    notebookLoading: notebookActive && notebookLoading,
    notebookError: notebookActive ? notebookError : null,
    notebookName: notebookActive ? notebookName : null,
    addFavoriteLocally,
    rollbackFavoriteAdd,
    setFavoriteIds: setFavoriteIdsAuthoritative,
    removeEventLocally,
  };
}
