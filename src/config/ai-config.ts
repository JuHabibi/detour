export type AiMode = "manual" | "auto";

export type AiDisplayMode = AiMode | "disabled";

export type AiConfig = {
  /** Une clé API est disponible côté serveur. */
  enabled: boolean;
  /** Comportement effectif (manual | auto), même si disabled. */
  mode: AiMode;
  /** Valeur affichée debug : manual | auto | disabled. */
  displayMode: AiDisplayMode;
};

/**
 * Config IA centralisée — seule source de lecture des env liées au mode.
 *
 * Priorité DETOUR_AI_MODE si défini.
 * Sinon : production → auto ; preview Vercel / development → manual.
 */
export function getAiConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): AiConfig {
  const hasApiKey = Boolean(
    env.DETOUR_AI_API_KEY?.trim() || env.OPENAI_API_KEY?.trim(),
  );
  const mode = resolveAiMode(env);

  return {
    enabled: hasApiKey,
    mode,
    displayMode: hasApiKey ? mode : "disabled",
  };
}

function resolveAiMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): AiMode {
  const explicit = env.DETOUR_AI_MODE?.trim().toLowerCase();
  if (explicit === "manual" || explicit === "auto") {
    return explicit;
  }

  // Preview Vercel : pas d’IA auto par défaut.
  if (env.VERCEL_ENV === "preview") {
    return "manual";
  }

  if (env.NODE_ENV === "production") {
    return "auto";
  }

  return "manual";
}
