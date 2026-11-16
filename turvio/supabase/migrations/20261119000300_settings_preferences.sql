-- Settings (Phase B): personal preferences and company profile. Additive.

-- ---------------------------------------------------------------- personal preferences
-- One row per user; each user reads and writes only their own row. Company-specific choices
-- (default location, default Tours view) live in org_defaults keyed by organization id and are
-- validated by the API against the user's memberships.
create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  language text check (language in ('en', 'de', 'ar', 'ro')),
  theme text not null default 'system' check (theme in ('system', 'dark', 'light')),
  date_format text not null default 'dmy' check (date_format in ('dmy', 'ymd', 'mdy')),
  org_defaults jsonb not null default '{}'::jsonb check (jsonb_typeof(org_defaults) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
create policy user_preferences_own on public.user_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.user_preferences to authenticated;
create trigger user_preferences_touch before update on public.user_preferences
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------- company profile
-- Contact data shown to the company's own staff. Changed only by company admins (existing
-- org_update policy: is_org_admin) and audited (existing audit trigger on organizations).
alter table public.organizations
  add column contact_email text check (contact_email is null or (char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  add column contact_phone text check (contact_phone is null or char_length(contact_phone) <= 40),
  add column address_street text check (address_street is null or char_length(address_street) <= 200),
  add column address_postal_code text check (address_postal_code is null or char_length(address_postal_code) <= 12),
  add column address_city text check (address_city is null or char_length(address_city) <= 100),
  add column address_country text not null default 'DE' check (address_country ~ '^[A-Z]{2}$'),
  add column website text check (website is null or (char_length(website) <= 200 and website ~ '^https://'));

-- ---------------------------------------------------------------- analytics indexes
-- Reporting reads stops by tour and outcome time; tours by company and date (20261119000200).
create index if not exists stops_tour_status_idx on public.stops (tour_id, status) include (completed_at, arrived_at, type, failure_reason);
