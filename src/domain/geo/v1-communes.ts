/** Communes V1 ciblées — labels d’affichage / clés produit Explorer. */
export const V1_COMMUNES = [
  "Orléans",
  "Fleury-les-Aubrais",
  "Olivet",
  "Saint-Jean-de-Braye",
  "Saint-Jean-de-la-Ruelle",
  "Saint-Jean-le-Blanc",
  "Saran",
  "Chécy",
  "La Chapelle-Saint-Mesmin",
  "Semoy",
  "Ingré",
  "Saint-Pryvé-Saint-Mesmin",
  "Ormes",
  "Boigny-sur-Bionne",
  "Mardié",
] as const;

export type V1Commune = (typeof V1_COMMUNES)[number];

const V1_KEY_TO_LABEL = new Map<string, V1Commune>(
  V1_COMMUNES.map((label) => [normalizeV1CityKey(label), label]),
);

/**
 * Normalisation conservative pour matcher des variantes orthographiques
 * d’une même commune V1 — sans fusionner deux communes distinctes.
 */
export function normalizeV1CityKey(raw: string | null | undefined): string {
  if (!raw) return "";

  let value = raw.normalize("NFD").replace(/\p{M}/gu, "");
  value = value.toLowerCase();
  value = value.replace(/['’`]/g, " ");
  value = value.replace(/[-_/.,;:()]/g, " ");
  value = value.replace(/\s+/g, " ").trim();

  value = value.replace(/\bst\b/g, "saint");
  value = value.replace(/\bste\b/g, "sainte");

  return value.replace(/\s+/g, " ").trim();
}

/** Résout une ville brute vers une commune V1, ou null si hors périmètre. */
export function matchV1Commune(
  city: string | null | undefined,
): V1Commune | null {
  const key = normalizeV1CityKey(city);
  if (!key) return null;
  return V1_KEY_TO_LABEL.get(key) ?? null;
}

/** @deprecated Prefer `normalizeV1CityKey` — alias historique debug. */
export const normalizeCityKey = normalizeV1CityKey;
