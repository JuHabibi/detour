import { listExplorerEvents } from "@/application/explorer/list-explorer-events";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import type { EventItem } from "@/data/types";
import type { DetourEvent } from "@/domain/events/event";
import {
  FOR_YOU_MAX_RESULTS,
  selectForYouEvents,
  type ForYouPreferences,
} from "@/domain/personalization/select-for-you-events";
import type { UserProfileInterest } from "@/domain/personalization/user-profile";
import type { DbQueryable } from "@/infrastructure/db/postgres";

/**
 * Par catégorie d’intérêt : au plus N représentants Explorer à venir.
 * Borné et ciblé — pas de parcours paginé du catalogue entier.
 */
export const FOR_YOU_CANDIDATES_PER_CATEGORY = 24;

export type GetForYouRecommendationsResult = {
  events: EventItem[];
  /** Candidats uniques après fetch / dédup id (avant scoring). */
  candidateCount: number;
  /** Correspondances centres d’intérêt avant diversité / plafond. */
  matchCount: number;
};

export type GetForYouRecommendationsDeps = {
  listEvents?: typeof listExplorerEvents;
  mapEvent?: (event: DetourEvent) => EventItem;
  client?: DbQueryable;
  now?: Date;
};

/**
 * Candidats Explorer filtrés par `product_category` (intérêts),
 * puis ranking déterministe V1. Aucun Radar / IA.
 */
export async function getForYouRecommendations(
  preferences: ForYouPreferences,
  deps: GetForYouRecommendationsDeps = {},
): Promise<GetForYouRecommendationsResult> {
  const interests = uniqueInterests(preferences.interests);
  if (interests.length === 0) {
    return { events: [], candidateCount: 0, matchCount: 0 };
  }

  const now = deps.now ?? new Date();
  const listEvents = deps.listEvents ?? listExplorerEvents;
  const mapEvent = deps.mapEvent ?? mapDetourEventToEventItem;

  const pages = await Promise.all(
    interests.map((category) =>
      listEvents(
        {
          when: "upcoming",
          category,
          limit: FOR_YOU_CANDIDATES_PER_CATEGORY,
        },
        { client: deps.client, now, skipCount: true },
      ),
    ),
  );

  const byId = new Map<string, EventItem>();
  for (const page of pages) {
    for (const event of page.events) {
      if (byId.has(event.id)) continue;
      byId.set(event.id, mapEvent(event));
    }
  }

  const pool = [...byId.values()];
  const interestSet = new Set<string>(interests);
  const matchCount = pool.filter((event) =>
    interestSet.has(event.category),
  ).length;

  const selected = selectForYouEvents(pool, preferences, FOR_YOU_MAX_RESULTS, now);

  return {
    events: selected,
    candidateCount: pool.length,
    matchCount,
  };
}

function uniqueInterests(
  interests: readonly UserProfileInterest[],
): UserProfileInterest[] {
  const seen = new Set<string>();
  const out: UserProfileInterest[] = [];
  for (const interest of interests) {
    if (seen.has(interest)) continue;
    seen.add(interest);
    out.push(interest);
  }
  return out;
}
