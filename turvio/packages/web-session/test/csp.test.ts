import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, tileOrigin } from "../src/index";

describe("Content-Security-Policy", () => {
  it("allows only nonce'd scripts in production, no inline scripts, no framing", () => {
    const csp = contentSecurityPolicy("abc123", { imgHosts: ["https://tile.openstreetmap.org"] });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
    expect(csp).toContain("img-src 'self' data: blob: https://tile.openstreetmap.org");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");
  });
  it("development adds eval and the hot-reload socket only", () => {
    const csp = contentSecurityPolicy("n", { dev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' ws: wss:");
  });
  it("derives the tile image origin from a URL template", () => {
    expect(tileOrigin("https://tile.openstreetmap.org/{z}/{x}/{y}.png")).toBe("https://tile.openstreetmap.org");
    expect(tileOrigin("https://{s}.tiles.example.com/v1/{z}/{x}/{y}@2x.png?key=x")).toBe("https://*.tiles.example.com");
    expect(tileOrigin("http://insecure.example/{z}")).toBeNull();
  });
});
