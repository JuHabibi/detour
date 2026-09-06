export type DetourEventSourceMode = "live" | "database";

/**
 * Résout DETOUR_EVENT_SOURCE (server-only).
 * absent/vide/"live" → live ; "database" → database ; sinon erreur explicite.
 */
export function resolveDetourEventSourceMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): DetourEventSourceMode {
  const raw = env.DETOUR_EVENT_SOURCE?.trim();
  if (!raw) return "live";

  if (raw === "live") return "live";
  if (raw === "database") return "database";

  throw new Error(
    `Invalid DETOUR_EVENT_SOURCE=${JSON.stringify(raw)}. Expected "live" or "database".`,
  );
}
