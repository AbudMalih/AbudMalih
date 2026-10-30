import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Config } from "./config";

export interface AuthUser {
  userId: string;
  email?: string;
}

export interface TokenVerifier {
  verify(token: string): Promise<AuthUser>;
}

export class AuthError extends Error {}

/** Verifies Supabase Auth access tokens (HS256 secret or the project's JWKS). */
export class SupabaseTokenVerifier implements TokenVerifier {
  private readonly key: Uint8Array | JWTVerifyGetKey;
  private readonly issuer: string;

  constructor(opts: { supabaseUrl: string; jwtSecret?: string }) {
    const base = opts.supabaseUrl.replace(/\/$/, "");
    this.issuer = `${base}/auth/v1`;
    this.key = opts.jwtSecret
      ? new TextEncoder().encode(opts.jwtSecret)
      : createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, this.key as Uint8Array, {
        issuer: this.issuer,
        audience: "authenticated",
      });
      if (!payload.sub) throw new AuthError("token has no subject");
      return { userId: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined };
    } catch (e) {
      throw new AuthError(e instanceof Error ? e.message : "invalid token");
    }
  }
}

/** Development only: every request is the synthetic driver of the pilot tenant. */
export class DevTokenVerifier implements TokenVerifier {
  constructor(private readonly user: AuthUser = { userId: "usr_drv_01", email: "driver@dev.turvio.invalid" }) {}
  async verify(): Promise<AuthUser> {
    return this.user;
  }
}

export function createVerifier(config: Config): TokenVerifier {
  if (config.AUTH_MODE === "dev") return new DevTokenVerifier();
  return new SupabaseTokenVerifier({ supabaseUrl: config.SUPABASE_URL!, jwtSecret: config.SUPABASE_JWT_SECRET });
}
