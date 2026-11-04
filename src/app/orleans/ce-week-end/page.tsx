import type { Metadata } from "next";
import { loadWeekendPage } from "@/app/_server/load-weekend-page";
import { WeekendPage } from "@/features/weekend/components/WeekendPage";
import { buildWeekendMetadata } from "@/features/weekend/weekend-seo";

/**
 * Pas d’ISR Full Route Cache : le HTML / les métadonnées doivent suivre le
 * week-end civil Europe/Paris dès le lundi (dimanche → lundi).
 * Le coût SQL reste borné par le Data Cache (`saturdayKey` + tag sync).
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadWeekendPage();
  return buildWeekendMetadata(page);
}

export default async function OrleansWeekendPage() {
  const page = await loadWeekendPage();
  return <WeekendPage page={page} />;
}
