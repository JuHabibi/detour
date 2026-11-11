/**
 * Évaluation manuelle « Pour vous » sur le catalogue Explorer réel.
 * Usage :
 *   node --conditions=react-server --import tsx --env-file=.env.local scripts/eval-for-you-real.mts
 */
import { listExplorerEvents } from "../src/application/explorer/list-explorer-events";
import { mapDetourEventToEventItem } from "../src/application/map-detour-event-to-ui";
import { FOR_YOU_CANDIDATES_PER_CATEGORY } from "../src/application/personalization/get-for-you-recommendations";
import {
  rankForYouEvents,
  type ForYouPreferences,
} from "../src/domain/personalization/select-for-you-events";
import type { EventItem } from "../src/data/types";

const PROFILES: Array<{ label: string; preferences: ForYouPreferences }> = [
  {
    label: "Musique + weekend-evening + any",
    preferences: {
      interests: ["Musique"],
      availabilities: ["weekend-evening"],
      budget: "any",
    },
  },
  {
    label: "Exposition + weekend-day + free_preferred",
    preferences: {
      interests: ["Exposition"],
      availabilities: ["weekend-day"],
      budget: "free_preferred",
    },
  },
  {
    label: "Cinéma + flexible + any",
    preferences: {
      interests: ["Cinéma"],
      availabilities: ["flexible"],
      budget: "any",
    },
  },
];

async function loadPool(
  preferences: ForYouPreferences,
  now: Date,
): Promise<EventItem[]> {
  const pages = await Promise.all(
    preferences.interests.map((category) =>
      listExplorerEvents(
        {
          when: "upcoming",
          category,
          limit: FOR_YOU_CANDIDATES_PER_CATEGORY,
        },
        { now, skipCount: true },
      ),
    ),
  );

  const byId = new Map<string, EventItem>();
  for (const page of pages) {
    for (const event of page.events) {
      if (byId.has(event.id)) continue;
      byId.set(event.id, mapDetourEventToEventItem(event));
    }
  }
  return [...byId.values()];
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL manquant — skip éval réelle.");
    process.exit(2);
  }

  const now = new Date();
  console.log(`now=${now.toISOString()}\n`);

  for (const profile of PROFILES) {
    const pool = await loadPool(profile.preferences, now);
    const interestSet = new Set(profile.preferences.interests);
    const matchCount = pool.filter((event) =>
      interestSet.has(event.category as never),
    ).length;
    const ranked = rankForYouEvents(pool, profile.preferences, 8, now);

    console.log(`## ${profile.label}`);
    console.log(
      `candidats=${pool.length} matchIntérêt=${matchCount} retenus=${ranked.length}`,
    );
    for (const item of ranked) {
      const e = item.candidate;
      console.log(
        `- ${e.title} | ${e.category} | ${e.startAt ?? "?"} | score=${item.score.toFixed(3)} | ${item.reasons.join(", ")} | conditions=${JSON.stringify(e.conditions ?? null)}`,
      );
    }
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
