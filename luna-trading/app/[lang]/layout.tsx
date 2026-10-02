import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@fontsource-variable/inter-tight";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "../globals.css";
import { ENV_SCRIPT } from "@/lib/motion/env";
import SmoothScroll from "@/lib/motion/SmoothScroll";
import Navigation from "@/components/chrome/Navigation";
import Cursor from "@/components/chrome/Cursor";
import Footer from "@/components/chrome/Footer";
import { I18nProvider } from "@/content/i18n/I18nProvider";
import { LOCALES, LOCALE_META, getDictionary, isLocale, localePath, type Locale } from "@/content/i18n";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const d = getDictionary(lang);
  return {
    metadataBase: new URL(SITE),
    title: { default: d.meta.title, template: d.meta.titleTemplate },
    description: d.meta.description,
    alternates: {
      canonical: localePath(lang, "/"),
      languages: Object.fromEntries(LOCALES.map((l) => [LOCALE_META[l].htmlLang, localePath(l, "/")])),
    },
    openGraph: {
      type: "website",
      siteName: "Luna Trading GmbH",
      title: d.meta.title,
      description: d.meta.ogDescription,
      locale: LOCALE_META[lang].og,
    },
    icons: { icon: "/icon.svg" },
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
          <SmoothScroll />
          <Navigation />
          <Cursor />
          <main id="main">{children}</main>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
