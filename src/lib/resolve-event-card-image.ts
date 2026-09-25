import type { DetourEvent } from "@/domain/events/event";
import { toSafeNextImageSrc } from "@/lib/safe-next-image";

/**
 * Placeholders Détour (assets locaux) — hors taxonomie produit.
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
  | "imageUrl"
  | "title"
  | "category"
  | "genre"
  | "imageCredit"
  | "imageLicense"
  | "imageSourceUrl"
>;

export type ResolvedEventCardImage = {
  image: string;
  imageCredit?: string;
  imageLicense?: string;
  imageSourceUrl?: string;
};

type FallbackSignals = Pick<DetourEvent, "title" | "category" | "genre">;

const CONCERT_RE =
  /\b(concert|musique|chorale|live|dj|apero[\s-]?concert)\b/u;
const SPECTACLE_RE = /\b(theatre|spectacle|humour|cirque|scene)\b/u;
const EXPOSITION_RE =
  /\b(exposition|expo|photo|photographie|galerie|arts)\b/u;

/**
 * Choisit un placeholder Détour à partir de signaux texte bruts
 * (category / genre / title). Conservatif : défaut = découverte.
 */
export function getEventFallbackImage(event: FallbackSignals): string {
  const haystack = normalizeSignals(event);

  if (CONCERT_RE.test(haystack)) return DETOUR_PLACEHOLDER.concert;
  if (SPECTACLE_RE.test(haystack)) return DETOUR_PLACEHOLDER.spectacle;
  if (EXPOSITION_RE.test(haystack)) return DETOUR_PLACEHOLDER.exposition;

  return DETOUR_PLACEHOLDER.decouverte;
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

  return { image: getEventFallbackImage(event) };
}

function isRealIllustrationSrc(src: string): boolean {
  if (!src.startsWith("/")) return true;
  return (
    !src.startsWith("/images/fallbacks/") &&
    !src.startsWith("/images/placeholders/") &&
    !src.startsWith("/placeholder/")
  );
}

function normalizeSignals(event: FallbackSignals): string {
  return [event.title, event.category, event.genre]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}
