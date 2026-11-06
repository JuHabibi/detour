import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { SiteFooter } from "@/components/layout/SiteFooter";

type LegalDocumentShellProps = {
  title: string;
  lead: string;
  children: ReactNode;
};

/**
 * Coquille serveur pour les documents légaux publics.
 * Pas de JS client dédié — Header gère sa propre hydratation.
 */
export function LegalDocumentShell({
  title,
  lead,
  children,
}: LegalDocumentShellProps) {
  return (
    <div className="flex min-h-full flex-col">
      <Header homeHref="/" favoriteCount={0} />
      <main className="mx-auto w-full max-w-[var(--detour-shell-max)] flex-1 px-5 py-12 md:px-8 md:py-16 lg:px-12 2xl:px-14 min-[1920px]:px-16">
        <article className="mx-auto max-w-2xl">
          <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">
            {title}
          </h1>
          <p className="mt-5 text-sm leading-6 text-sand md:text-base md:leading-7">
            {lead}
          </p>
          <div className="mt-10 space-y-10 text-sm leading-6 text-ink md:mt-12 md:text-[15px] md:leading-7">
            {children}
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-editorial text-xl text-ink md:text-2xl">{title}</h2>
      <div className="space-y-3 text-sand [&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:decoration-mint/70 [&_a]:decoration-2 [&_a]:underline-offset-4 [&_strong]:font-medium [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
