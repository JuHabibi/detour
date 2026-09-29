"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addFavorite } from "@/app/actions/favorites";
import {
  clearPendingFavoriteIntent,
  readPendingFavoriteIntent,
  resolvePendingFavoriteEventId,
  stripPendingFavoriteFromPath,
} from "@/lib/pending-favorite";

type PendingFavoriteAfterAuthProps = {
  /** True lorsque la session est authentifiée. */
  enabled: boolean;
  /** Notifie le parent pour hydrater le cœur localement. */
  onFavoriteSaved?: (eventId: string) => void;
};

/**
 * Traitement post-auth partagé : lit l’intention (URL + sessionStorage),
 * ajoute le favori de façon idempotente, nettoie, confirme.
 */
export function PendingFavoriteAfterAuth({
  enabled,
  onFavoriteSaved,
}: PendingFavoriteAfterAuthProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [notice, setNotice] = useState<string | null>(null);
  const ranKey = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      ranKey.current = null;
      return;
    }

    const eventId = resolvePendingFavoriteEventId(searchParams);
    if (!eventId) return;

    const runKey = eventId;
    if (ranKey.current === runKey) return;
    ranKey.current = runKey;

    const stored = readPendingFavoriteIntent();
    const preferredReturn =
      stored?.eventId === eventId
        ? stripPendingFavoriteFromPath(stored.returnPath)
        : null;

    let active = true;

    void addFavorite(eventId).then((result) => {
      if (!active) return;

      clearPendingFavoriteIntent();

      const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      const cleanedCurrent = stripPendingFavoriteFromPath(current);

      if (!result.ok) {
        if (result.reason === "unauthenticated") {
          ranKey.current = null;
          return;
        }
        if (cleanedCurrent !== current) {
          router.replace(cleanedCurrent, { scroll: false });
        }
        setNotice(
          "Impossible d’enregistrer ce détour. Réessayez depuis la fiche.",
        );
        return;
      }

      onFavoriteSaved?.(eventId);

      const target =
        preferredReturn && preferredReturn !== cleanedCurrent
          ? preferredReturn
          : cleanedCurrent;

      if (target !== current) {
        router.replace(target, { scroll: false });
      }

      setNotice("Événement enregistré dans vos favoris.");
    });

    return () => {
      active = false;
    };
  }, [enabled, onFavoriteSaved, pathname, router, searchParams]);

  if (!notice) return null;

  return (
    <div className="border-b border-line bg-mint-soft/40 px-5 py-3 md:px-8 lg:px-12 2xl:px-14 min-[1920px]:px-16">
      <div className="mx-auto flex max-w-[var(--detour-shell-max)] flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink" role="status">
          {notice}
        </p>
        <button
          type="button"
          onClick={() => setNotice(null)}
          className="text-[12px] text-sand underline decoration-line underline-offset-4 hover:text-ink"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
