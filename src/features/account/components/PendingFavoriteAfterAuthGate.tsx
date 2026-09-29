"use client";

import { Suspense } from "react";
import {
  PendingFavoriteAfterAuth,
} from "@/features/account/components/PendingFavoriteAfterAuth";

type Props = {
  enabled: boolean;
  onFavoriteSaved?: (eventId: string) => void;
};

/** Suspense requis pour `useSearchParams` (App Router). */
export function PendingFavoriteAfterAuthGate(props: Props) {
  return (
    <Suspense fallback={null}>
      <PendingFavoriteAfterAuth {...props} />
    </Suspense>
  );
}
