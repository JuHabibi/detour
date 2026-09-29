import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { FrisePageClient } from "@/features/frise/components/FrisePageClient";
import {
  friseReturnPath,
  parseFriseUrlState,
} from "@/features/frise/frise-url-state";
import { accountLoginHref } from "@/lib/safe-account-next-path";

export const metadata: Metadata = {
  title: "Mon parcours culturel · Détour",
  description:
    "Prenez le temps de faire un détour : parcourez les sorties à venir, vos favoris et vos carnets sur une même frise.",
};

type FrisePageProps = {
  searchParams: Promise<{
    view?: string | string[];
    category?: string | string[];
    notebookId?: string | string[];
    preview?: string | string[];
  }>;
};

export default async function FrisePage({ searchParams }: FrisePageProps) {
  const params = await searchParams;
  const state = parseFriseUrlState(params);
  const allowDevPreview =
    process.env.NODE_ENV === "development" && state.preview;

  const auth = await getAccountAuthState();
  if (auth.status !== "authenticated" && !allowDevPreview) {
    redirect(
      accountLoginHref(
        friseReturnPath({
          view: state.view,
          category: state.category,
          notebookId: state.notebookId,
        }),
      ),
    );
  }

  return (
    <FrisePageClient
      initialView={state.view}
      initialCategory={state.category}
      initialNotebookId={state.notebookId}
      user={
        auth.status === "authenticated"
          ? { name: auth.user.name, email: auth.user.email }
          : null
      }
    />
  );
}
