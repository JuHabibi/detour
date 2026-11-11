import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FavoriteAuthModal } from "@/components/favorites/FavoriteAuthModal";
import { AccountLogin } from "@/features/account/components/auth/AccountLogin";
import { AccountSignup } from "@/features/account/components/auth/AccountSignup";
import { HomeAccountTable } from "@/features/home/components/HomeAccountTable";
import {
  accountLoginHref,
  accountSignupHref,
} from "@/lib/safe-account-next-path";
import { pathWithPendingFavorite } from "@/lib/pending-favorite";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: function MockLink({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: React.ReactNode;
    className?: string;
  }) {
    return createElement("a", { href, ...rest }, children);
  },
}));

vi.mock("next/image", () => ({
  default: function MockImage(props: {
    alt?: string;
    src?: string | { src: string };
  }) {
    const src =
      typeof props.src === "string" ? props.src : (props.src?.src ?? "");
    return createElement("img", { alt: props.alt ?? "", src });
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: { email: vi.fn() },
    signIn: { email: vi.fn(), social: vi.fn() },
  },
}));

vi.mock("@/lib/use-stacked-dialog-lifecycle", () => ({
  useStackedDialogLifecycle: () => undefined,
}));

describe("entrées création de compte", () => {
  it("Home et Favoris mènent au formulaire signup ; /account redirige vers login", () => {
    expect(accountLoginHref("/account")).toBe(
      "/account/login?next=%2Faccount",
    );

    const homeHtml = renderToStaticMarkup(createElement(HomeAccountTable));
    expect(homeHtml).toContain(
      "Gardez vos découvertes. Cultivez vos envies.",
    );
    expect(homeHtml).toContain("Créer mon compte");
    expect(homeHtml).toContain("Se connecter");
    expect(homeHtml).not.toContain("gratuitement");
    expect(homeHtml).toContain(`href="${accountSignupHref("/account")}"`);
    expect(homeHtml).toContain(`href="${accountLoginHref("/account")}"`);
    expect(homeHtml).toContain(
      "Enregistrez vos événements favoris, organisez vos idées de",
    );

    const favoriteNext = pathWithPendingFavorite("openagenda:42", "/");
    const favoriteHtml = renderToStaticMarkup(
      createElement(FavoriteAuthModal, {
        eventId: "openagenda:42",
        returnPath: "/",
        onClose: () => undefined,
      }),
    );
    expect(favoriteHtml).toContain("Gardez cette découverte.");
    expect(favoriteHtml).toContain("Créer mon compte");
    expect(favoriteHtml).toContain("J’ai déjà un compte");
    expect(favoriteHtml).toContain(
      `href="${accountSignupHref(favoriteNext)}"`,
    );
    expect(favoriteHtml).toContain(`href="${accountLoginHref(favoriteNext)}"`);
    expect(favoriteHtml).toContain("garder cette découverte");
  });

  it("préserve next (dont addFavorite) entre inscription et connexion", () => {
    const pendingNext = pathWithPendingFavorite("e1", "/explorer");

    const signupHtml = renderToStaticMarkup(
      createElement(AccountSignup, { nextPath: pendingNext }),
    );
    expect(signupHtml).toContain(
      "Créez votre compte pour enregistrer cet événement dans vos favoris.",
    );
    expect(signupHtml).toContain("Déjà un compte ?");
    expect(signupHtml).toContain(">Se connecter<");
    expect(signupHtml).not.toContain("Déjà inscrit ?");
    expect(signupHtml).not.toContain("J’ai déjà un compte");
    expect(signupHtml).toContain(`href="${accountLoginHref(pendingNext)}"`);
    expect(signupHtml).toContain('href="/confidentialite"');
    expect(signupHtml).toContain("politique de confidentialité");
    expect(signupHtml).not.toContain("J’accepte la politique");

    const loginHtml = renderToStaticMarkup(
      createElement(AccountLogin, { nextPath: pendingNext }),
    );
    expect(loginHtml).toContain(
      "Connectez-vous pour ajouter cet événement à vos favoris.",
    );
    expect(loginHtml).toContain(`href="${accountSignupHref(pendingNext)}"`);
  });

  it("omet next=/account dans les bascules, conserve le lead signup par défaut", () => {
    const signupHtml = renderToStaticMarkup(
      createElement(AccountSignup, { nextPath: "/account" }),
    );
    expect(signupHtml).toContain(
      "Un compte pour garder vos découvertes et les organiser dans vos carnets.",
    );
    expect(signupHtml).toContain("Déjà un compte ?");
    expect(signupHtml).toContain('href="/account/login"');
    expect(signupHtml).toContain(">Se connecter<");
    expect(signupHtml).not.toContain("next=");

    const loginHtml = renderToStaticMarkup(
      createElement(AccountLogin, { nextPath: "/account" }),
    );
    expect(loginHtml).toContain('href="/account/signup"');
    expect(loginHtml).not.toContain("next=");
  });

  it("conserve le lead Frise sur le formulaire d’inscription", () => {
    const html = renderToStaticMarkup(
      createElement(AccountSignup, { nextPath: "/frise" }),
    );
    expect(html).toContain(
      "Un compte pour mon parcours culturel, vos favoris, et l’export calendrier en fichier .ics.",
    );
    expect(html).toContain(`href="${accountLoginHref("/frise")}"`);
  });

  it("affiche Continuer avec Google seulement si googleEnabled", () => {
    const without = renderToStaticMarkup(
      createElement(AccountLogin, { nextPath: "/account" }),
    );
    expect(without).not.toContain("Continuer avec Google");

    const login = renderToStaticMarkup(
      createElement(AccountLogin, {
        nextPath: "/explorer?addFavorite=e1",
        googleEnabled: true,
      }),
    );
    expect(login).toContain("Continuer avec Google");
    expect(login).toContain("Se connecter");

    const signup = renderToStaticMarkup(
      createElement(AccountSignup, {
        nextPath: "/explorer?addFavorite=e1",
        googleEnabled: true,
        initialOAuthError: "Un compte existe déjà avec cet email.",
      }),
    );
    expect(signup).toContain("Continuer avec Google");
    expect(signup).toContain("Un compte existe déjà avec cet email.");
  });
});
