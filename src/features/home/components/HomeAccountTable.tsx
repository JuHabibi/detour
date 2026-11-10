import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  accountLoginHref,
  accountSignupHref,
} from "@/lib/safe-account-next-path";

const CABINET_AFFICHE = {
  src: "/images/editorial/detour-account-cabinet-affiche.webp",
  width: 864,
  height: 1100,
} as const;

const AFFICHE_SPACER_PB =
  "calc((1100 / 864) * 100% - clamp(9rem, 14vw, 12rem))";
const AFFICHE_BLEED_TRANSLATE = "md:-translate-y-[clamp(9rem,14vw,12rem)]";

type HomeAccountTableProps = {
  /** Entrée prototype locale — simule une connexion sans Better Auth. */
  onTryPrototype?: () => void;
};

export function HomeAccountTable({ onTryPrototype }: HomeAccountTableProps) {
  return (
    <section
      id="compte"
      aria-labelledby="home-account-table-title"
      className="relative z-[1] scroll-mt-20 overflow-visible border-t border-line bg-paper"
    >
      <div className="mx-auto max-w-[var(--detour-shell-max)] px-5 py-7 md:px-8 md:pb-8 md:pt-0 lg:px-12 lg:pb-9 2xl:px-14">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6 lg:gap-8">
          <div className="relative z-[2] min-w-0 md:max-w-[26rem] md:shrink-0 md:pt-6 lg:max-w-[28rem] lg:pt-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
              Découvertes pour vous
            </p>
            <h2
              id="home-account-table-title"
              className="mt-3 max-w-[15ch] font-display text-[1.85rem] leading-[1.02] tracking-tight text-ink md:max-w-[14ch] md:text-[2.2rem] lg:text-[2.45rem]"
            >
              Affinez vos sorties selon ce qui vous parle.
            </h2>
            <p className="mt-5 hidden max-w-[36ch] text-[0.95rem] leading-7 text-cream-dim md:block">
              Créez un compte pour indiquer vos envies, vos créneaux et votre
              budget. Détour pourra alors proposer une sélection « Pour vous »,
              en complément du Radar — sans rien imposer.
            </p>
            <div className="mt-7 hidden flex-wrap items-center gap-x-5 gap-y-3 md:flex">
              <SignupLink />
              <LoginLink />
            </div>
            {onTryPrototype ? (
              <div className="mt-4 hidden md:block">
                <PrototypeLink onClick={onTryPrototype} />
              </div>
            ) : null}
          </div>

          <figure
            className={cn(
              "relative w-full max-w-[15rem] shrink-0 overflow-visible",
              "md:pointer-events-none md:max-w-none md:w-[48%]",
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none hidden w-full md:block"
              style={{ paddingBottom: AFFICHE_SPACER_PB }}
            />
            <Image
              src={CABINET_AFFICHE.src}
              alt="Illustration Détour : un carnet d’envies, une affiche culturelle et un vélo sur le chemin."
              width={CABINET_AFFICHE.width}
              height={CABINET_AFFICHE.height}
              sizes="(max-width: 767px) 15rem, 48vw"
              quality={92}
              className={cn(
                "h-auto w-full select-none",
                "md:absolute md:left-0 md:top-0 md:w-full",
                AFFICHE_BLEED_TRANSLATE,
                "motion-reduce:md:translate-y-0",
              )}
            />
          </figure>

          <div className="relative z-[2] md:hidden">
            <p className="max-w-[36ch] text-sm leading-6 text-cream-dim">
              Créez un compte pour indiquer vos envies, vos créneaux et votre
              budget. Détour pourra alors proposer une sélection « Pour vous »,
              en complément du Radar — sans rien imposer.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <SignupLink className="w-full justify-center" />
              <LoginLink className="w-full justify-center" />
              {onTryPrototype ? (
                <PrototypeLink
                  onClick={onTryPrototype}
                  className="w-full justify-center"
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SignupLink({ className }: { className?: string }) {
  return (
    <Link
      href={accountSignupHref("/account")}
      className={cn(
        "inline-flex min-h-11 items-center bg-mint px-5 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        className,
      )}
    >
      Personnaliser mes découvertes
    </Link>
  );
}

function LoginLink({ className }: { className?: string }) {
  return (
    <Link
      href={accountLoginHref("/account")}
      className={cn(
        "inline-flex min-h-11 items-center text-[12px] font-medium uppercase tracking-[0.1em] text-sand underline decoration-line underline-offset-4 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        className,
      )}
    >
      J’ai déjà un compte
    </Link>
  );
}

function PrototypeLink({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center text-[12px] font-medium uppercase tracking-[0.1em] text-sand underline decoration-line underline-offset-4 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        className,
      )}
    >
      Tester sans compte (prototype)
    </button>
  );
}
