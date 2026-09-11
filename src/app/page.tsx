import { loadHomePage } from "@/app/_server/load-home-page";
import { HomePage } from "@/features/home/components/HomePage";

export default async function Page() {
  const props = await loadHomePage();
  return <HomePage {...props} />;
}
