import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** Garde-fous frontière — docs/architecture.md (§13). Dettes documentées hors scope. */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // Domain prod : pas d’app / UI / infra / Next.
  // Tests exclus (ex. Mapado dans event-availability.test.ts).
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    ignores: ["src/domain/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next",
              message:
                "Domain must stay free of Next.js. Keep framework details outside domain/.",
            },
          ],
          patterns: [
            {
              group: ["@/app", "@/app/*", "@/app/**"],
              message:
                "Domain must not import app/. Keep Next pages/actions outside domain/.",
            },
            {
              group: ["@/components", "@/components/*", "@/components/**"],
              message:
                "Domain must not import components/. Keep UI outside domain/.",
            },
            {
              group: [
                "@/infrastructure",
                "@/infrastructure/*",
                "@/infrastructure/**",
              ],
              message:
                "Domain must not import infrastructure/. Depend on domain contracts only.",
            },
            {
              group: ["next/*"],
              message:
                "Domain must stay free of Next.js. Keep framework details outside domain/.",
            },
          ],
        },
      ],
    },
  },

  // Application prod : pas de components (frontière déjà corrigée).
  {
    files: ["src/application/**/*.{ts,tsx}"],
    ignores: ["src/application/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components", "@/components/*", "@/components/**"],
              message:
                "Application must not import components/. UI depends on application, not the reverse.",
            },
          ],
        },
      ],
    },
  },

  // AI applicatif déjà migrée : pas de retour vers infrastructure/.
  // Tests exclus (constantes OpenAI pour stabilité des clés).
  {
    files: ["src/application/ai/**/*.{ts,tsx}"],
    ignores: ["src/application/ai/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components", "@/components/*", "@/components/**"],
              message:
                "Application must not import components/. UI depends on application, not the reverse.",
            },
            {
              group: [
                "@/infrastructure",
                "@/infrastructure/*",
                "@/infrastructure/**",
              ],
              message:
                "application/ai must not import infrastructure/. Wire OpenAI/Next in infrastructure or app composition.",
            },
          ],
        },
      ],
    },
  },

  // Components : pas d’infrastructure (composition / loaders / application).
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/infrastructure",
                "@/infrastructure/*",
                "@/infrastructure/**",
              ],
              message:
                "Components must not import infrastructure/. Use app loaders/actions and application contracts.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
