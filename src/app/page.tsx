import { loadHomePage } from "@/app/_server/load-home-page";
import { HomePage } from "@/features/home/components/HomePage";

/**
 * ISR de sécurité (6 h = 21600 s) — aligné PUBLIC_HOME_CACHE_REVALIDATE_SECONDS.
 * Invalidation principale = revalidatePath("/") post-sync.
 * Littéral numérique requis (analyse statique Next).
 */
export const revalidate = 21600;

export default async function Page() {
  const props = await loadHomePage();
  return <HomePage {...props} />;
}
