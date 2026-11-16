import { ThemeScript } from "@turvio/web-ui/ds";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { I18nRoot } from "../components/I18nRoot";
import { dirOf } from "../lib/i18n";
import { serverLocale } from "../lib/i18n/server";
import { jakarta, plexArabic } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TURVIO Dispatch", template: "%s · TURVIO Dispatch" },
  description: "Smart Routes. Simple Deliveries.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090B11" },
    { media: "(prefers-color-scheme: light)", color: "#F6F4EF" },
  ],
  colorScheme: "dark light",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The chosen language (cookie, kept in sync with the user's saved preference) – right-to-left for Arabic.
  const locale = await serverLocale();
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${jakarta.variable} ${plexArabic.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <I18nRoot locale={locale}>{children}</I18nRoot>
      </body>
    </html>
  );
}
