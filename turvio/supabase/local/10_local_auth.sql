-- =============================================================================
-- TURVIO local authentication (AUTH_PROVIDER=local).
--
-- Used for local development, CI and self-hosted installations without
-- Supabase Auth. With AUTH_PROVIDER=supabase these tables stay unused:
-- Supabase Auth (GoTrue) owns credentials, sessions and reset emails.
-- The schema is not exposed to clients; only the API service role uses it.
-- =============================================================================
create schema if not exists app_auth;

create table app_auth.credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- scrypt$N$r$p$salt$hash (see apps/api/src/auth/password.ts)
  password_hash text not null,
  display_name text,
  updated_at timestamptz not null default now()
);

-- Refresh-token sessions (rotated on every refresh, revocable).
create table app_auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  refresh_token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  replaced_by uuid,
  user_agent text
);
create index sessions_user_idx on app_auth.sessions (user_id) where revoked_at is null;

create table app_auth.password_resets (
  token_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

-- Failed login attempts for throttling.
create table app_auth.login_failures (
  id bigint generated always as identity primary key,
  email text not null,
  at timestamptz not null default now()
);
create index login_failures_email_idx on app_auth.login_failures (lower(email), at desc);

-- Development mailbox: outgoing mail is recorded here when no SMTP server is
-- configured (MAILER=outbox). Never enabled in production.
create table app_auth.outbox (
  id bigint generated always as identity primary key,
  to_email text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);
