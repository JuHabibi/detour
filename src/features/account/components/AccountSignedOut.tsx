import Link from "next/link";
import { VintageBikeSvg } from "@/components/VintageBikeSvg";
import {
  accountLoginHref,
  accountSignupHref,
} from "@/lib/safe-account-next-path";

type AccountSignedOutProps = {
  onSignInHref?: string;
  onSignUpHref?: string;
};

/**
 * Présentation /account non connectée — avantages compte + aperçu parcours.
 */
export function AccountSignedOut({
  onSignInHref = accountLoginHref("/account"),
  onSignUpHref = accountSignupHref("/account"),
}: AccountSignedOutProps) {
  return (
    <section aria-labelledby="account-guest-title">
      <div className="grid gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:items-center md:gap-12">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
            Votre espace Détour
          </p>
          <h1
            id="account-guest-title"
            className="mt-3 max-w-[16ch] font-display text-[2.1rem] leading-[1.02] tracking-tight text-ink md:text-[2.75rem] lg:text-[3rem]"
          >
            Vos découvertes, à votre façon.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-cream-dim md:text-[0.95rem] md:leading-7">
            Gardez les sorties qui vous intéressent, rassemblez-les dans vos
            carnets et retrouvez-les sur votre parcours culturel.
          </p>

          <ul className="mt-8 space-y-4 text-sm leading-6 text-cream-dim">
            <Benefit title="Favoris">
              Retrouvez vos découvertes sur tous vos appareils.
            </Benefit>
            <Benefit title="Carnets">
              Organisez vos idées de sorties dans quatre collections
              personnelles maximum.
            </Benefit>
            <Benefit title="Agenda">
              Exportez vos événements vers votre agenda au format ICS.
            </Benefit>
            <Benefit title="Parcours culturel">
              Explorez les mois à venir grâce à notre timeline illustrée.
            </Benefit>
          </ul>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={onSignUpHref}
              className="inline-flex min-h-11 items-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam"
            >
              Créer un compte
            </Link>
            <Link
              href={onSignInHref}
              className="inline-flex min-h-11 items-center border border-line bg-paper px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink"
            >
              Se connecter
            </Link>
          </div>
        </div>

        <div className="relative min-h-[16rem] overflow-hidden border border-line bg-foam md:min-h-[20rem]">
          <div
            aria-hidden
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "url(/images/editorial/explorer-paper-texture.webp)",
              backgroundSize: "cover",
            }}
          />
          <div className="relative z-[1] flex h-full flex-col justify-between p-5 md:p-7">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
                Aperçu
              </p>
              <p className="mt-2 font-editorial text-[1.85rem] leading-none tracking-tight text-ink md:text-[2.25rem]">
                Septembre – Novembre
              </p>
              <p className="mt-3 max-w-[22ch] text-sm leading-5 text-cream-dim">
                Mois, affiches, respirations calmes — le vélo indique où vous en
                êtes.
              </p>
            </div>
            <div className="mt-8 flex items-end justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="border border-ink/10 bg-paper px-3 py-2 shadow-[2px_2px_0_rgb(17_17_17/0.06)]">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-sand">
                    Spectacle
                  </p>
                  <p className="mt-1 font-display text-[1.05rem] font-semibold leading-tight text-ink">
                    Une sortie à repérer tôt
                  </p>
                </div>
                <p className="font-editorial text-sm italic text-sand">
                  Calme · quelques jours
                </p>
              </div>
              <VintageBikeSvg className="h-16 w-auto shrink-0 md:h-20" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Benefit({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 size-1.5 shrink-0 bg-coral" aria-hidden />
      <span>
        <strong className="font-medium uppercase tracking-[0.08em] text-ink">
          {title}
        </strong>
        <span className="mt-0.5 block">{children}</span>
      </span>
    </li>
  );
}
