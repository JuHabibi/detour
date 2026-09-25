/**
 * Overrides éditoriaux temporaires — test utilisateur Radar « LE REGARD DÉTOUR ».
 * Expérimentation courte, pas un catalogue permanent.
 * Clés = identifiants stables OpenAgenda (`openagenda:<id>`).
 */
export const RADAR_PICK_REASON_OVERRIDES: Readonly<Record<string, string>> = {
  "openagenda:36101666":
    "Un spectacle où le papier prend vie en musique, porté par la compagnie Sans soucis.",
  "openagenda:96155797":
    "Quatre jours pour passer de l’autre côté de la caméra et s’essayer au cinéma d’horreur, entre improvisation, quiz et défis.",
  "openagenda:56369478":
    "Un voyage musical dans l’Amérique des années 20 et 30, entre ragtime, country blues et premiers accents du jazz, avec humour et groove.",
};

export function getRadarPickReasonOverride(
  eventId: string,
): string | null {
  const reason = RADAR_PICK_REASON_OVERRIDES[eventId];
  return reason?.trim() ? reason : null;
}
