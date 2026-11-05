import type { AuthUser, TokenVerifier } from "./tokens";

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  user: { id: string; email: string; name: string | null };
}

/**
 * Identity provider. The rest of the API depends only on this interface, so
 * TURVIO can run with its own credential store (local) or Supabase Auth.
 */
export interface AuthProvider {
  readonly name: "local" | "supabase";
  readonly verifier: TokenVerifier;
  login(email: string, password: string, userAgent?: string): Promise<Session>;
  refresh(refreshToken: string, userAgent?: string): Promise<Session>;
  logout(refreshToken: string): Promise<void>;
  /** Starts a password reset; never reveals whether the account exists. */
  requestPasswordReset(email: string, resetUrlBase: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  /** Creates the account if needed. Existing accounts must prove their password. */
  ensureUser(email: string, password: string, displayName: string | null): Promise<{ userId: string; created: boolean }>;
  displayName(userId: string): Promise<string | null>;
}

export class AuthFailure extends Error {
  constructor(
    readonly code: "invalid_credentials" | "too_many_attempts" | "invalid_token" | "weak_password" | "not_configured",
    message: string,
  ) {
    super(message);
  }
}

export type { AuthUser };
