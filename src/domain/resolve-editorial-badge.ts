/**
 * Pastille éditoriale « Faites un détour » — une seule, priorité fixe.
 * Seuils sur l’échelle assessment 0–5 : « élevé » = ≥ 3.
 */

export const EDITORIAL_BADGE_THRESHOLD = 3;

export type EditorialBadge =
  | "À réserver"
  | "À anticiper"
  | "Passage rare"
  | "Fort potentiel"
  | "Pépite locale";

export type EditorialBadgeInput = {
  planningNeed?: number | null;
  localRarity?: number | null;
  likelyDemand?: number | null;
  missRisk?: number | null;
  /** registrationUrl présent sur l’événement. */
  hasRegistrationUrl: boolean;
};

/**
 * Priorité :
 * 1. planningNeed élevé + réservation → À réserver
 * 2. localRarity élevée → Passage rare
 * 3. planningNeed élevé → À anticiper
 * 4. likelyDemand élevée → Fort potentiel
 * 5. missRisk élevé → Pépite locale
 * sinon aucune pastille.
 */
export function resolveEditorialBadge(
  input: EditorialBadgeInput,
): EditorialBadge | null {
  const threshold = EDITORIAL_BADGE_THRESHOLD;
  const planningNeed = toScore(input.planningNeed);
  const localRarity = toScore(input.localRarity);
  const likelyDemand = toScore(input.likelyDemand);
  const missRisk = toScore(input.missRisk);

  if (planningNeed >= threshold && input.hasRegistrationUrl) {
    return "À réserver";
  }
  if (localRarity >= threshold) {
    return "Passage rare";
  }
  if (planningNeed >= threshold) {
    return "À anticiper";
  }
  if (likelyDemand >= threshold) {
    return "Fort potentiel";
  }
  if (missRisk >= threshold) {
    return "Pépite locale";
  }
  return null;
}

function toScore(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return value;
}
