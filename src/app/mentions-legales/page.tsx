import type { Metadata } from "next";
import { MentionsLegalesPage } from "@/features/legal/components/MentionsLegalesPage";
import { buildMentionsLegalesMetadata } from "@/features/legal/legal-seo";

export const metadata: Metadata = buildMentionsLegalesMetadata();

/** Document légal statique — pas de données personnalisées. */
export default function MentionsLegalesRoute() {
  return <MentionsLegalesPage />;
}
