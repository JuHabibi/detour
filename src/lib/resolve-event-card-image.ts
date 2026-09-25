import type { DetourEvent } from "@/domain/events/event";
import { toSafeNextImageSrc } from "@/lib/safe-next-image";

/**
 * Placeholders Détour (assets locaux) — hors taxonomie produit.
 * Alignés sur le label / la catégorie déjà résolus pour la carte
 * (`resolveCategoryBadgeLabel` + catégorie produit), pas sur un second
 * scan indépendant du titre brut — évite badge SPECTACLE + image découverte.
 *
 * Utilisés seulement si l’illustration réelle est absente, filtrée
 * par l’allowlist next/image, ou déjà un fallback sync (ex. culture.svg).
 */
export const DETOUR_PLACEHOLDER = {
  concert: "/images/placeholders/detour-placeholder-concert.webp",
  spectacle: "/images/placeholders/detour-placeholder-spectacle.webp",
  exposition: "/images/placeholders/detour-placeholder-exposition.webp",
  decouverte: "/images/placeholders/detour-placeholder-decouverte.webp",
} as const;

export type EventCardImageFields = Pick<
  DetourEvent,
  "imageUrl" | "imageCredit" | "imageLicense" | "imageSourceUrl"
> & {
  /** Label affiché sur la carte (même source que le badge). */
  presentationLabel: string;
  /** Catégorie produit UI — repli si le label ne mappe pas. */
  productCategory?: string | null;
};

export type ResolvedEventCardImage = {
  image: string;
  imageCredit?: string;
  imageLicense?: string;
  imageSourceUrl?: string;
};

export type FallbackPresentation = {
  presentationLabel: string;
  productCategory?: string | null;
};

const CONCERT_RE =
  /\b(concert|musique|chorale|live|dj|apero[\s-]?concert)\b/u;
const SPECTACLE_RE =
  /\b(theatre|spectacle|humour|cirque|scene|cinema|projection|cine)\b/u;
const EXPOSITION_RE =
  /\b(exposition|expo|photo|photographie|galerie|arts)\b/u;

/**
 * Placeholder Détour depuis le label de présentation (prioritaire),
 * puis la catégorie produit. Défaut = découverte.
 */
export function getEventFallbackImage(
  presentation: FallbackPresentation,
): string {
  return (
    mapPresentationToPlaceholder(presentation.presentationLabel) ??
    mapPresentationToPlaceholder(presentation.productCategory ?? "") ??
    DETOUR_PLACEHOLDER.decouverte
  );
}

/**
 * Résout la src carte : image réelle allowlistée, sinon placeholder Détour.
 * Ne touche pas à la classification éditoriale ni aux données métier.
 */
export function resolveEventCardImage(
  event: EventCardImageFields,
): ResolvedEventCardImage {
  const safe = toSafeNextImageSrc(event.imageUrl);

  if (safe && isRealIllustrationSrc(safe)) {
    if (safe.startsWith("/")) {
      return { image: safe };
    }

    return {
      image: safe,
      ...(event.imageCredit?.trim()
        ? { imageCredit: event.imageCredit.trim() }
        : {}),
      ...(event.imageLicense?.trim()
        ? { imageLicense: event.imageLicense.trim() }
        : {}),
      ...(event.imageSourceUrl?.trim()
        ? { imageSourceUrl: event.imageSourceUrl.trim() }
        : {}),
    };
  }

  return {
    image: getEventFallbackImage({
      presentationLabel: event.presentationLabel,
      productCategory: event.productCategory,
    }),
  };
}

function mapPresentationToPlaceholder(raw: string): string | null {
  const normalized = normalizePresentation(raw);
  if (!normalized) return null;

  if (CONCERT_RE.test(normalized)) return DETOUR_PLACEHOLDER.concert;
  if (SPECTACLE_RE.test(normalized)) return DETOUR_PLACEHOLDER.spectacle;
  if (EXPOSITION_RE.test(normalized)) return DETOUR_PLACEHOLDER.exposition;

  return null;
}

function isRealIllustrationSrc(src: string): boolean {
  if (!src.startsWith("/")) return true;
  return (
    !src.startsWith("/images/fallbacks/") &&
    !src.startsWith("/images/placeholders/") &&
    !src.startsWith("/placeholder/")
  );
}

function normalizePresentation(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}
