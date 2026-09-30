import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter_Tight } from "next/font/google";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { PageTransition } from "@/components/layout/PageTransition";
import { site } from "@/content/site";
import { jsonLdScript, organizationJsonLd } from "@/lib/structured-data";
import "./globals.css";

const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: "%s | JARBOU Logistik GmbH" },
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: site.locale,
    siteName: "JARBOU Logistik GmbH",
    title: site.title,
    description: site.description,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "JARBOU Logistik GmbH" }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0b0c0e",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={site.lang} className={`${interTight.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <a
          href="#inhalt"
          className="fixed left-4 top-4 z-[80] -translate-y-24 bg-red px-4 py-3 text-sm font-semibold text-white focus:translate-y-0"
        >
          Zum Inhalt springen
        </a>
        <Header />
        <main id="inhalt" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Footer />
        <CookieConsent />
        <PageTransition />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd()) }} />
      </body>
    </html>
  );
}
