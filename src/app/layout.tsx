import type { Metadata } from "next";
import { Instrument_Serif, Newsreader, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  adjustFontFallback: true,
  // Poids réellement utilisés (UI) — évite de charger toute l’axe variable.
  weight: ["400", "500", "600"],
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  adjustFontFallback: true,
  // Pas d’italic dans l’UI actuelle — réduit fichiers + fenêtre de swap CLS.
  style: ["normal"],
  weight: ["400", "500", "600"],
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
  adjustFontFallback: true,
  style: ["normal"],
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
      className={`${sora.variable} ${newsreader.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper font-sans text-ink">{children}</body>
    </html>
  );
}
