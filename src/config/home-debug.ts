/**
 * Debug home public — activé hors production uniquement.
 * Ne contrôle pas le moteur Radar / IA, seulement l’exposition UI.
 */
export function shouldExposeHomeDebug(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV !== "production";
}
