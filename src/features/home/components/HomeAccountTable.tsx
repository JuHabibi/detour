import Image from "next/image";
import Link from "next/link";
import { Bookmark, Heart, Sparkles } from "lucide-react";
import { EVENT_META_ICON_STROKE } from "@/components/event/event-lucide-icons";
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

const SPACE_BENEFITS = [
  { label: "Favoris", Icon: Heart },
  { label: "Carnets", Icon: Bookmark },
] as const;

export function HomeAccountTable() {
  return (
    <section
      id="compte"
      aria-labelledby="home-account-table-title"
      className="relative z-[1] scroll-mt-20 overflow-visible border-t border-line bg-paper"
    >
      <div className="mx-auto max-w-[var(--detour-shell-max)] px-5 py-7 md:px-8 md:pb-8 md:pt-0 lg:px-12 lg:pb-9 2xl:px-14">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6 lg:gap-8">
          <div className="relative z-[2] min-w-0 md:max-w-[28rem] md:shrink-0 md:pt-6 lg:max-w-[30rem] lg:pt-12">
            <p className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-sand">
              <Sparkles
                aria-hidden
                className="size-3.5 shrink-0 text-coral"
                strokeWidth={EVENT_META_ICON_STROKE}
              />
              Votre espace Détour
            </p>
            <h2
              id="home-account-table-title"
              className="mt-3 max-w-[23ch] font-display text-[1.85rem] leading-[1.02] tracking-tight text-ink md:max-w-[22ch] md:text-[2.2rem] lg:text-[2.45rem]"
            >
              Gardez vos découvertes. Cultivez vos envies.
            </h2>
            <p className="mt-5 hidden max-w-[40ch] text-[0.95rem] leading-7 text-cream-dim md:block">
              Enregistrez vos événements favoris et organisez vos idées de
              sorties dans des carnets pour les retrouver facilement.
            </p>
            <BenefitsList className="mt-5 hidden md:flex" />
            <div className="mt-7 hidden flex-wrap items-center gap-x-5 gap-y-3 md:flex">
              <SignupLink />
              <LoginLink />
            </div>
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
            <p className="max-w-[40ch] text-sm leading-6 text-cream-dim">
              Enregistrez vos événements favoris et organisez vos idées de
              sorties dans des carnets pour les retrouver facilement.
            </p>
            <BenefitsList className="mt-4" />
            <div className="mt-6 flex flex-col gap-3">
              <SignupLink className="w-full justify-center" />
              <LoginLink className="w-full justify-center" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BenefitsList({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink",
        className,
      )}
    >
      {SPACE_BENEFITS.map(({ label, Icon }) => (
        <li key={label} className="inline-flex items-center gap-1.5">
          <Icon
            aria-hidden
            className="size-3.5 shrink-0 text-coral"
            strokeWidth={EVENT_META_ICON_STROKE}
          />
          <span>{label}</span>
        </li>
      ))}
    </ul>
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
      Créer mon compte
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
      Se connecter
    </Link>
  );
}
