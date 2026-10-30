-- =============================================================================
-- TURVIO – multi-tenant core schema
--
-- Tenant = organization (a logistics company subscribing to TURVIO).
-- Every tenant-owned row carries organization_id. Isolation is enforced by:
--   1. Row Level Security on every table (this file),
--   2. composite foreign keys (organization_id, id) so rows can never
--      reference another tenant's rows,
--   3. backend authorization in apps/api (defence in depth).
-- Supabase's service_role bypasses RLS and must only be used server-side.
-- =============================================================================

create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.org_role as enum ('owner', 'admin', 'dispatcher', 'driver');
create type public.org_status as enum ('trialing', 'active', 'past_due', 'suspended', 'cancelled');
create type public.tour_status as enum ('planned', 'in_progress', 'paused', 'completed');
create type public.stop_type as enum ('delivery', 'pickup', 'break');
create type public.stop_status as enum ('pending', 'delivered', 'picked_up', 'failed', 'skipped');
create type public.proof_kind as enum ('photo', 'signature');

-- ---------------------------------------------------------------------------
-- Tenancy & identity
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  country_code char(2) not null default 'DE',
  status public.org_status not null default 'trialing',
  default_locale text not null default 'de' check (default_locale in ('de', 'en', 'ro', 'ar')),
  -- Data retention (GDPR storage limitation). Enforced by app.purge_expired_data().
  location_retention_days int not null default 30 check (location_retention_days between 1 and 365),
  proof_retention_days int not null default 90 check (proof_retention_days between 1 and 3650),
  created_at timestamptz not null default now()
);

-- TURVIO platform operators (Lunapact Technologies staff). Not tenant members.
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  locale text check (locale in ('de', 'en', 'ro', 'ar')),
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id) where active;

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER: read memberships without recursing
-- into RLS). Kept in the non-exposed `app` schema.
-- ---------------------------------------------------------------------------
create or replace function app.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid());
$$;

create or replace function app.has_org_role(org uuid, roles public.org_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.active
      and m.role = any (roles)
      and o.status <> 'suspended'
  );
$$;

create or replace function app.is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.has_org_role(org, array['owner', 'admin', 'dispatcher', 'driver']::public.org_role[]);
$$;

create or replace function app.is_org_staff(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.has_org_role(org, array['owner', 'admin', 'dispatcher']::public.org_role[]);
$$;

create or replace function app.is_org_admin(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.has_org_role(org, array['owner', 'admin']::public.org_role[]);
$$;

-- ---------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------
create table public.depots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  street text not null,
  house_number text,
  postal_code text not null,
  city text not null,
  country_code char(2) not null default 'DE',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  depot_id uuid,
  label text not null check (char_length(label) between 1 and 60),
  license_plate text not null check (char_length(license_plate) between 1 and 15),
  capacity_parcels int check (capacity_parcels > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, license_plate),
  foreign key (organization_id, depot_id) references public.depots (organization_id, id)
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Login account; null for drivers that have not been invited yet.
  user_id uuid references auth.users (id) on delete set null,
  depot_id uuid,
  display_name text not null check (char_length(display_name) between 1 and 120),
  max_shift_minutes int not null default 480 check (max_shift_minutes between 60 and 600),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, user_id),
  foreign key (organization_id, depot_id) references public.depots (organization_id, id)
);

create or replace function app.my_driver_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select d.id from public.drivers d
  where d.user_id = auth.uid() and d.active
    and app.is_org_member(d.organization_id);
$$;

create table public.tours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  depot_id uuid not null,
  driver_id uuid,
  vehicle_id uuid,
  name text not null check (char_length(name) between 1 and 120),
  tour_date date not null,
  status public.tour_status not null default 'planned',
  planned_start_minute int not null default 480 check (planned_start_minute between 0 and 1439),
  start_lat double precision, start_lng double precision,
  end_lat double precision, end_lng double precision,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, depot_id) references public.depots (organization_id, id),
  foreign key (organization_id, driver_id) references public.drivers (organization_id, id),
  foreign key (organization_id, vehicle_id) references public.vehicles (organization_id, id)
);
create index tours_org_date_idx on public.tours (organization_id, tour_date);
create index tours_driver_idx on public.tours (driver_id, tour_date);

create table public.stops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  tour_id uuid not null,
  type public.stop_type not null default 'delivery',
  sequence int not null check (sequence >= 0),
  recipient_name text check (char_length(recipient_name) <= 120),
  street text not null,
  house_number text,
  postal_code text not null,
  city text not null,
  country_code char(2) not null default 'DE',
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  tw_start_minute int check (tw_start_minute between 0 and 1439),
  tw_end_minute int check (tw_end_minute between 0 and 1439),
  service_seconds int not null default 120 check (service_seconds between 0 and 10800),
  priority boolean not null default false,
  notes text check (char_length(notes) <= 1000),
  status public.stop_status not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, tour_id) references public.tours (organization_id, id) on delete cascade,
  check ((tw_start_minute is null) = (tw_end_minute is null)),
  check (tw_end_minute is null or tw_end_minute > tw_start_minute),
  check ((lat is null) = (lng is null))
);
create index stops_tour_idx on public.stops (tour_id, sequence);

create table public.parcels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  stop_id uuid not null,
  tracking_number text not null check (char_length(tracking_number) between 1 and 64),
  barcode text check (char_length(barcode) <= 128),
  recipient_name text check (char_length(recipient_name) <= 120),
  created_at timestamptz not null default now(),
  foreign key (organization_id, stop_id) references public.stops (organization_id, id) on delete cascade
);
create index parcels_tracking_idx on public.parcels (organization_id, tracking_number);

-- Delivery tracking history (append-only).
create table public.stop_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  stop_id uuid not null,
  status public.stop_status not null,
  notes text check (char_length(notes) <= 1000),
  actor_user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (organization_id, stop_id) references public.stops (organization_id, id) on delete cascade
);

-- Proof of delivery. Files live in the private storage bucket "proofs" under
-- "<organization_id>/<stop_id>/<file>"; this table only stores the path.
create table public.proofs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  stop_id uuid not null,
  kind public.proof_kind not null,
  storage_path text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (organization_id, stop_id) references public.stops (organization_id, id) on delete cascade,
  check (split_part(storage_path, '/', 1) = organization_id::text)
);

-- Driver positions: only recorded during an active tour; purged after
-- organizations.location_retention_days.
create table public.location_pings (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  driver_id uuid not null,
  tour_id uuid not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  recorded_at timestamptz not null default now(),
  foreign key (organization_id, driver_id) references public.drivers (organization_id, id) on delete cascade,
  foreign key (organization_id, tour_id) references public.tours (organization_id, id) on delete cascade
);
create index location_pings_tour_idx on public.location_pings (tour_id, recorded_at);

-- Audit trail. Stores who changed what – not the personal data itself.
create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid,
  actor_user_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  changed_columns text[],
  created_at timestamptz not null default now()
);
create index audit_log_org_idx on public.audit_log (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Driver actions (RPC). Drivers never get direct UPDATE rights on tours/stops;
-- these functions check ownership and only touch status-related columns.
-- ---------------------------------------------------------------------------
create or replace function public.driver_set_stop_status(p_stop_id uuid, p_status public.stop_status, p_notes text default null)
returns public.stops
language plpgsql security definer set search_path = '' as $$
declare
  s public.stops;
begin
  select st.* into s from public.stops st
  join public.tours t on t.id = st.tour_id and t.organization_id = st.organization_id
  where st.id = p_stop_id
    and (t.driver_id in (select app.my_driver_ids()) or app.is_org_staff(st.organization_id))
  for update of st;
  if not found then
    raise exception 'stop not found' using errcode = 'P0002';
  end if;
  if s.status <> 'pending' and p_status <> 'pending' then
    raise exception 'invalid status transition % -> %', s.status, p_status using errcode = '22023';
  end if;
  if (p_status = 'delivered' and s.type <> 'delivery') or (p_status = 'picked_up' and s.type <> 'pickup') then
    raise exception 'status % not valid for stop type %', p_status, s.type using errcode = '22023';
  end if;

  update public.stops
     set status = p_status,
         completed_at = case when p_status = 'pending' then null else now() end,
         notes = coalesce(p_notes, notes)
   where id = p_stop_id
   returning * into s;

  insert into public.stop_events (organization_id, stop_id, status, notes, actor_user_id)
  values (s.organization_id, s.id, p_status, p_notes, auth.uid());
  return s;
end;
$$;

create or replace function public.driver_set_tour_status(p_tour_id uuid, p_status public.tour_status)
returns public.tours
language plpgsql security definer set search_path = '' as $$
declare
  t public.tours;
begin
  select * into t from public.tours
  where id = p_tour_id
    and (driver_id in (select app.my_driver_ids()) or app.is_org_staff(organization_id))
  for update;
  if not found then
    raise exception 'tour not found' using errcode = 'P0002';
  end if;
  if not (
    (t.status = 'planned' and p_status = 'in_progress') or
    (t.status = 'in_progress' and p_status in ('paused', 'completed')) or
    (t.status = 'paused' and p_status in ('in_progress', 'completed'))
  ) then
    raise exception 'invalid tour transition % -> %', t.status, p_status using errcode = '22023';
  end if;
  update public.tours
     set status = p_status,
         started_at = coalesce(started_at, case when p_status = 'in_progress' then now() end),
         finished_at = case when p_status = 'completed' then now() else finished_at end
   where id = p_tour_id
   returning * into t;
  return t;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit trigger
-- ---------------------------------------------------------------------------
create or replace function app.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  cols text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into cols
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value;
  end if;
  insert into public.audit_log (organization_id, actor_user_id, action, table_name, record_id, changed_columns)
  values (
    case when tg_table_name = 'organizations' then (rec ->> 'id')::uuid else (rec ->> 'organization_id')::uuid end,
    auth.uid(), lower(tg_op), tg_table_name, rec ->> 'id', cols
  );
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['organizations', 'memberships', 'depots', 'vehicles', 'drivers', 'tours', 'stops'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function app.audit()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------
create or replace function app.purge_expired_data() returns void
language sql security definer set search_path = '' as $$
  delete from public.location_pings lp
  using public.organizations o
  where o.id = lp.organization_id
    and lp.recorded_at < now() - make_interval(days => o.location_retention_days);
  delete from public.proofs p
  using public.organizations o
  where o.id = p.organization_id
    and p.created_at < now() - make_interval(days => o.proof_retention_days);
$$;
-- Schedule with pg_cron in Supabase, e.g.:
--   select cron.schedule('turvio-retention', '17 3 * * *', 'select app.purge_expired_data()');
-- Storage objects for purged proofs must be deleted by the backend job as well.

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.platform_admins enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.depots enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.tours enable row level security;
alter table public.stops enable row level security;
alter table public.parcels enable row level security;
alter table public.stop_events enable row level security;
alter table public.proofs enable row level security;
alter table public.location_pings enable row level security;
alter table public.audit_log enable row level security;

-- organizations: members read; owner/admin update settings; create/delete via platform admin or backend.
create policy org_select on public.organizations for select to authenticated
  using (app.is_org_member(id) or app.is_platform_admin());
create policy org_update on public.organizations for update to authenticated
  using (app.is_org_admin(id) or app.is_platform_admin())
  with check (app.is_org_admin(id) or app.is_platform_admin());
create policy org_insert on public.organizations for insert to authenticated
  with check (app.is_platform_admin());
create policy org_delete on public.organizations for delete to authenticated
  using (app.is_platform_admin());

create policy platform_admins_select on public.platform_admins for select to authenticated
  using (user_id = auth.uid() or app.is_platform_admin());

create policy profiles_self on public.profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or app.is_org_admin(organization_id) or app.is_platform_admin());
-- Only owners may grant or hold the owner role; admins manage everyone else.
create policy memberships_write on public.memberships for all to authenticated
  using (app.has_org_role(organization_id, array['owner']::public.org_role[])
         or (app.is_org_admin(organization_id) and role <> 'owner')
         or app.is_platform_admin())
  with check (app.has_org_role(organization_id, array['owner']::public.org_role[])
              or (app.is_org_admin(organization_id) and role <> 'owner')
              or app.is_platform_admin());

create policy depots_select on public.depots for select to authenticated using (app.is_org_member(organization_id));
create policy depots_write on public.depots for all to authenticated
  using (app.is_org_admin(organization_id)) with check (app.is_org_admin(organization_id));

create policy vehicles_select on public.vehicles for select to authenticated using (app.is_org_member(organization_id));
create policy vehicles_write on public.vehicles for all to authenticated
  using (app.is_org_staff(organization_id)) with check (app.is_org_staff(organization_id));

create policy drivers_select on public.drivers for select to authenticated
  using (app.is_org_staff(organization_id) or id in (select app.my_driver_ids()));
create policy drivers_write on public.drivers for all to authenticated
  using (app.is_org_staff(organization_id)) with check (app.is_org_staff(organization_id));

create policy tours_select on public.tours for select to authenticated
  using (app.is_org_staff(organization_id) or driver_id in (select app.my_driver_ids()));
create policy tours_write on public.tours for all to authenticated
  using (app.is_org_staff(organization_id)) with check (app.is_org_staff(organization_id));

-- Stops: staff manage all; drivers read and add stops (manual entry, import,
-- scanning) to their own tours. Status changes go through driver_set_stop_status().
create policy stops_select on public.stops for select to authenticated
  using (app.is_org_staff(organization_id)
         or tour_id in (select t.id from public.tours t where t.driver_id in (select app.my_driver_ids())));
create policy stops_driver_insert on public.stops for insert to authenticated
  with check (status = 'pending'
              and tour_id in (select t.id from public.tours t
                              where t.organization_id = stops.organization_id
                                and t.driver_id in (select app.my_driver_ids())
                                and t.status <> 'completed'));
create policy stops_staff_write on public.stops for all to authenticated
  using (app.is_org_staff(organization_id)) with check (app.is_org_staff(organization_id));

create policy parcels_select on public.parcels for select to authenticated
  using (stop_id in (select s.id from public.stops s));  -- inherits stops RLS
create policy parcels_insert on public.parcels for insert to authenticated
  with check (stop_id in (select s.id from public.stops s where s.organization_id = parcels.organization_id));
create policy parcels_staff_write on public.parcels for all to authenticated
  using (app.is_org_staff(organization_id)) with check (app.is_org_staff(organization_id));

create policy stop_events_select on public.stop_events for select to authenticated
  using (stop_id in (select s.id from public.stops s));

create policy proofs_select on public.proofs for select to authenticated
  using (stop_id in (select s.id from public.stops s));
create policy proofs_insert on public.proofs for insert to authenticated
  with check (created_by = auth.uid()
              and stop_id in (select s.id from public.stops s where s.organization_id = proofs.organization_id));

create policy pings_insert on public.location_pings for insert to authenticated
  with check (driver_id in (select app.my_driver_ids())
              and tour_id in (select t.id from public.tours t
                              where t.driver_id = location_pings.driver_id and t.status = 'in_progress'));
create policy pings_select on public.location_pings for select to authenticated
  using (app.is_org_staff(organization_id));

create policy audit_select on public.audit_log for select to authenticated
  using (app.is_org_admin(organization_id) or app.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Privileges (RLS decides row access; anon gets nothing)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public, app from public;
grant usage on schema app to authenticated;
grant execute on all functions in schema app to authenticated;
revoke execute on function app.purge_expired_data() from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.audit_log, public.stop_events, public.platform_admins from authenticated;
revoke update, delete on public.location_pings from authenticated;
grant execute on function public.driver_set_stop_status(uuid, public.stop_status, text) to authenticated;
grant execute on function public.driver_set_tour_status(uuid, public.tour_status) to authenticated;
