import path from "node:path";
import { fileURLToPath } from "node:url";

const PROD = process.env.NODE_ENV === "production";
// launch switch (see lib/origin.ts): until it is "on", nothing is indexable
const INDEXING = process.env.SITE_INDEXING === "on";

/**
 * Content-Security-Policy built from what the site actually loads: every
 * script, style, font, image, texture and fetch is same-origin. Next.js
 * inlines its hydration data and our pre-paint environment script, and React
 * sets inline styles, hence 'unsafe-inline' for scripts and styles (a nonce
 * would force every page to render dynamically). WebGL textures may use
 * blob:/data: images. Production only: the dev server needs eval.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY = [
  ...(PROD ? [{ key: "Content-Security-Policy", value: CSP }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];
const NOINDEX = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  poweredByHeader: false,
  images: {
    // Production photography / renders will be served through next/image.
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 828, 1080, 1440, 1920, 2560],
  },
  async headers() {
    const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    return [
      { source: "/:path*", headers: SECURITY },
      // preview / deployment hosts are never indexable; luna-trading.de only after the launch switch
      INDEXING
        ? { source: "/:path*", missing: [{ type: "host", value: "luna-trading.de" }], headers: NOINDEX }
        : { source: "/:path*", headers: NOINDEX },
      { source: "/textures/:path*", headers: immutable },
      { source: "/sequences/:path*", headers: immutable },
      // icons: revalidate, so a changed favicon is never stuck in caches
      { source: "/:icon(favicon.ico|favicon-lt.svg|apple-touch-icon.png|apple-touch-icon-lt.png|site.webmanifest)", headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }] },
      { source: "/brand/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] },
    ];
  },
};
export default nextConfig;
