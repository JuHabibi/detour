import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type AccountAuthLayoutProps = {
  children: ReactNode;
  /** Variante visuelle légère du collage (même asset). */
  variant: "login" | "signup";
};

/**
 * Composition desktop 2 colonnes :
 * formulaire à gauche | illustration plus proche, ancrée à gauche de sa colonne.
 */
export function AccountAuthLayout({
  children,
  variant,
}: AccountAuthLayoutProps) {
  const isLogin = variant === "login";

  return (
    <div className="grid min-w-0 grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:gap-10 2xl:gap-12">
      <div className="min-w-0 w-full max-w-md justify-self-start">
        {children}
      </div>

      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none relative hidden w-full max-w-[32rem] justify-self-start lg:block xl:max-w-[36rem]",
          isLogin ? "rotate-[1.5deg]" : "-rotate-[2deg]",
        )}
      >
        <Image
          src="/account-editorial-collage.jpg"
          alt=""
          width={800}
          height={800}
          sizes="(min-width: 1280px) 36rem, 32rem"
          className={cn(
            "h-auto w-full select-none",
            isLogin
              ? "object-contain object-center"
              : "object-contain object-[center_10%]",
          )}
          priority={false}
        />
      </div>
    </div>
  );
}
