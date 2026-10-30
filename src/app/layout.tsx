import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Polices self-hostées (OFL via Google Fonts).
 * Évite le fetch build-time next/font/google, flaky sur Vercel
 * (URLs /l/font?kit= sans extension → crash webpack/turbopack).
 */
const sora = localFont({
  src: [
    {
      path: "./fonts/sora-latin-ext.woff2",
      weight: "100 800",
      style: "normal",
    },
    {
      path: "./fonts/sora-latin.woff2",
      weight: "100 800",
      style: "normal",
    },
  ],
  variable: "--font-sora",
  display: "swap",
  adjustFontFallback: "Arial",
});

const newsreader = localFont({
  src: [
    {
      path: "./fonts/newsreader-latin-ext.woff2",
      weight: "200 800",
      style: "normal",
    },
    {
      path: "./fonts/newsreader-latin.woff2",
      weight: "200 800",
      style: "normal",
    },
  ],
  variable: "--font-newsreader",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const instrumentSerif = localFont({
  src: [
    {
      path: "./fonts/instrument-serif-latin-ext.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/instrument-serif-latin.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
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
