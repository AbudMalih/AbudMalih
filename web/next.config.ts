import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content Security Policy. Next.js injects small inline bootstrap scripts,
 * hence 'unsafe-inline' for scripts; everything else is locked to this origin.
 * No third-party scripts are loaded (no analytics/marketing until consented
 * services are explicitly configured).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
  productionBrowserSourceMaps: false,
  images: { formats: ["image/avif", "image/webp"] },
  async redirects() {
    // Canonical host: https://www.jarbou-logistik.com
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "jarbou-logistik.com" }],
        destination: "https://www.jarbou-logistik.com/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
        ],
      },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

export default nextConfig;
