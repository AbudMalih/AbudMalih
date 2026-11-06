import { passwordProblem } from "./password";
import { AuthFailure, type AuthProvider, type Caller, type LoginResult, type MfaEnrollment, type Session } from "./provider";
import { SupabaseTokenVerifier } from "./tokens";
import { open, seal } from "./totp";

const MFA_TOKEN_TTL_MS = 5 * 60 * 1000;
const MFA_PURPOSE = "supabase-mfa-challenge";

interface GoTrueFactor {
  id: string;
  factor_type: string;
  status: "verified" | "unverified";
}

/**
 * Supabase Auth (GoTrue) for production. TURVIO never stores passwords in this
 * mode; Supabase sends password-reset emails itself (configure its SMTP and
 * the redirect URL `${DISPATCH_URL}/reset-password` in the Supabase dashboard).
 *
 * MFA uses GoTrue's TOTP factors (/factors, /factors/{id}/challenge,
 * /factors/{id}/verify); the access token then carries `aal: "aal2"`. TOTP MFA
 * must be enabled in the Supabase project (Auth → Multi-Factor).
 *
 * NOTE: exercised with a mocked HTTP layer in tests only (including MFA); it
 * must be verified against the real Supabase project before go-live.
 */
export class SupabaseAuthProvider implements AuthProvider {
  readonly name = "supabase" as const;
  readonly verifier: SupabaseTokenVerifier;
  private readonly base: string;

  constructor(
    private readonly opts: { url: string; anonKey: string; serviceRoleKey: string; jwtSecret?: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.base = opts.url.replace(/\/$/, "");
    this.verifier = new SupabaseTokenVerifier({ supabaseUrl: opts.url, jwtSecret: opts.jwtSecret });
  }

  private async call(path: string, init: { method?: string; body?: unknown; token?: string; admin?: boolean }) {
    const key = init.admin ? this.opts.serviceRoleKey : this.opts.anonKey;
    const res = await this.fetchImpl(`${this.base}/auth/v1${path}`, {
      method: init.method ?? "POST",
      headers: { apikey: key, Authorization: `Bearer ${init.token ?? key}`, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  }

  private toSession(d: Record<string, unknown>): Session {
    const user = d.user as { id: string; email: string; user_metadata?: { display_name?: string } };
    return {
      accessToken: String(d.access_token),
      refreshToken: String(d.refresh_token),
      expiresIn: Number(d.expires_in ?? 3600),
      user: { id: user.id, email: user.email, name: user.user_metadata?.display_name ?? null },
      aal: aalOf(String(d.access_token)),
    };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const r = await this.call("/token?grant_type=password", { body: { email, password } });
    if (r.status === 429) throw new AuthFailure("too_many_attempts", "Too many attempts. Try again later.");
    if (!r.ok) throw new AuthFailure("invalid_credentials", "Email or password is incorrect");
    const factors = ((r.data.user as { factors?: GoTrueFactor[] } | undefined)?.factors ?? []).filter((f) => f.factor_type === "totp" && f.status === "verified");
    if (factors.length) {
      // The aal1 tokens never leave the API: they are sealed into the short-lived mfaToken.
      const payload = { at: String(r.data.access_token), fid: factors[0]!.id, exp: Date.now() + MFA_TOKEN_TTL_MS };
      return { mfaRequired: true, mfaToken: seal(this.opts.serviceRoleKey, MFA_PURPOSE, Buffer.from(JSON.stringify(payload))), factorType: "totp" };
    }
    return this.toSession(r.data);
  }

  async refresh(refreshToken: string): Promise<Session> {
    const r = await this.call("/token?grant_type=refresh_token", { body: { refresh_token: refreshToken } });
    if (!r.ok) throw new AuthFailure("invalid_token", "Session expired. Please sign in again.");
    return this.toSession(r.data);
  }

  async logout(refreshToken: string): Promise<void> {
    // GoTrue revokes sessions by access token; refreshing yields one to revoke.
    const r = await this.call("/token?grant_type=refresh_token", { body: { refresh_token: refreshToken } });
    if (r.ok) await this.call("/logout?scope=local", { token: String(r.data.access_token) });
  }

  async requestPasswordReset(email: string, resetUrlBase: string): Promise<void> {
    await this.call("/recover", { body: { email, redirect_to: `${resetUrlBase.replace(/\/$/, "")}/reset-password` } });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Same policy as local mode (Supabase enforces its own minimum as well).
    const problem = passwordProblem(newPassword);
    if (problem) throw new AuthFailure("weak_password", problem);
    // `token` is the recovery access token from the Supabase redirect.
    const r = await this.call("/user", { method: "PUT", token, body: { password: newPassword } });
    if (!r.ok) throw new AuthFailure("invalid_token", "This reset link is invalid or has expired");
  }

  async ensureUser(email: string, password: string, displayName: string | null) {
    // A new account must meet the password policy; an existing one proves its current password.
    const problem = passwordProblem(password);
    if (!problem) {
      const created = await this.call("/admin/users", { admin: true, body: { email, password, email_confirm: true, user_metadata: { display_name: displayName } } });
      if (created.ok) return { userId: String((created.data as { id: string }).id), created: true };
    }
    const login = await this.call("/token?grant_type=password", { body: { email, password } });
    if (!login.ok) {
      if (problem) throw new AuthFailure("weak_password", problem);
      throw new AuthFailure("invalid_credentials", "An account with this email exists – enter its current password to accept");
    }
    return { userId: String((login.data.user as { id: string }).id), created: false };
  }

  async displayName(userId: string): Promise<string | null> {
    const r = await this.call(`/admin/users/${encodeURIComponent(userId)}`, { method: "GET", admin: true });
    return (r.data.user_metadata as { display_name?: string } | undefined)?.display_name ?? null;
  }

  private async factors(accessToken: string): Promise<GoTrueFactor[]> {
    const r = await this.call("/user", { method: "GET", token: accessToken });
    if (!r.ok) throw new AuthFailure("invalid_token", "Session expired. Please sign in again.");
    return ((r.data.factors as GoTrueFactor[] | undefined) ?? []).filter((f) => f.factor_type === "totp");
  }

  /** Challenge + verify in one go; GoTrue returns the upgraded (aal2) session. */
  private async challengeAndVerify(accessToken: string, factorId: string, code: string): Promise<Session> {
    const ch = await this.call(`/factors/${encodeURIComponent(factorId)}/challenge`, { token: accessToken, body: {} });
    if (ch.status === 429) throw new AuthFailure("too_many_attempts", "Too many attempts. Try again later.");
    if (!ch.ok) throw new AuthFailure("invalid_token", "This sign-in step expired. Please sign in again.");
    const v = await this.call(`/factors/${encodeURIComponent(factorId)}/verify`, { token: accessToken, body: { challenge_id: String(ch.data.id), code: code.trim() } });
    if (v.status === 429) throw new AuthFailure("too_many_attempts", "Too many wrong codes. Try again later.");
    if (!v.ok) throw new AuthFailure("invalid_code", "The code is not correct. Check the time on your phone and try again.");
    return this.toSession(v.data);
  }

  async mfaStatus(caller: Caller) {
    return { enabled: (await this.factors(caller.accessToken)).some((f) => f.status === "verified") };
  }

  async mfaEnroll(caller: Caller): Promise<MfaEnrollment> {
    const existing = await this.factors(caller.accessToken);
    if (existing.some((f) => f.status === "verified")) throw new AuthFailure("mfa_already_enabled", "Two-step verification is already on for this account");
    for (const f of existing) await this.call(`/factors/${encodeURIComponent(f.id)}`, { method: "DELETE", token: caller.accessToken });
    const r = await this.call("/factors", { token: caller.accessToken, body: { factor_type: "totp", issuer: "TURVIO", friendly_name: "Authenticator app" } });
    if (!r.ok) throw new AuthFailure("not_configured", "Two-step verification is not available. Enable TOTP MFA in Supabase Auth.");
    const totp = r.data.totp as { secret: string; uri: string };
    return { factorId: String(r.data.id), secret: totp.secret, otpauthUrl: totp.uri };
  }

  async mfaActivate(caller: Caller, code: string): Promise<Session> {
    const pending = (await this.factors(caller.accessToken)).find((f) => f.status === "unverified");
    if (!pending) throw new AuthFailure("no_pending_factor", "Start the set-up first");
    return this.challengeAndVerify(caller.accessToken, pending.id, code);
  }

  async mfaVerify(mfaToken: string, code: string): Promise<Session> {
    let p: { at: string; fid: string; exp: number };
    try {
      p = JSON.parse(open(this.opts.serviceRoleKey, MFA_PURPOSE, mfaToken).toString("utf8"));
    } catch {
      throw new AuthFailure("invalid_token", "This sign-in step expired. Please sign in again.");
    }
    if (!(p.exp > Date.now())) throw new AuthFailure("invalid_token", "This sign-in step expired. Please sign in again.");
    return this.challengeAndVerify(p.at, p.fid, code);
  }
}

/** Reads the `aal` claim without verifying (the token comes straight from GoTrue over TLS). */
function aalOf(jwt: string): "aal1" | "aal2" {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8")) as { aal?: string };
    return payload.aal === "aal2" ? "aal2" : "aal1";
  } catch {
    return "aal1";
  }
}
