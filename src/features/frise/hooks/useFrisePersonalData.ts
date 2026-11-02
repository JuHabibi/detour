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
import { verifiedAuthUserId } from "@/lib/auth-session";

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

/**
 * Ne conserve un corpus carnet que s’il appartient encore au carnet sélectionné.
 * Évite d’afficher les événements de A après un échec de chargement de B.
 */
export function retainNotebookCorpusForSelection<TEvent>(params: {
  selectedNotebookId: string;
  corpusNotebookId: string | null;
  events: readonly TEvent[];
  name: string | null;
}): {
  corpusNotebookId: string | null;
  events: TEvent[];
  name: string | null;
} {
  if (params.corpusNotebookId === params.selectedNotebookId) {
    return {
      corpusNotebookId: params.corpusNotebookId,
      events: [...params.events],
      name: params.name,
    };
  }
  return { corpusNotebookId: null, events: [], name: null };
}

/** Corpus détaillé exposable seulement pour le compte propriétaire courant. */
export function isFriseCorpusOwnedBySession(params: {
  userId: string | null;
  isSessionPending: boolean;
  corpusOwnerUserId: string | null;
}): boolean {
  return (
    !params.isSessionPending &&
    Boolean(params.userId) &&
    params.userId === params.corpusOwnerUserId
  );
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
  const userId = verifiedAuthUserId(session);

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
    carnetsError,
    retryCarnets,
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
  const [favoriteEventsReloadKey, setFavoriteEventsReloadKey] = useState(0);

  const [notebookEvents, setNotebookEvents] = useState<EventItem[]>([]);
  const [notebookLoading, setNotebookLoading] = useState(false);
  const [notebookError, setNotebookError] = useState<string | null>(null);
  const [notebookName, setNotebookName] = useState<string | null>(null);
  const [notebookEventsReloadKey, setNotebookEventsReloadKey] = useState(0);
  /**
   * Carnet auquel appartient le corpus en mémoire.
   * État pour le garde au rendu ; ref pour les callbacks async (maj synchrone).
   */
  const [notebookCorpusId, setNotebookCorpusId] = useState<string | null>(null);
  const notebookCorpusIdRef = useRef<string | null>(null);

  /** Compte propriétaire des corpus détaillés — aligné dès le rendu. */
  const [corpusOwnerUserId, setCorpusOwnerUserId] = useState<string | null>(
    null,
  );
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const sessionEpochRef = useRef(0);

  const favoriteEventsGateRef = useRef(createRequestGate());
  const carnetEventsGateRef = useRef(createRequestGate());
  const favoriteEventsLoadingRef = useRef(false);
  const notebookLoadingRef = useRef(false);

  // Isolation synchrone du compte : 1er rendu de B / logout n’expose plus A.
  if (!isSessionPending && userId !== corpusOwnerUserId) {
    const nextEpoch = sessionEpoch + 1;
    setSessionEpoch(nextEpoch);
    setCorpusOwnerUserId(userId);
    setFavoriteEvents([]);
    setFavoriteEventsLoading(false);
    setFavoriteEventsError(null);
    setNotebookEvents([]);
    setNotebookLoading(false);
    setNotebookError(null);
    setNotebookName(null);
    setNotebookCorpusId(null);
  }

  useEffect(() => {
    sessionEpochRef.current = sessionEpoch;
    notebookCorpusIdRef.current = null;
    favoriteEventsLoadingRef.current = false;
    notebookLoadingRef.current = false;
    favoriteEventsGateRef.current.invalidate();
    carnetEventsGateRef.current.invalidate();
  }, [sessionEpoch]);

  const isOpsSessionCurrent = useCallback(
    (boundEpoch: number) => {
      return (
        sessionEpochRef.current === boundEpoch &&
        Boolean(userId) &&
        userId === corpusOwnerUserId
      );
    },
    [userId, corpusOwnerUserId],
  );

  const removeEventLocally = useCallback(
    (id: string) => {
      if (!isOpsSessionCurrent(sessionEpoch)) return;
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
    [isOpsSessionCurrent, sessionEpoch, removeFavoriteLocally],
  );

  useEffect(() => {
    const requestGate = favoriteEventsGateRef.current;

    if (
      view !== "favorites" ||
      !userId ||
      userId !== corpusOwnerUserId ||
      isSessionPending
    ) {
      requestGate.invalidate();
      return;
    }

    const epoch = sessionEpoch;
    const gate = requestGate.begin();
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled || !gate.isCurrent()) return;
      if (sessionEpochRef.current !== epoch) return;
      setFavoriteEventsError(null);
      void runFavoriteEventsLoad(listFavoriteEvents, {
        isCurrent: () =>
          gate.isCurrent() && sessionEpochRef.current === epoch,
        onLoading: (loading) => {
          favoriteEventsLoadingRef.current = loading;
          setFavoriteEventsLoading(loading);
        },
        onSuccess: (events) => {
          if (sessionEpochRef.current !== epoch) return;
          setFavoriteEvents(events);
          setFavoriteEventsError(null);
          setFavoriteIdsAuthoritative(events.map((item) => item.id));
        },
        onError: (message) => {
          if (sessionEpochRef.current !== epoch) return;
          // Conserve le dernier corpus valide du même compte — pas de faux vide.
          setFavoriteEventsError(message);
        },
      });
    });

    return () => {
      cancelled = true;
      requestGate.invalidate();
    };
  }, [
    view,
    userId,
    corpusOwnerUserId,
    isSessionPending,
    sessionEpoch,
    listFavoriteEvents,
    setFavoriteIdsAuthoritative,
    favoriteEventsReloadKey,
  ]);

  useEffect(() => {
    const requestGate = carnetEventsGateRef.current;

    if (
      view !== "notebook" ||
      !notebookId ||
      !userId ||
      userId !== corpusOwnerUserId ||
      isSessionPending
    ) {
      requestGate.invalidate();
      return;
    }

    const epoch = sessionEpoch;
    const gate = requestGate.begin();
    const requestedId = notebookId;
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled || !gate.isCurrent()) return;
      if (sessionEpochRef.current !== epoch) return;
      setNotebookError(null);

      // Bascule carnet A→B (même compte) : ne jamais laisser le corpus de A sous B.
      if (notebookCorpusIdRef.current !== requestedId) {
        const cleared = retainNotebookCorpusForSelection({
          selectedNotebookId: requestedId,
          corpusNotebookId: notebookCorpusIdRef.current,
          events: [],
          name: null,
        });
        notebookCorpusIdRef.current = cleared.corpusNotebookId;
        setNotebookCorpusId(cleared.corpusNotebookId);
        setNotebookEvents(cleared.events);
        setNotebookName(cleared.name);
      }

      void runCarnetEventsLoad(requestedId, getCarnetEvents, {
        isCurrent: () =>
          gate.isCurrent() && sessionEpochRef.current === epoch,
        onLoading: (loading) => {
          notebookLoadingRef.current = loading;
          setNotebookLoading(loading);
        },
        onSuccess: (data) => {
          if (sessionEpochRef.current !== epoch) return;
          notebookCorpusIdRef.current = requestedId;
          setNotebookCorpusId(requestedId);
          setNotebookEvents(data.events);
          setNotebookName(data.name);
          setNotebookError(null);
        },
        onError: (failure) => {
          if (sessionEpochRef.current !== epoch) return;
          setNotebookError(failure.message);
          if (failure.missing) {
            notebookCorpusIdRef.current = null;
            setNotebookCorpusId(null);
            setNotebookEvents([]);
            setNotebookName(null);
            onNotebookMissingRef.current?.();
            return;
          }
          // Retry du même carnet : conserve. Autre carnet : déjà vidé au bascule.
          const kept = retainNotebookCorpusForSelection({
            selectedNotebookId: requestedId,
            corpusNotebookId: notebookCorpusIdRef.current,
            events: [],
            name: null,
          });
          if (kept.corpusNotebookId == null) {
            notebookCorpusIdRef.current = null;
            setNotebookCorpusId(null);
            setNotebookEvents([]);
            setNotebookName(null);
          }
        },
      });
    });

    return () => {
      cancelled = true;
      requestGate.invalidate();
    };
  }, [
    view,
    notebookId,
    userId,
    corpusOwnerUserId,
    isSessionPending,
    sessionEpoch,
    getCarnetEvents,
    notebookEventsReloadKey,
  ]);

  const sessionOwnsCorpus = isFriseCorpusOwnedBySession({
    userId,
    isSessionPending,
    corpusOwnerUserId,
  });

  const retryFavoriteEvents = useCallback(() => {
    if (!sessionOwnsCorpus || view !== "favorites") return;
    if (favoriteEventsLoadingRef.current) return;
    setFavoriteEventsReloadKey((key) => key + 1);
  }, [sessionOwnsCorpus, view]);

  const retryNotebookEvents = useCallback(() => {
    if (!sessionOwnsCorpus || view !== "notebook" || !notebookId) return;
    if (notebookLoadingRef.current) return;
    setNotebookEventsReloadKey((key) => key + 1);
  }, [sessionOwnsCorpus, view, notebookId]);

  const notebookActive =
    sessionOwnsCorpus && view === "notebook" && Boolean(notebookId);
  // Garde au rendu : compte courant + carnet sélectionné.
  const notebookCorpusVisible =
    notebookActive && notebookCorpusId === notebookId;
  const favoritesViewActive = sessionOwnsCorpus && view === "favorites";

  return {
    favoriteIds: favorites,
    favoriteEvents: favoritesViewActive ? favoriteEvents : EMPTY_EVENTS,
    favoriteEventsLoading: favoritesViewActive && favoriteEventsLoading,
    favoriteEventsError: favoritesViewActive ? favoriteEventsError : null,
    retryFavoriteEvents,
    groups: sessionOwnsCorpus && view === "notebook" ? groups : [],
    groupsLoading:
      sessionOwnsCorpus && view === "notebook" && carnetsLoading,
    groupsError: sessionOwnsCorpus && view === "notebook" ? carnetsError : null,
    retryGroups: retryCarnets,
    notebookEvents: notebookCorpusVisible ? notebookEvents : EMPTY_EVENTS,
    notebookLoading: notebookActive && notebookLoading,
    notebookError: notebookActive ? notebookError : null,
    notebookName: notebookCorpusVisible ? notebookName : null,
    retryNotebookEvents,
    addFavoriteLocally,
    rollbackFavoriteAdd,
    setFavoriteIds: setFavoriteIdsAuthoritative,
    removeEventLocally,
  };
}
