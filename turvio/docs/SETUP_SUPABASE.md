# Connecting TURVIO to Supabase (EU) – what you need to configure

TURVIO runs today against a local PostgreSQL with the same schema, roles and Row Level Security as Supabase. Moving to a hosted Supabase project needs the steps below. **Do not paste keys into chat or commit them** – put them into the hosting provider's secret settings (or local `.env` files, which are git-ignored).

## 1. Create the project

1. Supabase account owned by Lunapact Technologies → *New project* → **Region: Frankfurt (eu-central-1)**.
2. Note (Project Settings): Project URL, `anon` key, `service_role` key, database connection string.
3. Enable *Point-in-time recovery* / backups according to your plan.

## 2. Apply the database migrations

Apply `supabase/migrations/*.sql` in filename order (Supabase CLI `supabase db push`, or the SQL editor). Do **not** apply `supabase/local/*` – those files only emulate Supabase for local development.

Then schedule retention (SQL editor):

```sql
select cron.schedule('turvio-retention', '17 3 * * *', 'select app.purge_expired_data()');
```

## 3. Authentication (Supabase Auth)

* Authentication → Providers: Email/password on; "Confirm email" on.
* Authentication → URL configuration: Site URL = your Dispatch URL; add redirect URL `https://<dispatch-domain>/reset-password`.
* Authentication → SMTP: your EU mail provider (Supabase's built-in sender is rate-limited and not for production).
* MFA: enable TOTP and require it for owners/admins and platform admins (planned UI work).

## 4. API environment (`apps/api`)

| Variable | Value |
|---|---|
| `AUTH_PROVIDER` | `supabase` |
| `DATABASE_URL` | connection string (role `postgres`), `DATABASE_SSL=true` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | from Project Settings → API |
| `SUPABASE_JWT_SECRET` | optional; omit to verify via JWKS |
| `MAILER=smtp`, `SMTP_URL`, `MAIL_FROM` | invitation mails sent by TURVIO |
| `DISPATCH_URL`, `ADMIN_URL` | public URLs (links in emails) |
| `CORS_ORIGINS` | the web app origins (the mobile app is not a browser and needs no CORS) |
| `DEV_MAILBOX` | `false` (refused in production anyway) |

The API connects as `postgres`, but **every tenant query runs as the `authenticated` role with the user's JWT claims**, so RLS applies exactly as for PostgREST. The `service_role` key is only used for user administration (invitations).

The first platform admin is created once in the SQL editor after that person signed up:

```sql
insert into public.platform_admins (user_id) select id from auth.users where email = 'ops@your-domain.example';
```

## 5. Web apps (`apps/dispatch`, `apps/admin`)

| Variable | Value |
|---|---|
| `TURVIO_API_URL` | internal URL of the API (server-side only) |
| `NEXT_PUBLIC_TURVIO_ENV` | optional environment label (e.g. `Staging`); leave empty in production |

Tokens are stored in httpOnly, `Secure`, `SameSite=Lax` cookies; serve the apps over HTTPS.

## 6. Driver app (`apps/driver`)

* `EXPO_PUBLIC_API_URL` = public HTTPS URL of the API (build-time value, not a secret).
* `GOOGLE_MAPS_ANDROID_API_KEY` for Android builds (restricted to the app's package + SHA-1).
* Build with EAS under the Lunapact publisher account.

## 7. Infrastructure still needed

| Component | Purpose | Status |
|---|---|---|
| API hosting (EU), e.g. container service | `apps/api` | not provisioned |
| Optimizer hosting (internal network only) | `services/optimizer` | not provisioned |
| OSRM with Germany extract (internal) | road-network travel times (`OSRM_URL`) | not provisioned – straight-line estimates are used and labelled until then |
| Map tiles + geocoding provider | Dispatch map in production, address search | decision pending |
| SMTP provider (EU) | invitations, password reset | not configured |
| Monitoring, log retention, backups | operations | not configured |

Production readiness additionally requires a security review/penetration test, load tests, DPA/AVV templates and an incident process – see `docs/SECURITY_PRIVACY.md`.
