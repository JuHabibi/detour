import { loadExplorerPage } from "@/app/_server/load-explorer-page";
import { ExplorerPage } from "@/features/explorer/components/ExplorerPage";
import { parseExplorerUrlState } from "@/features/explorer/explorer-url-state";

/** ISR 6h — aligné Data Cache Explorer ; invalidation principale = sync. */
export const revalidate = 21600;

type ExplorerRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: ExplorerRouteProps) {
  const params = await searchParams;
  const initialFilters = parseExplorerUrlState(params);
  const props = await loadExplorerPage(initialFilters);
  return <ExplorerPage {...props} />;
}
