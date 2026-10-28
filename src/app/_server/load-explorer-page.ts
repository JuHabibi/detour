import { getCachedPublicExplorerInitialPage } from "@/infrastructure/next-public-explorer-cache";

/**
 * Charge la page Explorer publique (cache) — sans session ni favoris.
 * Auth / favoris : hydratation client après paint.
 */
export async function loadExplorerPage() {
  const explorer = await getCachedPublicExplorerInitialPage();
  return { explorer };
}
