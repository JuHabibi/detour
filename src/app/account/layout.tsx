import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NOINDEX_ROBOTS } from "@/config/seo";

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  return children;
}
