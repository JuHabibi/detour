export const BOUILLON_FALLBACK_DIR = "/images/fallbacks";
export const BOUILLON_FALLBACK_GENERIC = `${BOUILLON_FALLBACK_DIR}/culture.svg`;

export type BouillonFallbackSlug =
  | "concert"
  | "cinema"
  | "scene"
  | "danse"
  | "expo"
  | "culture";


export function resolveBouillonCategoryFallback(input: {
  category: string | null | undefined;
  title?: string | null;
}): { imageUrl: string; slug: BouillonFallbackSlug } {
  const slug = resolveFallbackSlug(input.category, input.title);
  if (slug === "culture") {
    return { imageUrl: BOUILLON_FALLBACK_GENERIC, slug };
  }

  return { imageUrl: BOUILLON_FALLBACK_GENERIC, slug };
}

function resolveFallbackSlug(
  category: string | null | undefined,
  title: string | null | undefined,
): BouillonFallbackSlug {
  const haystack = `${category ?? ""} ${title ?? ""}`.toLowerCase();

  if (/cin[eé]ma|film|projection/.test(haystack)) return "cinema";
  if (/danse|ballet/.test(haystack)) return "danse";
  if (/expo|exposition|mus[eé]e/.test(haystack)) return "expo";
  if (/th[eé][aâ]tre|spectacle(?!\s*\/\s*concert)|sc[eè]ne/.test(haystack)) {
    return "scene";
  }
  if (/concert|musique|spectacle\s*\/\s*concert|ap[eé]ro-concert/.test(haystack)) {
    return "concert";
  }
  return "culture";
}
