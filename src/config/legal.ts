import { SITE_NAME } from "@/config/seo";
import { PUBLIC_SITE_ORIGIN } from "@/config/site";
import {
  isLegalPublisherReady,
  legalPublisher,
  type LegalPublisher,
} from "@/config/legal-publisher";

export type { LegalPublisher };
export { legalPublisher, isLegalPublisherReady };

/** Hébergeur du site — coordonnées publiques Vercel Inc. (privacy notice Vercel). */
export const LEGAL_HOST = {
  name: "Vercel Inc.",
  addressLines: [
    "440 N Barranca Avenue #4133",
    "Covina, CA 91723",
    "États-Unis",
  ],
  website: "https://vercel.com",
} as const;

export const LEGAL_SITE = {
  name: SITE_NAME,
  origin: PUBLIC_SITE_ORIGIN,
} as const;

export const MENTIONS_LEGALES_PATH = "/mentions-legales" as const;
export const CONFIDENTIALITE_PATH = "/confidentialite" as const;

export const MENTIONS_LEGALES_SEO = {
  title: "Mentions légales",
  description: `Mentions légales du site ${SITE_NAME} — éditeur, hébergeur et informations réglementaires.`,
  canonicalPath: MENTIONS_LEGALES_PATH,
} as const;

export const CONFIDENTIALITE_SEO = {
  title: "Confidentialité",
  description: `Politique de confidentialité de ${SITE_NAME} — comptes, favoris, cookies nécessaires et prestataires.`,
  canonicalPath: CONFIDENTIALITE_PATH,
} as const;
