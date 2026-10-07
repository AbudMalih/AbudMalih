import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@fontsource-variable/inter-tight";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "../globals.css";
import { ENV_SCRIPT } from "@/lib/motion/env";
import ScrollSetup from "@/lib/motion/scroll";
import Navigation from "@/components/chrome/Navigation";
import Cursor from "@/components/chrome/Cursor";
import Footer from "@/components/chrome/Footer";
import { I18nProvider } from "@/content/i18n/I18nProvider";
import { LOCALES, LOCALE_META, getDictionary, isLocale, type Locale } from "@/content/i18n";
import { INDEXING_ENABLED, OG_IMAGE, SITE_ORIGIN } from "@/lib/seo";

const ICON_V = "lt1";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const d = getDictionary(lang);
  // neutral site-wide defaults; every page sets its own canonical, hreflang
  // and page-specific Open Graph through pageMetadata() (lib/seo.ts)
  return {
    metadataBase: new URL(SITE_ORIGIN),
    description: d.meta.description,
    openGraph: { type: "website", siteName: "Luna Trading GmbH", locale: LOCALE_META[lang].og, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
    title: { default: d.meta.title, template: d.meta.titleTemplate },
    // not indexable until the launch switch is on (see lib/seo.ts)
    ...(INDEXING_ENABLED ? {} : { robots: { index: false, follow: false } }),
    // LT micro-mark. Versioned URLs bust the aggressively cached Phase 1 "+".
    icons: {
      icon: [
        { url: `/favicon.ico?v=${ICON_V}`, sizes: "16x16 32x32 48x48" },
        { url: `/favicon-lt.svg?v=${ICON_V}`, type: "image/svg+xml" },
      ],
      shortcut: `/favicon.ico?v=${ICON_V}`,
      apple: { url: `/apple-touch-icon-lt.png?v=${ICON_V}`, sizes: "180x180" },
    },
    manifest: `/site.webmanifest?v=${ICON_V}`,
  };
}

export const viewport: Viewport = {
  themeColor: "#060607",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict = getDictionary(locale);
  const meta = LOCALE_META[locale];
  return (
    <html lang={meta.htmlLang} dir={meta.dir} data-locale={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ENV_SCRIPT }} />
      </head>
      <body>
        <I18nProvider locale={locale} dict={dict}>
          <a href="#main" className="skip-link">
            {dict.a11y.skip}
          </a>
          <ScrollSetup />
          <Navigation />
          <Cursor />
          <main id="main">{children}</main>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
