/**
 * Hosts autorisés pour `next/image` — garder aligné avec `next.config.ts`
 * `images.remotePatterns`.
 */
export const NEXT_IMAGE_REMOTE_HOSTS = [
  "images.unsplash.com",
  "img.openagenda.com",
  "upload.wikimedia.org",
] as const;

const REMOTE_HOST_SET = new Set<string>(NEXT_IMAGE_REMOTE_HOSTS);

/**
 * Retourne une src utilisable par `next/image`, ou null si l’URL
 * pointe vers un host non configuré (ex. anciennes images Billetweb).
 */
export function toSafeNextImageSrc(
  imageUrl: string | null | undefined,
): string | null {
  if (!imageUrl) return null;
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/")) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    if (!REMOTE_HOST_SET.has(parsed.hostname)) return null;
    return trimmed;
  } catch {
    return null;
  }
}
