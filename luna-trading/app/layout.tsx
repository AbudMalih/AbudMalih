import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter-tight";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";
import { ENV_SCRIPT } from "@/lib/motion/env";
import SmoothScroll from "@/lib/motion/SmoothScroll";
import Navigation from "@/components/chrome/Navigation";
import Cursor from "@/components/chrome/Cursor";
import Footer from "@/components/chrome/Footer";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Luna Trading GmbH — Trade without borders",
    template: "%s — Luna Trading GmbH",
  },
  description:
    "Luna Trading GmbH, Cologne. Global sourcing, import & export, product and brand development, e-commerce and European distribution.",
  openGraph: {
    type: "website",
    siteName: "Luna Trading GmbH",
    title: "Luna Trading GmbH — Trade without borders",
    description: "Global sourcing. European distribution. Brand development.",
    locale: "en_GB",
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#060607",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ENV_SCRIPT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SmoothScroll />
        <Navigation />
        <Cursor />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
