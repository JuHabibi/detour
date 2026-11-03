import { describe, expect, it, vi } from "vitest";
import {
  accountDeletedFlashClearCookieOptions,
  applyAccountDeletedFlashConsumption,
  resolveAccountDeletedStatus,
} from "@/features/account/components/auth/account-deleted-flash";
import { ACCOUNT_DELETED_FLASH_COOKIE } from "@/features/account/components/auth/account-deleted-path";

describe("resolveAccountDeletedStatus — flash à usage unique", () => {
  it("1er affichage : succès + consommation du flash", () => {
    const onConsume = vi.fn();
    const status = resolveAccountDeletedStatus({
      flashValue: "1",
      statusParam: undefined,
      onConsume,
    });
    expect(status).toBe("success");
    expect(onConsume).toHaveBeenCalledOnce();
  });

  it("rechargement sans flash : plus de succès", () => {
    const onConsume = vi.fn();
    const status = resolveAccountDeletedStatus({
      flashValue: undefined,
      statusParam: undefined,
      onConsume,
    });
    expect(status).toBe("unknown");
    expect(onConsume).not.toHaveBeenCalled();
  });

  it("simule requête 1 puis requête 2 après clear", () => {
    const jar = new Map<string, string>([
      [ACCOUNT_DELETED_FLASH_COOKIE, "1"],
    ]);

    const first = applyAccountDeletedFlashConsumption({
      flashValue: jar.get(ACCOUNT_DELETED_FLASH_COOKIE),
      clearFlash: () => {
        jar.delete(ACCOUNT_DELETED_FLASH_COOKIE);
      },
    });
    expect(first).toBe("success");
    expect(jar.has(ACCOUNT_DELETED_FLASH_COOKIE)).toBe(false);

    const second = applyAccountDeletedFlashConsumption({
      flashValue: jar.get(ACCOUNT_DELETED_FLASH_COOKIE),
      clearFlash: () => {
        jar.delete(ACCOUNT_DELETED_FLASH_COOKIE);
      },
    });
    expect(second).toBe("unknown");
  });

  it("?status=success forgeable n’active pas le succès sans flash", () => {
    expect(
      resolveAccountDeletedStatus({
        flashValue: undefined,
        statusParam: "success",
        onConsume: () => undefined,
      }),
    ).toBe("unknown");
  });

  it("clear cookie options : uniquement le flash, path /", () => {
    expect(accountDeletedFlashClearCookieOptions(false)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      secure: false,
    });
  });
});
