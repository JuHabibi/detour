/**
 * Proportions verticales de la promenade /frise (expérimentation UX).
 *
 * Desktop cible ≈ 650–750 px ; mobile plafonné pour éviter un scroll page inutile.
 * Le paysage remplit la piste (mesure ResizeObserver) — pas de stretch des WebP.
 */

/** Classes Tailwind — hauteur de piste (border-box, padding vélo inclus). */
export const FRISE_TRACK_HEIGHT_CLASS =
  "h-[clamp(22rem,54dvh,28rem)] md:h-[clamp(38rem,74dvh,46.875rem)]";

/** Respiration basse pour la route / le vélo (dans la hauteur de piste). */
export const FRISE_TRACK_PB_CLASS = "pb-[4.75rem] md:pb-[6.75rem]";

/**
 * Bornes documentées (px @ 16px root) pour relecture QA.
 * 1440×900 → ~666 px · 1366×768 → 608 px (plancher) · 390×844 → ~448 px.
 */
export const FRISE_TRACK_HEIGHT_BOUNDS_PX = {
  mobileMin: 22 * 16,
  mobileMax: 28 * 16,
  desktopMin: 38 * 16,
  desktopMax: 46.875 * 16,
  desktopTargetMin: 650,
  desktopTargetMax: 750,
} as const;
