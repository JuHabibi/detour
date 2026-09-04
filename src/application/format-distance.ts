
export function formatDistanceKm(distanceKm: number): string {
  if (distanceKm < 10) {
    const rounded = Math.round(distanceKm * 10) / 10;
    if (Number.isInteger(rounded)) {
      return `${rounded} km`;
    }
    return `${rounded.toFixed(1).replace(".", ",")} km`;
  }

  return `${Math.round(distanceKm)} km`;
}
