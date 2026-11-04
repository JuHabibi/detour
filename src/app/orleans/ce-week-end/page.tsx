import type { Metadata } from "next";
import { loadWeekendPage } from "@/app/_server/load-weekend-page";
import { WeekendPage } from "@/features/weekend/components/WeekendPage";
import { buildWeekendMetadata } from "@/features/weekend/weekend-seo";

/** ISR 6h — aligné Data Cache week-end ; invalidation principale = sync. */
export const revalidate = 21600;

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadWeekendPage();
  return buildWeekendMetadata(page);
}

export default async function OrleansWeekendPage() {
  const page = await loadWeekendPage();
  return <WeekendPage page={page} />;
}
