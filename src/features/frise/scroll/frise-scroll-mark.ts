/**
 * Résolution du repère temporel frise à partir des marqueurs DOM
 * (mois / jours / respirations) — synchronisé au scroll, pas à la largeur décor.
 */

export type FriseScrollMark = {
  offsetLeft: number;
  offsetWidth: number;
  /** Clé mois civil Paris `YYYY-MM`. */
  monthKey: string;
  /** Libellé affiché, ex. `Octobre 2026`. */
  monthLabel: string;
  /** Détail local (jour ou respiration), optionnel. */
  detailLabel?: string;
};

export type FriseActiveMark = {
  monthKey: string;
  monthLabel: string;
  detailLabel: string | null;
};

/**
 * Marqueur le plus proche du point de lecture (défaut : 35 % de la largeur visible).
 * En cas d’égalité de distance, privilégie le marqueur le plus à gauche (stable).
 */
export function resolveActiveFriseMark(
  marks: readonly FriseScrollMark[],
  scrollLeft: number,
  clientWidth: number,
  focusRatio = 0.35,
): FriseActiveMark | null {
  if (marks.length === 0 || clientWidth <= 0) return null;

  const focusX = scrollLeft + clientWidth * clamp(focusRatio, 0, 1);
  let best: FriseScrollMark | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const mark of marks) {
    if (!mark.monthKey || !mark.monthLabel) continue;
    const mid = mark.offsetLeft + mark.offsetWidth / 2;
    const dist = Math.abs(mid - focusX);
    if (
      dist < bestDist ||
      (dist === bestDist &&
        best != null &&
        mark.offsetLeft < best.offsetLeft)
    ) {
      bestDist = dist;
      best = mark;
    }
  }

  if (!best) return null;
  return {
    monthKey: best.monthKey,
    monthLabel: best.monthLabel,
    detailLabel: best.detailLabel?.trim() ? best.detailLabel : null,
  };
}

/** Progression 0–1 du scroll horizontal (bornée). */
export function friseScrollProgress(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): number {
  const max = Math.max(1, scrollWidth - clientWidth);
  return Math.min(1, Math.max(0, scrollLeft / max));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
