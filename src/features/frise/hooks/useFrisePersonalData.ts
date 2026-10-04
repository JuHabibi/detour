"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listMyFavoriteEventIds,
  listMyFavoriteEvents,
} from "@/app/actions/favorites";
import type {
  ListMyFavoriteEventIdsResult,
  ListMyFavoriteEventsResult,
} from "@/app/actions/favorites";
import {
  getMyCarnetEvents,
  listMyCarnetsState,
} from "@/app/actions/groups";
import type {
  GetMyCarnetEventsResult,
  ListMyCarnetsStateResult,
} from "@/app/actions/groups";
import type { GroupSummary } from "@/application/groups";
import type { EventItem } from "@/data/types";
import type { FriseView } from "@/features/frise/frise-url-state";

const EMPTY_FAVORITES: ReadonlySet<string> = new Set();
const EMPTY_EVENTS: EventItem[] = [];

type FavoriteState = {
  userId: string;
  ids: Set<string>;
};

type UseFrisePersonalDataParams = {
  view: FriseView;
  notebookId: string | null;
  /** Après hydratation carnets (succès ou erreur) — corrections sélection/URL côté page. */
  onGroupsLoaded?: (groups: GroupSummary[]) => void;
  /** Carnet sélectionné introuvable — correction sélection/URL côté page. */
  onNotebookMissing?: () => void;
  listFavoriteIds?: () => Promise<ListMyFavoriteEventIdsResult>;
  listFavoriteEvents?: () => Promise<ListMyFavoriteEventsResult>;
  listCarnets?: () => Promise<ListMyCarnetsStateResult>;
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

/**
 * Autorité des IDs favoris : une réponse tardive de `listMyFavoriteEventIds`
 * ne doit pas écraser un état plus récent (contenu favoris ou mutation locale).
 */
export function createFavoriteIdsAuthority() {
  let epoch = 0;
  return {
    bump() {
      epoch += 1;
    },
    capture() {
      const atStart = epoch;
      return { isAuthoritative: () => atStart === epoch };
    },
  };
}

export async function runFavoriteIdsLoad(
  load: () => Promise<ListMyFavoriteEventIdsResult>,
  handlers: LoadHandlers & {
    onSuccess: (eventIds: string[]) => void;
  },
): Promise<void> {
  const { isCurrent, onSuccess } = handlers;
  if (!isCurrent()) return;

  try {
    const result = await load();
    if (!isCurrent()) return;
    onSuccess(result.ok ? result.eventIds : []);
  } catch {
    if (!isCurrent()) return;
    onSuccess([]);
  }
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

export async function runCarnetsListLoad(
  load: () => Promise<ListMyCarnetsStateResult>,
  handlers: LoadHandlers & {
    onSuccess: (groups: GroupSummary[]) => void;
    onError: () => void;
  },
): Promise<void> {
  const { isCurrent, onLoading, onSuccess, onError } = handlers;
  if (!isCurrent()) return;

  onLoading(true);

  try {
    const result = await load();
    if (!isCurrent()) return;
    if (!result.ok) {
      onError();
      return;
    }
    onSuccess(result.groups);
  } catch {
    if (!isCurrent()) return;
    onError();
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
 * Charge les données personnelles de la frise (IDs / contenu favoris,
 * liste des carnets, contenu du carnet sélectionné) avec invalidation
 * des réponses obsolètes par famille de requête.
 */
export function useFrisePersonalData({
  view,
  notebookId,
  onGroupsLoaded,
  onNotebookMissing,
  listFavoriteIds = listMyFavoriteEventIds,
  listFavoriteEvents = listMyFavoriteEvents,
  listCarnets = listMyCarnetsState,
  getCarnetEvents = getMyCarnetEvents,
}: UseFrisePersonalDataParams) {
  const [favoriteState, setFavoriteState] = useState<FavoriteState | null>(
    null,
  );
  const [favoriteEvents, setFavoriteEvents] = useState<EventItem[]>([]);
  const [favoriteEventsLoading, setFavoriteEventsLoading] = useState(false);
  const [favoriteEventsError, setFavoriteEventsError] = useState<string | null>(
    null,
  );

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  const [notebookEvents, setNotebookEvents] = useState<EventItem[]>([]);
  const [notebookLoading, setNotebookLoading] = useState(false);
  const [notebookError, setNotebookError] = useState<string | null>(null);
  const [notebookName, setNotebookName] = useState<string | null>(null);

  const favoriteIdsGateRef = useRef(createRequestGate());
  const favoriteEventsGateRef = useRef(createRequestGate());
  const carnetsGateRef = useRef(createRequestGate());
  const carnetEventsGateRef = useRef(createRequestGate());
  const favoriteIdsAuthorityRef = useRef(createFavoriteIdsAuthority());
  const onGroupsLoadedRef = useRef(onGroupsLoaded);
  const onNotebookMissingRef = useRef(onNotebookMissing);

  useEffect(() => {
    onGroupsLoadedRef.current = onGroupsLoaded;
    onNotebookMissingRef.current = onNotebookMissing;
  }, [onGroupsLoaded, onNotebookMissing]);

  const bumpFavoriteIdsAuthority = useCallback(() => {
    favoriteIdsAuthorityRef.current.bump();
  }, []);

  const patchFavoriteIds = useCallback(
    (mutator: (draft: Set<string>) => void) => {
      bumpFavoriteIdsAuthority();
      setFavoriteState((prev) => {
        const draft = prev ? new Set(prev.ids) : new Set<string>();
        mutator(draft);
        return { userId: prev?.userId ?? "self", ids: draft };
      });
    },
    [bumpFavoriteIdsAuthority],
  );

  const setFavoriteIds = useCallback(
    (ids: string[]) => {
      bumpFavoriteIdsAuthority();
      setFavoriteState({ userId: "self", ids: new Set(ids) });
    },
    [bumpFavoriteIdsAuthority],
  );

  const removeEventLocally = useCallback(
    (id: string) => {
      bumpFavoriteIdsAuthority();
      setFavoriteState((prev) => {
        const next = removeEventFromPersonalCorpora(id, {
          ids: prev?.ids ?? EMPTY_FAVORITES,
          favoriteEvents: EMPTY_EVENTS,
          notebookEvents: EMPTY_EVENTS,
        });
        return { userId: prev?.userId ?? "self", ids: next.ids };
      });
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
    [bumpFavoriteIdsAuthority],
  );

  useEffect(() => {
    const requestGate = favoriteIdsGateRef.current;
    const gate = requestGate.begin();
    const authority = favoriteIdsAuthorityRef.current.capture();
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      void runFavoriteIdsLoad(listFavoriteIds, {
        isCurrent: () => gate.isCurrent() && authority.isAuthoritative(),
        onLoading: () => {},
        onSuccess: (eventIds) => {
          setFavoriteState({ userId: "self", ids: new Set(eventIds) });
        },
      });
    });

    return () => {
      cancelled = true;
      requestGate.invalidate();
    };
  }, [listFavoriteIds]);

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
          bumpFavoriteIdsAuthority();
          setFavoriteEvents(events);
          setFavoriteEventsError(null);
          setFavoriteState({
            userId: "self",
            ids: new Set(events.map((item) => item.id)),
          });
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
  }, [view, listFavoriteEvents, bumpFavoriteIdsAuthority]);

  useEffect(() => {
    const requestGate = carnetsGateRef.current;

    if (view !== "notebook") {
      requestGate.invalidate();
      return;
    }

    const gate = requestGate.begin();
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      void runCarnetsListLoad(listCarnets, {
        isCurrent: gate.isCurrent,
        onLoading: setGroupsLoading,
        onSuccess: (nextGroups) => {
          setGroups(nextGroups);
          onGroupsLoadedRef.current?.(nextGroups);
        },
        onError: () => {
          setGroups([]);
        },
      });
    });

    return () => {
      cancelled = true;
      requestGate.invalidate();
    };
  }, [view, listCarnets]);

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
    favoriteIds: favoriteState?.ids ?? EMPTY_FAVORITES,
    favoriteEvents: view === "favorites" ? favoriteEvents : EMPTY_EVENTS,
    favoriteEventsLoading: view === "favorites" && favoriteEventsLoading,
    favoriteEventsError: view === "favorites" ? favoriteEventsError : null,
    groups: view === "notebook" ? groups : [],
    groupsLoading: view === "notebook" && groupsLoading,
    notebookEvents: notebookActive ? notebookEvents : EMPTY_EVENTS,
    notebookLoading: notebookActive && notebookLoading,
    notebookError: notebookActive ? notebookError : null,
    notebookName: notebookActive ? notebookName : null,
    patchFavoriteIds,
    setFavoriteIds,
    removeEventLocally,
  };
}
