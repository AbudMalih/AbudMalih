import type { AuthUser, TokenVerifier } from "./tokens";

/** Authenticator assurance level: aal1 = password only, aal2 = password + second factor. */
export type Aal = "aal1" | "aal2";

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  user: { id: string; email: string; name: string | null };
  aal?: Aal;
}

/** Password was correct but the account has a verified second factor. */
export interface MfaChallenge {
  mfaRequired: true;
  /** Short-lived, single-use token for POST /v1/auth/mfa/verify (not a session). */
  mfaToken: string;
  factorType: "totp";
}

export type LoginResult = Session | MfaChallenge;
export const isMfaChallenge = (r: LoginResult): r is MfaChallenge => "mfaRequired" in r && r.mfaRequired === true;

/** The signed-in caller, as needed by MFA enrolment (Supabase needs the bearer token). */
export interface Caller {
  userId: string;
  email?: string;
  accessToken: string;
  aal?: Aal;
}

export interface MfaEnrollment {
  factorId: string;
  /** Base32 secret for manual entry. Shown once; stored encrypted (local) or by Supabase. */
  secret: string;
  otpauthUrl: string;
}

/**
 * Identity provider. The rest of the API depends only on this interface, so
 * TURVIO can run with its own credential store (local) or Supabase Auth.
 */
export interface AuthProvider {
  readonly name: "local" | "supabase";
  readonly verifier: TokenVerifier;
  login(email: string, password: string, userAgent?: string): Promise<LoginResult>;
  refresh(refreshToken: string, userAgent?: string): Promise<Session>;
  logout(refreshToken: string): Promise<void>;
  /** Starts a password reset; never reveals whether the account exists. */
  requestPasswordReset(email: string, resetUrlBase: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  /** Creates the account if needed. Existing accounts must prove their password. */
  ensureUser(email: string, password: string, displayName: string | null): Promise<{ userId: string; created: boolean }>;
  displayName(userId: string): Promise<string | null>;

  /** Whether the caller has a verified TOTP factor. */
  mfaStatus(caller: Caller): Promise<{ enabled: boolean }>;
  /** Starts TOTP enrolment (replaces an unfinished one). */
  mfaEnroll(caller: Caller): Promise<MfaEnrollment>;
  /** Confirms enrolment with a first code; returns a new aal2 session. */
  mfaActivate(caller: Caller, code: string, userAgent?: string): Promise<Session>;
  /** Second login step; returns an aal2 session. */
  mfaVerify(mfaToken: string, code: string, userAgent?: string): Promise<Session>;
}

export class AuthFailure extends Error {
  constructor(
    readonly code: "invalid_credentials" | "too_many_attempts" | "invalid_token" | "weak_password" | "not_configured" | "invalid_code" | "mfa_required" | "no_pending_factor" | "mfa_already_enabled",
    message: string,
  ) {
    super(message);
  }
}

export type { AuthUser };
