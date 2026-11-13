import localFont from "next/font/local";

// TURVIO NEXT typography, self-hosted (no requests to third-party font services).
// Files and licences (SIL OFL 1.1): packages/web-ui/fonts.
export const jakarta = localFont({
  variable: "--font-jakarta",
  display: "swap",
  src: [
    { path: "../../../packages/web-ui/fonts/plus-jakarta-sans-latin-wght-normal.woff2", weight: "200 800", style: "normal" },
    { path: "../../../packages/web-ui/fonts/plus-jakarta-sans-latin-ext-wght-normal.woff2", weight: "200 800", style: "normal" },
  ],
});

export const plexArabic = localFont({
  variable: "--font-plex-arabic",
  display: "swap",
  preload: false,
  src: [
    { path: "../../../packages/web-ui/fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2", weight: "400" },
    { path: "../../../packages/web-ui/fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2", weight: "500" },
    { path: "../../../packages/web-ui/fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2", weight: "600" },
    { path: "../../../packages/web-ui/fonts/ibm-plex-sans-arabic-arabic-700-normal.woff2", weight: "700" },
  ],
});
