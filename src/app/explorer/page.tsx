import type { Metadata } from "next";
import { loadExplorerPage } from "@/app/_server/load-explorer-page";
import { ExplorerPage } from "@/features/explorer/components/ExplorerPage";
import { buildExplorerMetadata } from "@/features/explorer/explorer-seo";
import { parseExplorerUrlState } from "@/features/explorer/explorer-url-state";

/** ISR 6h — aligné Data Cache Explorer ; invalidation principale = sync. */
export const revalidate = 21600;

type ExplorerRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: ExplorerRouteProps): Promise<Metadata> {
  return buildExplorerMetadata(await searchParams);
}

export default async function Page({ searchParams }: ExplorerRouteProps) {
  const params = await searchParams;
  const initialFilters = parseExplorerUrlState(params);
  const props = await loadExplorerPage(initialFilters);
  return <ExplorerPage {...props} />;
}
