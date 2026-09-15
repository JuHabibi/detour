import { Header } from "@/components/layout/Header";

type AccountShellProps = {
  children: React.ReactNode;
  accountLabel?: string;
};
export function AccountShell({
  children,
  accountLabel = "Se connecter",
}: AccountShellProps) {
  return (
    <div className="min-h-screen bg-paper">
      <Header
        favoriteCount={0}
        homeHref="/"
        accountHref="/account"
        accountLabel={accountLabel}
      />
      <main className="px-5 py-11 md:px-8 md:py-16 lg:px-12 lg:py-20 2xl:px-14 2xl:py-20 min-[1920px]:px-16">
        <div className="mx-auto min-w-0 max-w-[var(--detour-shell-max)]">
          {children}
        </div>
      </main>
    </div>
  );
}
