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

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
