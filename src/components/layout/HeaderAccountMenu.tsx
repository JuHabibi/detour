"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { userInitials } from "@/components/layout/user-initials";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

export type HeaderAccountUser = {
  name: string;
  email: string;
};

type HeaderAccountMenuProps = {
  user: HeaderAccountUser;
};

/**
 * Avatar + menu personnel (carnets, favoris, déconnexion).
 * Fermeture : Échap, clic extérieur, navigation.
 */
export function HeaderAccountMenu({ user }: HeaderAccountMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const initials = userInitials(user.name, user.email);
  const displayName = user.name.trim() || user.email.trim() || "Compte";

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    setLogoutPending(true);
    setLogoutError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setLogoutError("Impossible de se déconnecter. Réessayez.");
        return;
      }
      setOpen(false);
      router.push("/account");
      router.refresh();
    } catch {
      setLogoutError("Impossible de se déconnecter. Réessayez.");
    } finally {
      setLogoutPending(false);
    }
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={`Menu compte — ${displayName}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-9 items-center justify-center rounded-full bg-ink text-[11px] font-medium uppercase tracking-[0.06em] text-foam transition-colors",
          "hover:bg-coral hover:text-ink",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          "sm:size-10 sm:text-[12px]",
          open && "bg-coral text-ink",
        )}
      >
        <span aria-hidden="true">{initials}</span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Compte"
          className="absolute right-0 z-50 mt-2 w-[min(17.5rem,calc(100vw-1.5rem))] border border-line bg-foam p-1 shadow-sm"
        >
          <div className="border-b border-line px-3 py-3">
            <p className="truncate font-display text-[1.05rem] tracking-tight text-ink">
              {displayName}
            </p>
            {user.email.trim() ? (
              <p className="mt-0.5 truncate text-[12px] text-sand">
                {user.email}
              </p>
            ) : null}
          </div>

          <div className="py-1">
            <MenuLink href="/account" onNavigate={() => setOpen(false)}>
              Mes carnets
            </MenuLink>
            <MenuLink href="/account#favoris" onNavigate={() => setOpen(false)}>
              Mes favoris
            </MenuLink>
          </div>

          <div className="border-t border-line py-1">
            <button
              type="button"
              role="menuitem"
              disabled={logoutPending}
              onClick={() => void handleLogout()}
              className="flex w-full items-center px-3 py-2.5 text-left text-[13px] text-sand transition-colors hover:bg-paper hover:text-ink focus-visible:bg-paper focus-visible:outline-none disabled:opacity-60"
            >
              {logoutPending ? "Déconnexion…" : "Se déconnecter"}
            </button>
            {logoutError ? (
              <p className="px-3 pb-2 text-sm text-coral" role="alert">
                {logoutError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="flex w-full items-center px-3 py-2.5 text-[13px] text-ink transition-colors hover:bg-paper focus-visible:bg-paper focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}
