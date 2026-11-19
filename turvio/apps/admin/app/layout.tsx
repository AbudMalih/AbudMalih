import { ThemeScript } from "@turvio/web-ui/ds";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { I18nRoot } from "../components/I18nRoot";
import { dirOf } from "../lib/i18n";
import { serverLocale } from "../lib/i18n/server";
import { UiSwitch } from "../lib/ui";
import { inter, jakarta, plexArabic } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TURVIO Admin", template: "%s · TURVIO Admin" },
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
  // Phase G is the default; `?ui=classic` keeps the previous design during development (lib/ui.tsx).
  const classic = (await cookies()).get("tv_ui")?.value === "classic";
  // The chosen language (cookie, kept in sync with the user's saved preference) – right-to-left for Arabic.
  const locale = await serverLocale();
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${jakarta.variable} ${inter.variable} ${plexArabic.variable}`} data-ds={classic ? undefined : "g"} suppressHydrationWarning>
      <head>
        {/* Charcoal unless the user chose light or "follow system". */}
        <ThemeScript defaultTheme="dark" nonce={(await headers()).get("x-nonce") ?? undefined} />
      </head>
      <body>
        <UiSwitch />
        <I18nRoot locale={locale}>{children}</I18nRoot>
      </body>
    </html>
  );
}
