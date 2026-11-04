import "server-only";

import type { PublicWeekendPage } from "@/application/weekend/get-public-weekend-page";
import { getCachedPublicWeekendPage } from "@/infrastructure/next-public-weekend-cache";

/** Prépare les données de `/[territoire]/ce-week-end` — hors session. */
export async function loadWeekendPage(): Promise<PublicWeekendPage> {
  return getCachedPublicWeekendPage();
}
