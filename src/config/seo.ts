import { CITY } from "@/config/city";
import { isLegalPublisherReady } from "@/config/legal-publisher";
import { publicWeekendPath } from "@/config/public-weekend-path";
import { absoluteSiteUrl, PUBLIC_SITE_ORIGIN } from "@/config/site";

/** Copy SEO partagé — hors modèle Territory (§13.5). */
export const SITE_NAME = "Détour";

/** Champs Open Graph communs à réaffirmer sur les pages publiques. */
export const SITE_OPEN_GRAPH = {
  type: "website",
  locale: "fr_FR",
  siteName: SITE_NAME,
} as const;

export const HOME_SEO = {
  title: `Détour | Radar culturel local autour d’${CITY}`,
  description:
    "Repérez aujourd’hui ce que vous pourriez regretter de découvrir trop tard — concerts, spectacles et sorties autour d’Orléans.",
  canonicalPath: "/",
} as const;

export const EXPLORER_SEO = {
  title: "Explorer les sorties",
  description:
    `Parcourez concerts, spectacles et sorties autour d’${CITY} — filtrez par période, ville, catégorie ou recherche.`,
  canonicalPath: "/explorer",
} as const;

export const WEEKEND_SEO = {
  title: `Que faire à ${CITY} ce week-end ?`,
  description: `Sorties culturelles à ${CITY} et alentours pour le week-end — concerts, spectacles et idées concrètes, sans tout lister.`,
  canonicalPath: publicWeekendPath(),
  emptyDescription: `Aucune sortie culturelle pertinente n’est disponible pour le week-end à ${CITY} pour le moment. Parcourez Explorer pour élargir la recherche.`,
} as const;

export const FRISE_SEO = {
  title: "Mon parcours culturel",
  description:
    "Prenez le temps de faire un détour : parcourez les sorties à venir, vos favoris et vos carnets sur une même frise.",
} as const;

export const NOINDEX_ROBOTS = {
  index: false,
  follow: false,
} as const;

export const INDEX_ROBOTS = {
  index: true,
  follow: true,
} as const;

export const NOINDEX_FOLLOW_ROBOTS = {
  index: false,
  follow: true,
} as const;

export const PUBLIC_SITEMAP_PATHS = [
  "/",
  "/explorer",
  publicWeekendPath(),
  "/confidentialite",
] as const;

export function publicSitemapEntries() {
  const paths: string[] = [...PUBLIC_SITEMAP_PATHS];
  // Mentions légales seulement lorsque l’identité éditeur est confirmée.
  if (isLegalPublisherReady()) {
    paths.push("/mentions-legales");
  }
  return paths.map((pathname) => ({
    url: absoluteSiteUrl(pathname),
  }));
}

export function publicRobotsSitemapUrl(): string {
  return absoluteSiteUrl("/sitemap.xml");
}

export function publicRobotsHost(): string {
  return new URL(PUBLIC_SITE_ORIGIN).host;
}
