import { join } from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Container builds (deploy/docker/web.Dockerfile) set NEXT_OUTPUT=standalone: a minimal
  // server with only the traced dependencies. Local `next start` keeps the default output.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const, outputFileTracingRoot: join(process.cwd(), "../..") } : {}),
  transpilePackages: ["@turvio/shared", "@turvio/web-ui", "@turvio/web-session", "geist"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default config;
