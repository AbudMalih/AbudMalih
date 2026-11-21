import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter-tight";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "./lab.css";

/**
 * Interactive Experience Lab (V2 exploration). Isolated from the website:
 * its own root layout, excluded from locale routing, never indexed, and
 * only present on the redesign-2027 branch.
 */
export const metadata: Metadata = {
  title: "Luna Trading · Interactive Experience Lab",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#0f1012" };

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="lab">{children}</body>
    </html>
  );
}
