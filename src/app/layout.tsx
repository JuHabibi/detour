import type { Metadata } from "next";
import { Fraunces, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Détour — Radar culturel local autour d’Orléans",
  description:
    "Repérez aujourd’hui ce que vous pourriez regretter de découvrir trop tard — concerts, spectacles et sorties autour d’Orléans.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${sora.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper font-sans text-ink">{children}</body>
    </html>
  );
}
