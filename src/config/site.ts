/**
 * Origine publique de référence (SEO, canonical, sitemap, Open Graph).
 *
 * Alignée sur `BETTER_AUTH_URL` production documentée dans `.env.example`
 * et `docs/architecture.md` — ne pas dériver de `VERCEL_URL` (previews).
 */
export const PUBLIC_SITE_ORIGIN = "https://detour.website" as const;

export function absoluteSiteUrl(pathname = "/"): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  // Aligné sur metadataBase Next (`canonical: "/"` → https://detour.website).
  if (path === "/") return PUBLIC_SITE_ORIGIN;
  return `${PUBLIC_SITE_ORIGIN}${path.replace(/\/+$/, "")}`;
}
