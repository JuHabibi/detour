import Link from "next/link";
import type { ReactNode } from "react";
import { VintageBikeSvg } from "@/components/VintageBikeSvg";
import {
  accountLoginHref,
  accountSignupHref,
} from "@/lib/safe-account-next-path";

const FRISE_NEXT = "/frise";

/**
 * Encart public Home — avantages compte (vérifiés dans le code) + aperçu parcours culturel.
 * Radar / Explorer restent publics ; mon parcours culturel est réservé au compte.
 */
export function FriseAccountTeaser() {
  return (
    <section
      id="compte-frise"
      className="relative scroll-mt-20 border-t border-line bg-foam"
      aria-labelledby="compte-frise-title"
    >
      <div className="mx-auto grid max-w-[var(--detour-shell-max)] gap-10 px-5 py-12 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:items-center md:gap-12 md:px-10 md:py-16 lg:px-16 lg:py-20 2xl:px-20">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sand">
            Compte Détour
          </p>
          <h2
            id="compte-frise-title"
            className="mt-3 max-w-[18ch] font-display text-[1.85rem] leading-[1.05] tracking-tight text-ink md:text-[2.35rem]"
          >
            Mon parcours culturel, et le reste de votre compte.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-cream-dim md:text-[15px] md:leading-7">
            Radar et Explorer restent ouverts à tous. Avec un compte, vous
            gardez vos sorties et vous parcourez les mois à venir comme mon
            parcours culturel.
          </p>

          <ul className="mt-7 space-y-3.5 text-sm leading-6 text-cream-dim">
            <Benefit>
              <strong className="font-medium text-ink">Favoris</strong> —
              enregistrez une sortie et retrouvez-la sur vos appareils.
            </Benefit>
            <Benefit>
              <strong className="font-medium text-ink">Groupes personnels</strong>{" "}
              — organisez vos favoris (week-end, thématique…). Pas de partage
              collaboratif pour l’instant.
            </Benefit>
            <Benefit>
              <strong className="font-medium text-ink">Agenda</strong> — exportez
              un fichier calendrier <span className="whitespace-nowrap">(.ics)</span>{" "}
              à importer dans votre agenda. Pas de synchronisation automatique.
            </Benefit>
            <Benefit>
              <strong className="font-medium text-ink">Mon parcours culturel</strong> —
              parcours temporel sur ~3 mois, une catégorie à la fois, réservé au
              compte.
            </Benefit>
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={accountSignupHref(FRISE_NEXT)}
              className="inline-flex min-h-11 items-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam motion-reduce:transition-none"
            >
              Créer un compte
            </Link>
            <Link
              href={accountLoginHref(FRISE_NEXT)}
              className="inline-flex min-h-11 items-center border border-line bg-paper px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink/40 motion-reduce:transition-none"
            >
              Se connecter
            </Link>
          </div>
        </div>

        <div className="relative min-h-[16rem] overflow-hidden border border-line bg-paper md:min-h-[20rem]">
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
                <div className="border border-ink/10 bg-foam px-3 py-2 shadow-[2px_2px_0_rgb(17_17_17/0.06)]">
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

function Benefit({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 size-1.5 shrink-0 bg-coral" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
