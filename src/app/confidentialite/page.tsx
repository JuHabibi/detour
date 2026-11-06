import type { Metadata } from "next";
import { ConfidentialitePage } from "@/features/legal/components/ConfidentialitePage";
import { buildConfidentialiteMetadata } from "@/features/legal/legal-seo";

export const metadata: Metadata = buildConfidentialiteMetadata();

/** Document légal statique — pas de données personnalisées. */
export default function ConfidentialiteRoute() {
  return <ConfidentialitePage />;
}
