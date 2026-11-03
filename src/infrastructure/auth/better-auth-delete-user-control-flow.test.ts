import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou contre une régression Better Auth : avec
 * `sendDeleteAccountVerification`, la suppression immédiate par session
 * fraîche ne doit jamais être atteinte (ordre du handler `/delete-user`).
 */
describe("Better Auth 1.7.4 deleteUser control flow", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "node_modules/better-auth/dist/api/routes/update-user.mjs",
    ),
    "utf8",
  );

  it("envoie l’email de vérification avant le check de session fraîche", () => {
    const sendIdx = source.indexOf(
      "if (ctx.context.options.user.deleteUser?.sendDeleteAccountVerification)",
    );
    const freshIdx = source.indexOf(
      "if (!ctx.body.password && ctx.context.sessionConfig.freshAge !== 0)",
    );
    const deleteIdx = source.indexOf(
      "await ctx.context.internalAdapter.deleteUser(session.user.id);",
    );

    expect(sendIdx).toBeGreaterThan(-1);
    expect(freshIdx).toBeGreaterThan(sendIdx);
    expect(deleteIdx).toBeGreaterThan(freshIdx);
  });

  it("vérifie le mot de passe avant toute suppression / envoi", () => {
    const passwordIdx = source.indexOf("if (ctx.body.password)");
    const sendIdx = source.indexOf(
      "if (ctx.context.options.user.deleteUser?.sendDeleteAccountVerification)",
    );
    expect(passwordIdx).toBeGreaterThan(-1);
    expect(passwordIdx).toBeLessThan(sendIdx);
  });

  it("exige une session + jeton lié au userId sur le callback", () => {
    expect(source).toContain("getSessionFromCtx(ctx");
    expect(source).toContain(
      "consumeVerificationValue(`delete-account-${ctx.query.token}`)",
    );
    expect(source).toContain("token.value !== session.user.id");
  });
});
