"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listMyFavoriteEventIds,
  type ListMyFavoriteEventIdsResult,
} from "@/app/actions/favorites";
import {
  listMyCarnetsState,
  type ListMyCarnetsStateResult,
} from "@/app/actions/groups";
import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";
import { countCarnetsByEventId } from "@/components/carnets/count-carnets-by-event-id";

const EMPTY_FAVORITES: ReadonlySet<string> = new Set();
const EMPTY_CARNET_COUNTS: ReadonlyMap<string, number> = new Map();
const EMPTY_GROUPS: GroupSummary[] = [];
const EMPTY_MEMBERSHIPS: EventGroupMembership[] = [];

export type FavoriteDelta = {
  added: ReadonlySet<string>;
  removed: ReadonlySet<string>;
};

export type CarnetsOverlay = {
  /** Groupes créés / mis à jour localement (ex. modale) — n’impliquent pas la suppression des autres. */
  upsertedGroups: ReadonlyMap<string, GroupSummary>;
  /** Appartenances ajoutées / mises à jour localement (clé `eventId\\0groupId`). */
  upsertedMemberships: ReadonlyMap<string, EventGroupMembership>;
  /** Appartenances retirées explicitement (hors exclusion totale d’événement). */
  removedMembershipKeys: ReadonlySet<string>;
  /** Événements dont toutes les appartenances ont été retirées (retrait favori). */
  excludedEventIds: ReadonlySet<string>;
};

type FavoriteOverlay = {
  added: Set<string>;
  removed: Set<string>;
};

type MutableCarnetsOverlay = {
  upsertedGroups: Map<string, GroupSummary>;
  upsertedMemberships: Map<string, EventGroupMembership>;
  removedMembershipKeys: Set<string>;
  excludedEventIds: Set<string>;
};

export type CarnetsSnapshot = {
  groups: GroupSummary[];
  memberships: EventGroupMembership[];
};

export function carnetMembershipKey(eventId: string, groupId: string): string {
  return `${eventId}\0${groupId}`;
}

function emptyCarnetsOverlay(): MutableCarnetsOverlay {
  return {
    upsertedGroups: new Map(),
    upsertedMemberships: new Map(),
    removedMembershipKeys: new Set(),
    excludedEventIds: new Set(),
  };
}

/**
 * Génération de session : invalide les réponses/callbacks d’un compte
 * précédent, y compris le cycle A → B → A (userId seul insuffisant).
 */
export function createPersonalSessionGate() {
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
 * ne doit pas écraser un état plus récent (contenu favoris ou debug).
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

/** Activation explicite du chargement carnets (Home dès login ; frise vue Carnets). */
export function isCarnetsLoadActive(params: {
  loadCarnets: boolean;
  userId: string | null;
  isSessionPending: boolean;
}): boolean {
  return Boolean(params.loadCarnets && params.userId && !params.isSessionPending);
}

/** Fusion IDs favoris serveur + modifications locales pendant le chargement. */
export function mergeFavoriteIds(
  serverIds: readonly string[],
  delta: FavoriteDelta,
): Set<string> {
  const next = new Set(serverIds);
  for (const id of delta.removed) next.delete(id);
  for (const id of delta.added) next.add(id);
  return next;
}

/**
 * Fusion snapshot carnets serveur + modifications locales ciblées.
 * Les callbacks modale peuvent être partiels : upsert local sans supprimer
 * les groupes / appartenances serveur non touchés.
 */
export function mergeCarnetsSnapshot(
  server: CarnetsSnapshot,
  overlay: CarnetsOverlay,
): CarnetsSnapshot {
  const groupsById = new Map(server.groups.map((g) => [g.id, g]));
  for (const [id, group] of overlay.upsertedGroups) {
    groupsById.set(id, group);
  }

  const membershipsByKey = new Map<string, EventGroupMembership>();
  for (const row of server.memberships) {
    if (overlay.excludedEventIds.has(row.eventId)) continue;
    const key = carnetMembershipKey(row.eventId, row.groupId);
    if (overlay.removedMembershipKeys.has(key)) continue;
    membershipsByKey.set(key, row);
  }
  for (const [key, row] of overlay.upsertedMemberships) {
    if (overlay.excludedEventIds.has(row.eventId)) continue;
    if (overlay.removedMembershipKeys.has(key)) continue;
    membershipsByKey.set(key, row);
  }

  return {
    groups: [...groupsById.values()],
    memberships: [...membershipsByKey.values()],
  };
}

export async function runFavoriteIdsLoad(
  load: () => Promise<ListMyFavoriteEventIdsResult>,
  handlers: {
    isCurrent: () => boolean;
    getDelta: () => FavoriteDelta;
    onMerged: (ids: Set<string>) => void;
  },
): Promise<void> {
  const { isCurrent, getDelta, onMerged } = handlers;
  if (!isCurrent()) return;

  try {
    const result = await load();
    if (!isCurrent()) return;
    if (!result.ok) {
      return;
    }
    onMerged(mergeFavoriteIds(result.eventIds, getDelta()));
  } catch {
    if (!isCurrent()) return;
  }
}

export async function runCarnetsLoad(
  load: () => Promise<ListMyCarnetsStateResult>,
  handlers: {
    isCurrent: () => boolean;
    getOverlay: () => CarnetsOverlay;
    onServerSnapshot: (server: CarnetsSnapshot) => void;
    onMerged: (snapshot: CarnetsSnapshot) => void;
    onLoading?: (loading: boolean) => void;
    onFailure?: () => void;
  },
): Promise<void> {
  const {
    isCurrent,
    getOverlay,
    onServerSnapshot,
    onMerged,
    onLoading,
    onFailure,
  } = handlers;
  if (!isCurrent()) return;

  onLoading?.(true);

  try {
    const result = await load();
    if (!isCurrent()) return;
    if (!result.ok) {
      onFailure?.();
      return;
    }
    const server: CarnetsSnapshot = {
      groups: result.groups,
      memberships: result.memberships,
    };
    onServerSnapshot(server);
    onMerged(mergeCarnetsSnapshot(server, getOverlay()));
  } catch {
    if (!isCurrent()) return;
    onFailure?.();
  } finally {
    if (isCurrent()) onLoading?.(false);
  }
}

type UsePersonalDataParams = {
  userId: string | null;
  isSessionPending: boolean;
  /**
   * Active le chargement des carnets. Home : `true` dès la connexion.
   * Frise : `true` uniquement en vue Carnets.
   */
  loadCarnets?: boolean;
  listFavoriteIds?: () => Promise<ListMyFavoriteEventIdsResult>;
  listCarnets?: () => Promise<ListMyCarnetsStateResult>;
  /** Après fusion réussie du snapshot carnets (corrections sélection/URL côté frise). */
  onCarnetsLoaded?: (snapshot: CarnetsSnapshot) => void;
};

/**
 * Favoris (IDs) + état des carnets, partagés Home / frise.
 * Fusion des réponses tardives, gate de session, activation explicite des carnets.
 */
export function usePersonalData({
  userId,
  isSessionPending,
  loadCarnets = true,
  listFavoriteIds = listMyFavoriteEventIds,
  listCarnets = listMyCarnetsState,
  onCarnetsLoaded,
}: UsePersonalDataParams) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string> | null>(null);
  const [carnets, setCarnets] = useState<CarnetsSnapshot | null>(null);
  const [carnetsLoading, setCarnetsLoading] = useState(false);

  const sessionGateRef = useRef(createPersonalSessionGate());
  const carnetsGateRef = useRef(createPersonalSessionGate());
  const favoriteIdsAuthorityRef = useRef(createFavoriteIdsAuthority());
  const favoriteOverlayRef = useRef<FavoriteOverlay>({
    added: new Set(),
    removed: new Set(),
  });
  const carnetsOverlayRef = useRef<MutableCarnetsOverlay>(emptyCarnetsOverlay());
  const lastServerCarnetsRef = useRef<CarnetsSnapshot>({
    groups: [],
    memberships: [],
  });
  const activeUserIdRef = useRef<string | null>(null);
  const onCarnetsLoadedRef = useRef(onCarnetsLoaded);

  useEffect(() => {
    onCarnetsLoadedRef.current = onCarnetsLoaded;
  }, [onCarnetsLoaded]);

  const resetLocalOverlays = useCallback(() => {
    favoriteOverlayRef.current = { added: new Set(), removed: new Set() };
    carnetsOverlayRef.current = emptyCarnetsOverlay();
    lastServerCarnetsRef.current = { groups: [], memberships: [] };
  }, []);

  const readCarnetsOverlay = useCallback(
    (): CarnetsOverlay => ({
      upsertedGroups: carnetsOverlayRef.current.upsertedGroups,
      upsertedMemberships: carnetsOverlayRef.current.upsertedMemberships,
      removedMembershipKeys: carnetsOverlayRef.current.removedMembershipKeys,
      excludedEventIds: carnetsOverlayRef.current.excludedEventIds,
    }),
    [],
  );

  const publishCarnetsFromOverlay = useCallback(() => {
    setCarnets(
      mergeCarnetsSnapshot(lastServerCarnetsRef.current, readCarnetsOverlay()),
    );
  }, [readCarnetsOverlay]);

  // Session + IDs favoris (toujours dès connexion).
  useEffect(() => {
    const gate = sessionGateRef.current;

    if (isSessionPending) return;

    if (!userId) {
      gate.invalidate();
      carnetsGateRef.current.invalidate();
      favoriteIdsAuthorityRef.current.bump();
      activeUserIdRef.current = null;
      resetLocalOverlays();
      queueMicrotask(() => {
        setFavoriteIds(null);
        setCarnets(null);
        setCarnetsLoading(false);
      });
      return;
    }

    activeUserIdRef.current = userId;
    resetLocalOverlays();
    favoriteIdsAuthorityRef.current.bump();

    const session = gate.begin();
    const loadUserId = userId;
    const authority = favoriteIdsAuthorityRef.current.capture();

    queueMicrotask(() => {
      if (!session.isCurrent()) return;
      setFavoriteIds(null);
      setCarnets(null);
      setCarnetsLoading(false);

      void runFavoriteIdsLoad(listFavoriteIds, {
        isCurrent: () => session.isCurrent() && authority.isAuthoritative(),
        getDelta: () => ({
          added: favoriteOverlayRef.current.added,
          removed: favoriteOverlayRef.current.removed,
        }),
        onMerged: (ids) => {
          if (!session.isCurrent()) return;
          if (!authority.isAuthoritative()) return;
          if (activeUserIdRef.current !== loadUserId) return;
          setFavoriteIds(ids);
        },
      });
    });

    return () => {
      gate.invalidate();
    };
  }, [isSessionPending, userId, listFavoriteIds, resetLocalOverlays]);

  // Carnets : activation explicite (Home true ; frise vue notebook).
  useEffect(() => {
    const requestGate = carnetsGateRef.current;

    if (
      !isCarnetsLoadActive({ loadCarnets, userId, isSessionPending })
    ) {
      requestGate.invalidate();
      queueMicrotask(() => setCarnetsLoading(false));
      return;
    }

    const loadUserId = userId;
    const gate = requestGate.begin();
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled || !gate.isCurrent()) return;
      if (activeUserIdRef.current !== loadUserId) return;

      // Snapshot vide dès l’activation (Home : modale organisable pendant le load)
      // sans écraser un état déjà hydraté (ré-entrée frise).
      setCarnets((prev) => prev ?? { groups: [], memberships: [] });

      void runCarnetsLoad(listCarnets, {
        isCurrent: () =>
          gate.isCurrent() && activeUserIdRef.current === loadUserId,
        getOverlay: readCarnetsOverlay,
        onLoading: setCarnetsLoading,
        onServerSnapshot: (server) => {
          if (!gate.isCurrent()) return;
          lastServerCarnetsRef.current = server;
        },
        onMerged: (snapshot) => {
          if (!gate.isCurrent()) return;
          if (activeUserIdRef.current !== loadUserId) return;
          setCarnets(snapshot);
          onCarnetsLoadedRef.current?.(snapshot);
        },
        onFailure: () => {
          if (!gate.isCurrent()) return;
          if (activeUserIdRef.current !== loadUserId) return;
          setCarnets({ groups: [], memberships: [] });
        },
      });
    });

    return () => {
      cancelled = true;
      requestGate.invalidate();
    };
  }, [
    loadCarnets,
    userId,
    isSessionPending,
    listCarnets,
    readCarnetsOverlay,
  ]);

  const favorites: ReadonlySet<string> =
    userId && favoriteIds ? favoriteIds : EMPTY_FAVORITES;

  const groups = userId && carnets ? carnets.groups : EMPTY_GROUPS;
  const memberships =
    userId && carnets ? carnets.memberships : EMPTY_MEMBERSHIPS;

  const carnetCounts = useMemo(() => {
    if (!userId || !carnets) return EMPTY_CARNET_COUNTS;
    return countCarnetsByEventId(carnets.memberships);
  }, [userId, carnets]);

  const addFavoriteLocally = useCallback(
    (eventId: string) => {
      if (!userId || activeUserIdRef.current !== userId) return;
      const overlay = favoriteOverlayRef.current;
      overlay.removed.delete(eventId);
      overlay.added.add(eventId);
      setFavoriteIds((prev) => {
        const next = new Set(prev ?? []);
        next.add(eventId);
        return next;
      });
    },
    [userId],
  );

  const rollbackFavoriteAdd = useCallback(
    (eventId: string) => {
      if (!userId || activeUserIdRef.current !== userId) return;
      const overlay = favoriteOverlayRef.current;
      overlay.added.delete(eventId);
      setFavoriteIds((prev) => {
        if (!prev?.has(eventId)) return prev;
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    },
    [userId],
  );

  const removeFavoriteLocally = useCallback(
    (eventId: string) => {
      if (!userId || activeUserIdRef.current !== userId) return;
      const favOverlay = favoriteOverlayRef.current;
      favOverlay.added.delete(eventId);
      favOverlay.removed.add(eventId);

      const carnetsOverlay = carnetsOverlayRef.current;
      carnetsOverlay.excludedEventIds.add(eventId);
      for (const key of [...carnetsOverlay.upsertedMemberships.keys()]) {
        if (key.startsWith(`${eventId}\0`)) {
          carnetsOverlay.upsertedMemberships.delete(key);
        }
      }

      setFavoriteIds((prev) => {
        if (!prev?.has(eventId)) return prev ?? new Set();
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      publishCarnetsFromOverlay();
    },
    [userId, publishCarnetsFromOverlay],
  );

  /**
   * Remplace les IDs favoris de façon autoritaire (contenu favoris chargé,
   * debug `__friseSetFavoriteIds`). Une réponse d’IDs plus ancienne est ignorée.
   */
  const setFavoriteIdsAuthoritative = useCallback(
    (ids: readonly string[]) => {
      if (!userId || activeUserIdRef.current !== userId) return;
      favoriteIdsAuthorityRef.current.bump();
      favoriteOverlayRef.current = { added: new Set(), removed: new Set() };
      setFavoriteIds(new Set(ids));
    },
    [userId],
  );

  const replaceGroups = useCallback(
    (nextGroups: GroupSummary[]) => {
      if (!userId || activeUserIdRef.current !== userId) return;
      const overlay = carnetsOverlayRef.current;
      for (const group of nextGroups) {
        overlay.upsertedGroups.set(group.id, group);
      }
      publishCarnetsFromOverlay();
    },
    [userId, publishCarnetsFromOverlay],
  );

  const replaceMemberships = useCallback(
    (nextMemberships: EventGroupMembership[]) => {
      if (!userId || activeUserIdRef.current !== userId) return;
      const overlay = carnetsOverlayRef.current;
      for (const row of nextMemberships) {
        const key = carnetMembershipKey(row.eventId, row.groupId);
        overlay.upsertedMemberships.set(key, row);
        overlay.removedMembershipKeys.delete(key);
        overlay.excludedEventIds.delete(row.eventId);
      }
      publishCarnetsFromOverlay();
    },
    [userId, publishCarnetsFromOverlay],
  );

  return {
    favorites,
    groups,
    memberships,
    carnetCounts,
    hasCarnetsState: Boolean(userId && carnets),
    carnetsLoading: Boolean(
      userId && isCarnetsLoadActive({ loadCarnets, userId, isSessionPending })
        ? carnetsLoading
        : false,
    ),
    addFavoriteLocally,
    rollbackFavoriteAdd,
    removeFavoriteLocally,
    setFavoriteIdsAuthoritative,
    replaceGroups,
    replaceMemberships,
  };
}
