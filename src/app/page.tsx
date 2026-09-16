import { loadHomePage } from "@/app/_server/load-home-page";
import { HomePage } from "@/features/home/components/HomePage";

/** ISR 6h — aligné Data Cache Home ; invalidation principale = sync. */
export const revalidate = 21600;

export default async function Page() {
  const props = await loadHomePage();
  return <HomePage {...props} />;
}
