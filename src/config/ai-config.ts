export type AiMode = "manual" | "auto";

export type AiDisplayMode = AiMode | "disabled";

export type AiConfig = {

  enabled: boolean;
  mode: AiMode;
  displayMode: AiDisplayMode;
};

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
