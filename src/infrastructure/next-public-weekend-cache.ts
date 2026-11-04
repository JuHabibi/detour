import { revalidateTag, unstable_cache } from "next/cache";
import {
  applyWeekendPageEndedFilter,
  getPublicWeekendPage,
  type PublicWeekendPage,
} from "@/application/weekend/get-public-weekend-page";
import { PUBLIC_TERRITORY_SLUG } from "@/config/public-territory";
import {
  getDateRangeForWhenFilter,
  toParisDateKey,
} from "@/domain/time/when-filter";

/**
 * Data Cache page « Ce week-end » — tag distinct Home / Explorer.
 * Clé versionnée par samedi Paris : bascule de week-end = nouvelle entrée.
 * La route est `force-dynamic` : ce cache borne le SQL, pas le HTML ISR.
 */
export const PUBLIC_WEEKEND_CACHE_TAG = `public-weekend:${PUBLIC_TERRITORY_SLUG}`;

export const PUBLIC_WEEKEND_CACHE_REVALIDATE_SECONDS = 60 * 60 * 6;

export async function getCachedPublicWeekendPage(): Promise<PublicWeekendPage> {
  const now = new Date();
  const range = getDateRangeForWhenFilter("weekend", now);
  const saturdayKey = toParisDateKey(range.from);

  const cached = unstable_cache(
    async () => getPublicWeekendPage({ now }),
    [
      "detour-public-weekend",
      PUBLIC_TERRITORY_SLUG,
      saturdayKey,
      "select-v1",
    ],
    {
      tags: [PUBLIC_WEEKEND_CACHE_TAG],
      revalidate: PUBLIC_WEEKEND_CACHE_REVALIDATE_SECONDS,
    },
  );

  const page = await cached();
  return applyWeekendPageEndedFilter(page, new Date());
}

export function invalidatePublicWeekendCache(): void {
  revalidateTag(PUBLIC_WEEKEND_CACHE_TAG, "max");
}
