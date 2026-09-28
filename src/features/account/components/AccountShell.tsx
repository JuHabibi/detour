import { Header } from "@/components/layout/Header";

type AccountShellProps = {
  children: React.ReactNode;
  accountLabel?: string;
  /** Nav « Mon parcours culturel » — uniquement si connecté. */
  showFriseNav?: boolean;
  favoriteCount?: number;
};
export function AccountShell({
  children,
  accountLabel = "Se connecter",
  showFriseNav = false,
  favoriteCount = 0,
}: AccountShellProps) {
  return (
    <div className="min-h-screen bg-paper">
      <Header
        favoriteCount={favoriteCount}
        homeHref="/"
        accountHref="/account"
        accountLabel={accountLabel}
        showFriseNav={showFriseNav}
      />
      <main className="px-5 py-11 md:px-8 md:py-16 lg:px-12 lg:py-20 2xl:px-14 2xl:py-20 min-[1920px]:px-16">
        <div className="mx-auto min-w-0 max-w-[var(--detour-shell-max)]">
          {children}
        </div>
      </main>
    </div>
  );
}
