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
  /**
   * Événements dont les appartenances ont été réalignées localement (modale).
   * Les lignes serveur pour ces IDs sont ignorées au profit de l’overlay
   * (y compris une liste vide = tout retiré pour l’événement).
   */
  replacedMembershipEventIds: ReadonlySet<string>;
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
  replacedMembershipEventIds: Set<string>;
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
    replacedMembershipEventIds: new Set(),
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
      return { id, isCurrent: () => id === generation };
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
    if (overlay.replacedMembershipEventIds.has(row.eventId)) continue;
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

/**
 * Aligne l’overlay sur les appartenances des `eventIds` ciblés uniquement.
 * Une ligne absente du payload pour un autre événement n’est pas retirée.
 * Les retraits du scope résistent à une fusion ultérieure du snapshot serveur.
 */
export function applyScopedMembershipsLocally(
  overlay: MutableCarnetsOverlay,
  server: CarnetsSnapshot,
  eventIds: readonly string[],
  nextMemberships: readonly EventGroupMembership[],
): void {
  const eventSet = new Set(eventIds);
  const desired = nextMemberships.filter((row) => eventSet.has(row.eventId));
  const desiredKeys = new Set(
    desired.map((row) => carnetMembershipKey(row.eventId, row.groupId)),
  );

  for (const eventId of eventIds) {
    overlay.replacedMembershipEventIds.add(eventId);
  }

  const current = mergeCarnetsSnapshot(server, {
    upsertedGroups: overlay.upsertedGroups,
    upsertedMemberships: overlay.upsertedMemberships,
    removedMembershipKeys: overlay.removedMembershipKeys,
    replacedMembershipEventIds: overlay.replacedMembershipEventIds,
    excludedEventIds: overlay.excludedEventIds,
  });

  for (const row of current.memberships) {
    if (!eventSet.has(row.eventId)) continue;
    const key = carnetMembershipKey(row.eventId, row.groupId);
    if (desiredKeys.has(key)) continue;
    overlay.removedMembershipKeys.add(key);
    overlay.upsertedMemberships.delete(key);
  }

  for (const row of desired) {
    const key = carnetMembershipKey(row.eventId, row.groupId);
    overlay.upsertedMemberships.set(key, row);
    overlay.removedMembershipKeys.delete(key);
    overlay.excludedEventIds.delete(row.eventId);
  }
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
  },
): Promise<void> {
  const {
    isCurrent,
    getOverlay,
    onServerSnapshot,
    onMerged,
    onLoading,
  } = handlers;
  if (!isCurrent()) return;

  onLoading?.(true);

  try {
    const result = await load();
    if (!isCurrent()) return;
    if (!result.ok) {
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
  /** Compte propriétaire des données exposées — aligné dès le rendu, pas seulement après effet. */
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  /** Génération liée aux callbacks locaux (A→B→A, logout, démontage). */
  const [sessionEpoch, setSessionEpoch] = useState(0);

  const sessionEpochRef = useRef(0);
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
  const onCarnetsLoadedRef = useRef(onCarnetsLoaded);
  const listFavoriteIdsRef = useRef(listFavoriteIds);
  const listCarnetsRef = useRef(listCarnets);

  useEffect(() => {
    onCarnetsLoadedRef.current = onCarnetsLoaded;
  }, [onCarnetsLoaded]);

  useEffect(() => {
    listFavoriteIdsRef.current = listFavoriteIds;
  }, [listFavoriteIds]);

  useEffect(() => {
    listCarnetsRef.current = listCarnets;
  }, [listCarnets]);

  // Isolation synchrone du compte : le 1er rendu de B n’expose plus les données de A.
  if (!isSessionPending && userId !== ownerUserId) {
    const nextEpoch = sessionEpoch + 1;
    setSessionEpoch(nextEpoch);
    setOwnerUserId(userId);
    setFavoriteIds(null);
    setCarnets(null);
    setCarnetsLoading(false);
  }

  // Epoch / overlays : synchronisés après le rendu qui a changé de compte.
  useEffect(() => {
    sessionEpochRef.current = sessionEpoch;
    favoriteOverlayRef.current = { added: new Set(), removed: new Set() };
    carnetsOverlayRef.current = emptyCarnetsOverlay();
    lastServerCarnetsRef.current = { groups: [], memberships: [] };
    favoriteIdsAuthorityRef.current.bump();
    carnetsGateRef.current.invalidate();
  }, [sessionEpoch]);

  const readCarnetsOverlay = useCallback(
    (): CarnetsOverlay => ({
      upsertedGroups: carnetsOverlayRef.current.upsertedGroups,
      upsertedMemberships: carnetsOverlayRef.current.upsertedMemberships,
      removedMembershipKeys: carnetsOverlayRef.current.removedMembershipKeys,
      replacedMembershipEventIds:
        carnetsOverlayRef.current.replacedMembershipEventIds,
      excludedEventIds: carnetsOverlayRef.current.excludedEventIds,
    }),
    [],
  );

  const publishCarnetsFromOverlay = useCallback(() => {
    setCarnets(
      mergeCarnetsSnapshot(lastServerCarnetsRef.current, readCarnetsOverlay()),
    );
  }, [readCarnetsOverlay]);

  const isOpsSessionCurrent = useCallback((boundEpoch: number) => {
    return (
      sessionEpochRef.current === boundEpoch &&
      Boolean(userId) &&
      userId === ownerUserId
    );
  }, [userId, ownerUserId]);

  // Démontage : invalide les callbacks et requêtes de cette instance.
  useEffect(() => {
    const carnetsGate = carnetsGateRef.current;
    const favoriteAuthority = favoriteIdsAuthorityRef.current;
    return () => {
      sessionEpochRef.current += 1;
      carnetsGate.invalidate();
      favoriteAuthority.bump();
    };
  }, []);

  // IDs favoris dès connexion (session courante uniquement).
  useEffect(() => {
    if (isSessionPending || !userId || userId !== ownerUserId) return;

    const epoch = sessionEpoch;
    const authority = favoriteIdsAuthorityRef.current.capture();
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled || sessionEpochRef.current !== epoch) return;

      void runFavoriteIdsLoad(() => listFavoriteIdsRef.current(), {
        isCurrent: () =>
          sessionEpochRef.current === epoch && authority.isAuthoritative(),
        getDelta: () => ({
          added: favoriteOverlayRef.current.added,
          removed: favoriteOverlayRef.current.removed,
        }),
        onMerged: (ids) => {
          if (sessionEpochRef.current !== epoch) return;
          if (!authority.isAuthoritative()) return;
          setFavoriteIds(ids);
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isSessionPending, userId, ownerUserId, sessionEpoch]);

  // Carnets : activation explicite (Home true ; frise vue notebook).
  useEffect(() => {
    const requestGate = carnetsGateRef.current;

    if (
      !isCarnetsLoadActive({ loadCarnets, userId, isSessionPending }) ||
      userId !== ownerUserId
    ) {
      requestGate.invalidate();
      queueMicrotask(() => setCarnetsLoading(false));
      return;
    }

    const epoch = sessionEpoch;
    const gate = requestGate.begin();
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled || !gate.isCurrent()) return;
      if (sessionEpochRef.current !== epoch) return;

      // Snapshot vide dès l’activation (Home : modale organisable pendant le load)
      // sans écraser un état déjà hydraté (ré-entrée frise / mods locales).
      setCarnets((prev) => prev ?? { groups: [], memberships: [] });

      void runCarnetsLoad(() => listCarnetsRef.current(), {
        isCurrent: () =>
          gate.isCurrent() && sessionEpochRef.current === epoch,
        getOverlay: readCarnetsOverlay,
        onLoading: setCarnetsLoading,
        onServerSnapshot: (server) => {
          if (!gate.isCurrent() || sessionEpochRef.current !== epoch) return;
          lastServerCarnetsRef.current = server;
        },
        onMerged: (snapshot) => {
          if (!gate.isCurrent() || sessionEpochRef.current !== epoch) return;
          setCarnets(snapshot);
          onCarnetsLoadedRef.current?.(snapshot);
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
    ownerUserId,
    sessionEpoch,
    isSessionPending,
    readCarnetsOverlay,
  ]);

  const sessionReady =
    !isSessionPending && Boolean(userId) && userId === ownerUserId;

  const favorites: ReadonlySet<string> =
    sessionReady && favoriteIds ? favoriteIds : EMPTY_FAVORITES;

  const groups = sessionReady && carnets ? carnets.groups : EMPTY_GROUPS;
  const memberships =
    sessionReady && carnets ? carnets.memberships : EMPTY_MEMBERSHIPS;

  const carnetCounts = useMemo(() => {
    if (!sessionReady || !carnets) return EMPTY_CARNET_COUNTS;
    return countCarnetsByEventId(carnets.memberships);
  }, [sessionReady, carnets]);

  const addFavoriteLocally = useCallback(
    (eventId: string) => {
      if (!isOpsSessionCurrent(sessionEpoch)) return;
      const overlay = favoriteOverlayRef.current;
      overlay.removed.delete(eventId);
      overlay.added.add(eventId);
      setFavoriteIds((prev) => {
        const next = new Set(prev ?? []);
        next.add(eventId);
        return next;
      });
    },
    [isOpsSessionCurrent, sessionEpoch],
  );

  const rollbackFavoriteAdd = useCallback(
    (eventId: string) => {
      if (!isOpsSessionCurrent(sessionEpoch)) return;
      const overlay = favoriteOverlayRef.current;
      overlay.added.delete(eventId);
      setFavoriteIds((prev) => {
        if (!prev?.has(eventId)) return prev;
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    },
    [isOpsSessionCurrent, sessionEpoch],
  );

  const removeFavoriteLocally = useCallback(
    (eventId: string) => {
      if (!isOpsSessionCurrent(sessionEpoch)) return;
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
    [isOpsSessionCurrent, sessionEpoch, publishCarnetsFromOverlay],
  );

  /**
   * Remplace les IDs favoris de façon autoritaire (contenu favoris chargé,
   * debug `__friseSetFavoriteIds`). Une réponse d’IDs plus ancienne est ignorée.
   */
  const setFavoriteIdsAuthoritative = useCallback(
    (ids: readonly string[]) => {
      if (!isOpsSessionCurrent(sessionEpoch)) return;
      favoriteIdsAuthorityRef.current.bump();
      favoriteOverlayRef.current = { added: new Set(), removed: new Set() };
      setFavoriteIds(new Set(ids));
    },
    [isOpsSessionCurrent, sessionEpoch],
  );

  const replaceGroups = useCallback(
    (nextGroups: GroupSummary[]) => {
      if (!isOpsSessionCurrent(sessionEpoch)) return;
      const overlay = carnetsOverlayRef.current;
      for (const group of nextGroups) {
        overlay.upsertedGroups.set(group.id, group);
      }
      publishCarnetsFromOverlay();
    },
    [isOpsSessionCurrent, sessionEpoch, publishCarnetsFromOverlay],
  );

  /**
   * Remplace les appartenances des `eventIds` ciblés.
   * `nextMemberships` peut être une liste plus large : seules les lignes
   * de ces événements comptent ; leur absence = retrait local (fusion-safe).
   */
  const replaceMemberships = useCallback(
    (eventIds: readonly string[], nextMemberships: EventGroupMembership[]) => {
      if (!isOpsSessionCurrent(sessionEpoch)) return;
      if (eventIds.length === 0) return;
      applyScopedMembershipsLocally(
        carnetsOverlayRef.current,
        lastServerCarnetsRef.current,
        eventIds,
        nextMemberships,
      );
      publishCarnetsFromOverlay();
    },
    [isOpsSessionCurrent, sessionEpoch, publishCarnetsFromOverlay],
  );

  return {
    favorites,
    groups,
    memberships,
    carnetCounts,
    hasCarnetsState: Boolean(sessionReady && carnets),
    carnetsLoading: Boolean(
      sessionReady &&
        isCarnetsLoadActive({ loadCarnets, userId, isSessionPending })
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
