import type { Metadata } from "next";
import localFont from "next/font/local";
import { HOME_SEO, SITE_NAME } from "@/config/seo";
import { PUBLIC_SITE_ORIGIN } from "@/config/site";
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
  metadataBase: new URL(PUBLIC_SITE_ORIGIN),
  title: {
    default: HOME_SEO.title,
    template: `%s · ${SITE_NAME}`,
  },
  description: HOME_SEO.description,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: SITE_NAME,
    title: HOME_SEO.title,
    description: HOME_SEO.description,
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_SEO.title,
    description: HOME_SEO.description,
  },
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
