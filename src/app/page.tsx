import type { Metadata } from "next";
import { loadHomePage } from "@/app/_server/load-home-page";
import { HOME_SEO, INDEX_ROBOTS } from "@/config/seo";
import { HomePage } from "@/features/home/components/HomePage";

/** ISR 6h — aligné Data Cache Home ; invalidation principale = sync. */
export const revalidate = 21600;

export const metadata: Metadata = {
  title: {
    absolute: HOME_SEO.title,
  },
  description: HOME_SEO.description,
  alternates: {
    canonical: HOME_SEO.canonicalPath,
  },
  robots: INDEX_ROBOTS,
  openGraph: {
    title: HOME_SEO.title,
    description: HOME_SEO.description,
    url: HOME_SEO.canonicalPath,
  },
};

export default async function Page() {
  const props = await loadHomePage();
  return <HomePage {...props} />;
}
