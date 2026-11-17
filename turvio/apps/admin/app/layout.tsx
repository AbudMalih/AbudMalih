import { ThemeScript } from "@turvio/web-ui/ds";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
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
  return (
    <html lang="en" dir="ltr" className={`${jakarta.variable} ${inter.variable} ${plexArabic.variable}`} data-ds={classic ? undefined : "g"} suppressHydrationWarning>
      <head>
        {/* Charcoal unless the user chose light or "follow system". */}
        <ThemeScript defaultTheme="dark" />
      </head>
      <body>
        <UiSwitch />
        {children}
      </body>
    </html>
  );
}
