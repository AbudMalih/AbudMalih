import { AuthFailure, type AuthProvider, type Session } from "./provider";
import { SupabaseTokenVerifier } from "./tokens";

/**
 * Supabase Auth (GoTrue) for production. TURVIO never stores passwords in this
 * mode; Supabase sends password-reset emails itself (configure its SMTP and
 * the redirect URL `${DISPATCH_URL}/reset-password` in the Supabase dashboard).
 *
 * NOTE: exercised with a mocked HTTP layer in tests; it must be verified
 * against the real Supabase project before go-live.
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
    };
  }

  async login(email: string, password: string): Promise<Session> {
    const r = await this.call("/token?grant_type=password", { body: { email, password } });
    if (r.status === 429) throw new AuthFailure("too_many_attempts", "Too many attempts. Try again later.");
    if (!r.ok) throw new AuthFailure("invalid_credentials", "Email or password is incorrect");
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
    // `token` is the recovery access token from the Supabase redirect.
    const r = await this.call("/user", { method: "PUT", token, body: { password: newPassword } });
    if (!r.ok) throw new AuthFailure("invalid_token", "This reset link is invalid or has expired");
  }

  async ensureUser(email: string, password: string, displayName: string | null) {
    const created = await this.call("/admin/users", { admin: true, body: { email, password, email_confirm: true, user_metadata: { display_name: displayName } } });
    if (created.ok) return { userId: String((created.data as { id: string }).id), created: true };
    // Existing account: require the current password.
    const login = await this.call("/token?grant_type=password", { body: { email, password } });
    if (!login.ok) throw new AuthFailure("invalid_credentials", "An account with this email exists – enter its current password to accept");
    return { userId: String((login.data.user as { id: string }).id), created: false };
  }

  async displayName(userId: string): Promise<string | null> {
    const r = await this.call(`/admin/users/${encodeURIComponent(userId)}`, { method: "GET", admin: true });
    return (r.data.user_metadata as { display_name?: string } | undefined)?.display_name ?? null;
  }
}
