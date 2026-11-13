import { ThemeScript } from "@turvio/web-ui/ds";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${jakarta.variable} ${plexArabic.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
