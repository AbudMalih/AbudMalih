import type { Db } from "../db";
import type { Mailer } from "../mail";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { AuthFailure, type AuthProvider, type Session } from "./provider";
import { JwtVerifier, hashToken, newOpaqueToken, signAccessToken } from "./tokens";

const MAX_FAILURES = 5;
const FAILURE_WINDOW_MIN = 15;
const RESET_TTL_MIN = 60;

/**
 * TURVIO-managed authentication in Postgres (app_auth schema).
 * Access tokens are short-lived HS256 JWTs with Supabase-compatible claims;
 * refresh tokens are opaque, stored hashed and rotated on every use. Reusing
 * an already rotated refresh token revokes the whole session chain.
 */
export class LocalAuthProvider implements AuthProvider {
  readonly name = "local" as const;
  readonly verifier: JwtVerifier;

  constructor(
    private readonly db: Db,
    private readonly mailer: Mailer,
    private readonly opts: { secret: string; issuer: string; accessTtl: number; refreshTtlDays: number },
  ) {
    this.verifier = new JwtVerifier({ issuer: opts.issuer, secret: opts.secret });
  }

  private async issue(userId: string, email: string, name: string | null, userAgent?: string, replaces?: string): Promise<Session> {
    const refresh = newOpaqueToken();
    await this.db.asService(async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into app_auth.sessions (user_id, refresh_token_hash, expires_at, user_agent) values ($1, $2, now() + make_interval(days => $3), $4) returning id`,
        [userId, refresh.hash, this.opts.refreshTtlDays, userAgent?.slice(0, 300) ?? null],
      );
      if (replaces) await tx.query(`update app_auth.sessions set revoked_at = now(), replaced_by = $2 where id = $1`, [replaces, rows[0]!.id]);
    });
    const accessToken = await signAccessToken({ secret: this.opts.secret, issuer: this.opts.issuer, ttlSeconds: this.opts.accessTtl, userId, email });
    return { accessToken, refreshToken: refresh.token, expiresIn: this.opts.accessTtl, user: { id: userId, email, name } };
  }

  async login(email: string, password: string, userAgent?: string): Promise<Session> {
    const normalized = email.trim().toLowerCase();
    const row = await this.db.asService(async (tx) => {
      const { rows: f } = await tx.query<{ n: number }>(
        `select count(*)::int as n from app_auth.login_failures where lower(email) = $1 and at > now() - make_interval(mins => $2)`,
        [normalized, FAILURE_WINDOW_MIN],
      );
      if (f[0]!.n >= MAX_FAILURES) throw new AuthFailure("too_many_attempts", "Too many failed attempts. Try again in a few minutes.");
      const { rows } = await tx.query<{ id: string; email: string; password_hash: string; display_name: string | null }>(
        `select u.id, u.email, c.password_hash, c.display_name from auth.users u join app_auth.credentials c on c.user_id = u.id where lower(u.email) = $1`,
        [normalized],
      );
      return rows[0];
    });
    // Always run a hash comparison to keep timing similar for unknown accounts.
    const ok = await verifyPassword(password, row?.password_hash ?? "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
    if (!row || !ok) {
      await this.db.asService((tx) => tx.query(`insert into app_auth.login_failures (email) values ($1)`, [normalized]));
      throw new AuthFailure("invalid_credentials", "Email or password is incorrect");
    }
    await this.db.asService((tx) => tx.query(`delete from app_auth.login_failures where lower(email) = $1`, [normalized]));
    return this.issue(row.id, row.email, row.display_name, userAgent);
  }

  async refresh(refreshToken: string, userAgent?: string): Promise<Session> {
    const hash = hashToken(refreshToken);
    const s = await this.db.asService(async (tx) => {
      const { rows } = await tx.query<{ id: string; user_id: string; revoked_at: Date | null; expires_at: Date; email: string; display_name: string | null }>(
        `select s.id, s.user_id, s.revoked_at, s.expires_at, u.email, c.display_name
           from app_auth.sessions s join auth.users u on u.id = s.user_id left join app_auth.credentials c on c.user_id = u.id
          where s.refresh_token_hash = $1 for update of s`,
        [hash],
      );
      const r = rows[0];
      if (!r) return null;
      if (r.revoked_at) {
        // Reuse of a rotated token: assume theft, revoke every session of this user.
        await tx.query(`update app_auth.sessions set revoked_at = coalesce(revoked_at, now()) where user_id = $1`, [r.user_id]);
        return null;
      }
      if (r.expires_at.getTime() < Date.now()) return null;
      return r;
    });
    if (!s) throw new AuthFailure("invalid_token", "Session expired. Please sign in again.");
    return this.issue(s.user_id, s.email, s.display_name, userAgent, s.id);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.db.asService((tx) => tx.query(`update app_auth.sessions set revoked_at = now() where refresh_token_hash = $1 and revoked_at is null`, [hashToken(refreshToken)]));
  }

  async requestPasswordReset(email: string, resetUrlBase: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const user = await this.db.asService(async (tx) => {
      const { rows } = await tx.query<{ id: string; email: string }>(
        `select u.id, u.email from auth.users u join app_auth.credentials c on c.user_id = u.id where lower(u.email) = $1`,
        [normalized],
      );
      return rows[0];
    });
    if (!user) return; // do not reveal whether the account exists
    const t = newOpaqueToken();
    await this.db.asService((tx) =>
      tx.query(`insert into app_auth.password_resets (token_hash, user_id, expires_at) values ($1, $2, now() + make_interval(mins => $3))`, [t.hash, user.id, RESET_TTL_MIN]),
    );
    const link = `${resetUrlBase.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(t.token)}`;
    await this.mailer.send({
      to: user.email,
      subject: "Reset your TURVIO password",
      text: `Someone asked to reset the password of your TURVIO account.\n\nSet a new password (valid for ${RESET_TTL_MIN} minutes):\n${link}\n\nIf this was not you, ignore this email.`,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const problem = passwordProblem(newPassword);
    if (problem) throw new AuthFailure("weak_password", problem);
    const hash = await hashPassword(newPassword);
    const ok = await this.db.asService(async (tx) => {
      const { rows } = await tx.query<{ user_id: string }>(
        `update app_auth.password_resets set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning user_id`,
        [hashToken(token)],
      );
      const userId = rows[0]?.user_id;
      if (!userId) return false;
      await tx.query(`update app_auth.credentials set password_hash = $2, updated_at = now() where user_id = $1`, [userId, hash]);
      // Sign out everywhere after a password change.
      await tx.query(`update app_auth.sessions set revoked_at = now() where user_id = $1 and revoked_at is null`, [userId]);
      await tx.query(`delete from app_auth.login_failures where lower(email) = (select lower(email) from auth.users where id = $1)`, [userId]);
      return true;
    });
    if (!ok) throw new AuthFailure("invalid_token", "This reset link is invalid or has expired");
  }

  async ensureUser(email: string, password: string, displayName: string | null) {
    const normalized = email.trim().toLowerCase();
    const existing = await this.db.asService(async (tx) => {
      const { rows } = await tx.query<{ id: string; password_hash: string | null }>(
        `select u.id, c.password_hash from auth.users u left join app_auth.credentials c on c.user_id = u.id where lower(u.email) = $1`,
        [normalized],
      );
      return rows[0];
    });
    if (existing?.password_hash) {
      if (!(await verifyPassword(password, existing.password_hash))) {
        throw new AuthFailure("invalid_credentials", "An account with this email exists – enter its current password to accept");
      }
      return { userId: existing.id, created: false };
    }
    const problem = passwordProblem(password);
    if (problem) throw new AuthFailure("weak_password", problem);
    const hash = await hashPassword(password);
    const userId = await this.db.asService(async (tx) => {
      const id =
        existing?.id ?? (await tx.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [normalized])).rows[0]!.id;
      await tx.query(`insert into app_auth.credentials (user_id, password_hash, display_name) values ($1, $2, $3)`, [id, hash, displayName]);
      return id;
    });
    return { userId, created: true };
  }

  async displayName(userId: string): Promise<string | null> {
    return this.db.asService(async (tx) => (await tx.query<{ display_name: string | null }>(`select display_name from app_auth.credentials where user_id = $1`, [userId])).rows[0]?.display_name ?? null);
  }
}
