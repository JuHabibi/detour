import Link from "next/link";

type AccountSignedOutProps = {
  onSignInHref?: string;
  onSignUpHref?: string;
};

export function AccountSignedOut({
  onSignInHref = "/account/login",
  onSignUpHref = "/account/signup",
}: AccountSignedOutProps) {
  return (
    <div className="max-w-xl">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
        Mon compte
      </p>
      <h1 className="mt-4 font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink md:mt-5 md:text-[2.75rem] lg:text-[3rem]">
        Gardez ce qui mérite un détour.
      </h1>
      <p className="mt-5 max-w-md text-sm leading-6 text-cream-dim md:mt-6 md:text-[0.95rem] md:leading-7">
        Créez un compte pour retrouver vos favoris d’une session à l’autre, et
        les ajouter facilement à votre agenda.
      </p>

      <ul className="mt-8 space-y-3 text-sm text-cream-dim md:mt-10">
        <li className="flex gap-3">
          <span className="mt-2 size-1.5 shrink-0 bg-mint" aria-hidden />
          Retrouver vos sorties enregistrées
        </li>
        <li className="flex gap-3">
          <span className="mt-2 size-1.5 shrink-0 bg-mint" aria-hidden />
          Les conserver d’un appareil à l’autre
        </li>
        <li className="flex gap-3">
          <span className="mt-2 size-1.5 shrink-0 bg-mint" aria-hidden />
          Les ajouter à votre agenda (fichier ICS)
        </li>
      </ul>

      <div className="mt-10 flex flex-wrap gap-3 md:mt-12">
        <Link
          href={onSignInHref}
          className="inline-flex min-h-11 items-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam"
        >
          Se connecter
        </Link>
        <Link
          href={onSignUpHref}
          className="inline-flex min-h-11 items-center border border-line px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink"
        >
          Créer un compte
        </Link>
      </div>
    </div>
  );
}
