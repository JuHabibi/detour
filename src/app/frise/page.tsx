import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { DETOUR_CATEGORIES } from "@/domain/events/classify-event-category";
import type { DetourCategory } from "@/domain/events/classify-event-category";
import { accountLoginHref } from "@/features/account/safe-account-next-path";
import { FrisePageClient } from "@/features/frise/components/FrisePageClient";

export const metadata: Metadata = {
  title: "La promenade · Détour",
  description:
    "Prenez le temps de faire un détour : choisissez une catégorie, parcourez les prochaines semaines et gardez vos découvertes de côté.",
};

type FrisePageProps = {
  searchParams: Promise<{ category?: string | string[]; preview?: string | string[] }>;
};

function parseCategory(
  raw: string | string[] | undefined,
): DetourCategory | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  if ((DETOUR_CATEGORIES as readonly string[]).includes(value)) {
    return value as DetourCategory;
  }
  return null;
}

function friseReturnPath(category: DetourCategory | null): string {
  if (!category) return "/frise";
  return `/frise?category=${encodeURIComponent(category)}`;
}

export default async function FrisePage({ searchParams }: FrisePageProps) {
  const params = await searchParams;
  const initialCategory = parseCategory(params.category);
  const previewRaw = Array.isArray(params.preview)
    ? params.preview[0]
    : params.preview;
  /** Bypass auth en local uniquement — captures / QA prototype. */
  const allowDevPreview =
    process.env.NODE_ENV === "development" && previewRaw === "1";

  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated" && !allowDevPreview) {
    redirect(accountLoginHref(friseReturnPath(initialCategory)));
  }

  return <FrisePageClient initialCategory={initialCategory} />;
}
