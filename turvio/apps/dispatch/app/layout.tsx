import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TURVIO Dispatch", template: "%s · TURVIO Dispatch" },
  description: "Smart Routes. Simple Deliveries.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#FFFFFF" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
