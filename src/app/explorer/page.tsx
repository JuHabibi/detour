import { loadExplorerPage } from "@/app/_server/load-explorer-page";
import { ExplorerPage } from "@/features/explorer/components/ExplorerPage";

/** ISR 6h — aligné Data Cache Explorer ; invalidation principale = sync. */
export const revalidate = 21600;

export default async function Page() {
  const props = await loadExplorerPage();
  return <ExplorerPage {...props} />;
}
