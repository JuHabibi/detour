/**
 * Proportions verticales de la promenade /frise (expérimentation UX).
 *
 * Desktop cible ≈ 650–750 px ; mobile un peu plus haut pour 1 carte + bouton
 * au-dessus de la route, sous le chip « Vous parcourez ».
 * Le paysage remplit la piste (mesure ResizeObserver) — pas de stretch des WebP.
 */

/** Classes Tailwind — hauteur de piste (border-box, padding vélo inclus). */
export const FRISE_TRACK_HEIGHT_CLASS =
  "h-[clamp(26rem,62dvh,32rem)] md:h-[clamp(38rem,74dvh,46.875rem)]";

/** Respiration basse pour la route / le vélo (dans la hauteur de piste). */
export const FRISE_TRACK_PB_CLASS = "pb-[4.75rem] md:pb-[6.75rem]";

/**
 * Espace sous le chip « Vous parcourez » pour laisser la date du jour lisible.
 * Aligné sur MonthMilestone (pt-20) en mobile.
 */
export const FRISE_DAY_MARK_PT_CLASS = "pt-[5.25rem] md:pt-2";

/**
 * Bornes documentées (px @ 16px root) pour relecture QA.
 * 1440×900 → ~666 px · 1366×768 → 608 px (plancher) · 390×844 → ~523 px.
 */
export const FRISE_TRACK_HEIGHT_BOUNDS_PX = {
  mobileMin: 26 * 16,
  mobileMax: 32 * 16,
  desktopMin: 38 * 16,
  desktopMax: 46.875 * 16,
  desktopTargetMin: 650,
  desktopTargetMax: 750,
} as const;
