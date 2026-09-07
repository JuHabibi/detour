export type GeoPoint = {
  latitude: number;
  longitude: number;
};

/**
 * Point de référence géographique temporaire du POC Détour.
 * Centre d’Orléans (Place du Martroi / hypercentre) — ce n’est PAS
 * la position de l’utilisateur. Remplacé plus tard par une vraie
 * ancre locale / géolocalisation.
 */
export const ORLEANS_CENTER: GeoPoint = {
  latitude: 47.9025,
  longitude: 1.909,
};

/**
 * Centres de communes — fallback distance si l’événement n’a pas de coords.
 * Clés normalisées (minuscules, sans accents).
 */
export const CITY_CENTER_FALLBACKS: Record<string, GeoPoint> = {
  // Mairie / hypercentre approximatif de Saran (Loiret)
  saran: { latitude: 47.951, longitude: 1.877 },
  // Mairie / centre approximatif d'Ingré (Loiret) — fallback distance uniquement
  ingre: { latitude: 47.9208, longitude: 1.8235 },
};

const EARTH_RADIUS_KM = 6371;

/** Distance orthodromique (Haversine) entre deux points, en kilomètres. */
export function distanceKmBetween(a: GeoPoint, b: GeoPoint): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

/**
 * Coords événement si présentes, sinon centre de commune connu, sinon null.
 */
export function resolveEventCoordinates(event: {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
}): GeoPoint | null {
  if (event.latitude != null && event.longitude != null) {
    return { latitude: event.latitude, longitude: event.longitude };
  }

  const cityKey = normalizeCityKey(event.city);
  if (!cityKey) return null;
  return CITY_CENTER_FALLBACKS[cityKey] ?? null;
}

export function normalizeCityKey(city: string | null | undefined): string {
  if (!city) return "";
  return city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
