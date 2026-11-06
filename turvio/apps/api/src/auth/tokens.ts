import { createHash, randomBytes } from "node:crypto";
import { SignJWT, createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AuthUser {
  userId: string;
  email?: string;
  /** Authenticator assurance level from the `aal` claim (Supabase-compatible); absent = aal1. */
  aal?: "aal1" | "aal2";
}

export interface TokenVerifier {
  verify(token: string): Promise<AuthUser>;
}

export class AuthError extends Error {}

/** Opaque random token (refresh, reset, invitation) and the hash that is stored. */
export function newOpaqueToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Verifies Supabase-compatible access tokens: HS256 secret or JWKS,
 * `aud=authenticated`, configured issuer, not expired.
 */
export class JwtVerifier implements TokenVerifier {
  private readonly key: Uint8Array | JWTVerifyGetKey;

  constructor(private readonly opts: { issuer: string; secret?: string; jwksUrl?: string }) {
    if (opts.secret) this.key = new TextEncoder().encode(opts.secret);
    else if (opts.jwksUrl) this.key = createRemoteJWKSet(new URL(opts.jwksUrl));
    else throw new Error("JwtVerifier needs a secret or a JWKS URL");
  }

  async verify(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, this.key as Uint8Array, { issuer: this.opts.issuer, audience: "authenticated" });
      if (!payload.sub) throw new AuthError("token has no subject");
      return { userId: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined, aal: payload.aal === "aal2" ? "aal2" : "aal1" };
    } catch (e) {
      throw new AuthError(e instanceof Error ? e.message : "invalid token");
    }
  }
}

/** Supabase project tokens: issuer <url>/auth/v1, legacy secret or JWKS. */
export class SupabaseTokenVerifier extends JwtVerifier {
  constructor(opts: { supabaseUrl: string; jwtSecret?: string }) {
    const base = opts.supabaseUrl.replace(/\/$/, "");
    super({ issuer: `${base}/auth/v1`, secret: opts.jwtSecret, jwksUrl: opts.jwtSecret ? undefined : `${base}/auth/v1/.well-known/jwks.json` });
  }
}

/** Development only: every request is the synthetic driver of the pilot tenant. */
export class DevTokenVerifier implements TokenVerifier {
  constructor(private readonly user: AuthUser = { userId: "usr_drv_01", email: "driver@dev.turvio.invalid" }) {}
  async verify(): Promise<AuthUser> {
    return this.user;
  }
}

export async function signAccessToken(opts: { secret: string; issuer: string; ttlSeconds: number; userId: string; email: string; aal?: "aal1" | "aal2" }): Promise<string> {
  return new SignJWT({ email: opts.email, role: "authenticated", aal: opts.aal ?? "aal1" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(opts.userId)
    .setIssuer(opts.issuer)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime(`${opts.ttlSeconds}s`)
    .sign(new TextEncoder().encode(opts.secret));
}
