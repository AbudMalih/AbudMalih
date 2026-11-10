-- =============================================================================
-- P0-3.2 Stop-location history: original values, check results, human decisions
-- and an append-only audit of every address / coordinate change.
--
-- Four concepts, kept apart:
--   * original     stop_location_origins   immutable, captured when the stop is created
--                                            (existing stops: 'baseline_at_migration' – the
--                                            earliest RECORDED state, never called "original")
--   * current      public.stops            address + lat/lng as today, now versioned
--   * suggested    stop_location_checks     system result incl. approach suggestion (never applied)
--   * accepted     stop_location_decisions  confirmation + navigation approach chosen by staff,
--                                            valid only for the exact coordinate + address version
--
-- Actor and permission always come from the authenticated database context (auth.uid(),
-- memberships). Transaction settings from the API carry only content: the edit reason and the
-- declared import channel (turvio.change_reason, turvio.origin_provenance).
-- =============================================================================

-- ---------------------------------------------------------------- organisation settings
-- Retention (configurable per company). The audit default of 400 days is a product default for
-- operational review (one year plus a buffer), NOT a legal requirement; companies set their own.
-- null = keep until the company is deleted.
alter table public.organizations
  add column location_audit_retention_days int default 400 check (location_audit_retention_days between 30 and 3650),
  add column location_check_retention_days int not null default 30 check (location_check_retention_days between 1 and 365);

-- ---------------------------------------------------------------- stops: versions + precision
alter table public.stops
  add column address_version int not null default 1,
  add column location_version int not null default 1,
  add column location_precision text not null default 'unknown'
    check (location_precision in ('house', 'street', 'postal_code', 'city', 'manual_pin', 'import_unverified', 'unknown'));

-- ---------------------------------------------------------------- helpers
-- Depot that governs a stop: its tour's depot, or its own depot while unassigned.
create function app.stop_depot(p_stop uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(t.depot_id, s.depot_id)
    from public.stops s left join public.tours t on t.id = s.tour_id and t.organization_id = s.organization_id
   where s.id = p_stop;
$$;

-- Staff with access to the stop's depot (Phase B rule, fail-closed).
create function app.can_manage_stop(p_org uuid, p_stop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.can_access_depot(p_org, app.stop_depot(p_stop));
$$;

-- Role of the current user in an organisation, from memberships ('system' without a user).
create function app.actor_role(p_org uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select m.role::text from public.memberships m where m.organization_id = p_org and m.user_id = auth.uid() and m.active),
    case when auth.uid() is null then 'system' else 'none' end);
$$;

-- Location-relevant fields of a stop, for audit rows.
create function app.stop_location_json(s public.stops) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'street', s.street, 'houseNumber', s.house_number, 'postalCode', s.postal_code, 'city', s.city, 'countryCode', s.country_code,
    'lat', s.lat, 'lng', s.lng, 'locationSource', s.location_source, 'precision', s.location_precision,
    'addressVersion', s.address_version, 'locationVersion', s.location_version);
$$;

-- Edit reason from the API (content only, never identity). Trimmed, max 500 characters.
create function app.change_reason() returns text
language sql stable set search_path = '' as $$
  select nullif(left(trim(coalesce(current_setting('turvio.change_reason', true), '')), 500), '');
$$;

-- ---------------------------------------------------------------- tables
create table public.stop_location_origins (
  stop_id uuid primary key,
  organization_id uuid not null,
  kind text not null check (kind in ('original', 'baseline_at_migration')),
  provenance text not null check (provenance in ('import_file', 'import_paste', 'dispatch_manual', 'driver_capture', 'api', 'unknown')),
  street text not null,
  house_number text,
  postal_code text not null,
  city text not null,
  country_code char(2) not null,
  lat double precision,
  lng double precision,
  location_source text,
  location_precision text not null,
  captured_at timestamptz not null default now(),
  captured_by uuid,
  foreign key (organization_id, stop_id) references public.stops (organization_id, id),
  check ((lat is null) = (lng is null)),
  check (kind = 'original' or provenance = 'unknown')
);

create table public.stop_location_checks (
  stop_id uuid primary key,
  organization_id uuid not null,
  status text not null check (status in ('checked', 'partial')),
  severity text check (severity in ('error', 'warning', 'info')),
  issues jsonb not null default '[]'::jsonb,
  road jsonb,
  suggested_lat double precision,
  suggested_lng double precision,
  suggested_road_name text,
  suggested_distance_m int,
  checked_lat double precision not null,
  checked_lng double precision not null,
  checked_address_version int not null,
  road_data_version text not null,
  address_data_version text not null,
  rules_version int not null,
  checked_at timestamptz not null default now(),
  foreign key (organization_id, stop_id) references public.stops (organization_id, id) on delete cascade,
  check ((suggested_lat is null) = (suggested_lng is null))
);
create index stop_location_checks_flagged_idx on public.stop_location_checks (organization_id) where severity in ('error', 'warning');

create table public.stop_location_decisions (
  stop_id uuid primary key,
  organization_id uuid not null,
  confirmed_by uuid,
  confirmed_at timestamptz,
  confirmed_lat double precision,
  confirmed_lng double precision,
  confirmed_address_version int,
  confirmed_issue_codes text[],
  confirmation_note text check (char_length(confirmation_note) <= 500),
  approach_lat double precision,
  approach_lng double precision,
  approach_road_name text,
  approach_distance_m int,
  approach_accepted_by uuid,
  approach_accepted_at timestamptz,
  approach_for_lat double precision,
  approach_for_lng double precision,
  approach_for_address_version int,
  foreign key (organization_id, stop_id) references public.stops (organization_id, id) on delete cascade,
  check ((confirmed_at is null) = (confirmed_lat is null) and (confirmed_at is null) = (confirmed_address_version is null)),
  check ((approach_accepted_at is null) = (approach_lat is null) and (approach_accepted_at is null) = (approach_for_lat is null))
);

-- No foreign key to stops: the history outlives a deleted stop (retention below).
create table public.stop_location_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  stop_id uuid not null,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_role text not null,
  action text not null check (action in ('created', 'address_changed', 'location_changed', 'location_cleared', 'precision_changed',
    'confirmed', 'confirmation_invalidated', 'approach_accepted', 'approach_cleared', 'approach_invalidated', 'stop_deleted')),
  reason text check (char_length(reason) <= 500),
  previous jsonb,
  new jsonb
);
create index stop_location_events_stop_idx on public.stop_location_events (organization_id, stop_id, occurred_at desc);
create index stop_location_events_time_idx on public.stop_location_events (organization_id, occurred_at);

-- ---------------------------------------------------------------- privileges + RLS
-- Nobody writes these tables directly – only the definer functions and triggers below.
revoke all on public.stop_location_origins, public.stop_location_checks, public.stop_location_decisions, public.stop_location_events from anon, authenticated;
grant select on public.stop_location_origins, public.stop_location_checks, public.stop_location_decisions, public.stop_location_events to authenticated;

alter table public.stop_location_origins enable row level security;
alter table public.stop_location_checks enable row level security;
alter table public.stop_location_decisions enable row level security;
alter table public.stop_location_events enable row level security;

-- Originals and history: staff with access to the stop's depot only (D9: not drivers).
create policy stop_location_origins_select on public.stop_location_origins for select to authenticated
  using (app.can_manage_stop(organization_id, stop_id));
-- Events of a deleted stop: depot no longer resolvable → company admins only.
create policy stop_location_events_select on public.stop_location_events for select to authenticated
  using (app.can_manage_stop(organization_id, stop_id)
         or (app.is_org_admin(organization_id) and not exists (select 1 from public.stops s where s.id = stop_id)));
-- Check results and decisions: whoever may see the stop (staff of its depot, its published driver);
-- the driver app shows warnings and navigates to an accepted approach.
create policy stop_location_checks_select on public.stop_location_checks for select to authenticated
  using (stop_id in (select s.id from public.stops s));
create policy stop_location_decisions_select on public.stop_location_decisions for select to authenticated
  using (stop_id in (select s.id from public.stops s));

-- ---------------------------------------------------------------- append-only guard
-- UPDATE is never allowed. DELETE only through the paths that announce it in this transaction:
-- the stop's own deletion, the retention purge, or the company's deletion.
create function app.location_history_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    raise exception '% is append-only', tg_table_name using errcode = '42501';
  end if;
  if position(',' || old.organization_id::text || ',' in coalesce(current_setting('turvio.deleting_orgs', true), '')) > 0 then
    return old;
  end if;
  if tg_table_name = 'stop_location_origins' and current_setting('turvio.deleting_stop', true) = old.stop_id::text then
    return old;
  end if;
  if tg_table_name = 'stop_location_events' and current_setting('turvio.purging_location_events', true) = 'on' then
    return old;
  end if;
  raise exception '% rows cannot be deleted', tg_table_name using errcode = '42501';
end;
$$;
create trigger stop_location_origins_guard before update or delete on public.stop_location_origins for each row execute function app.location_history_guard();
create trigger stop_location_events_guard before update or delete on public.stop_location_events for each row execute function app.location_history_guard();

create function app.organizations_mark_deleting() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform set_config('turvio.deleting_orgs', coalesce(nullif(current_setting('turvio.deleting_orgs', true), ''), ',') || old.id::text || ',', true);
  return old;
end;
$$;
create trigger organizations_mark_deleting before delete on public.organizations for each row execute function app.organizations_mark_deleting();

-- ---------------------------------------------------------------- stop triggers
-- Versions are the database's: client values are ignored.
create function app.stops_location_init() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.address_version := 1;
  new.location_version := 1;
  if new.lat is null then
    new.location_precision := 'unknown';
  end if;
  return new;
end;
$$;
create trigger stops_location_init before insert on public.stops for each row execute function app.stops_location_init();

create function app.stops_location_versions() returns trigger
language plpgsql set search_path = '' as $$
declare
  address_changed boolean := (new.street, coalesce(new.house_number, ''), new.postal_code, new.city, new.country_code)
                             is distinct from (old.street, coalesce(old.house_number, ''), old.postal_code, old.city, old.country_code);
  location_changed boolean := (new.lat, new.lng) is distinct from (old.lat, old.lng);
  declared text := current_setting('turvio.location_precision', true);
begin
  new.address_version := old.address_version + case when address_changed then 1 else 0 end;
  new.location_version := old.location_version + case when location_changed then 1 else 0 end;
  -- A moved coordinate keeps no claim about its precision unless the writer states one for this
  -- change (turvio.location_precision, set by the API / driver functions for this statement).
  if location_changed then
    new.location_precision := case when declared in ('house', 'street', 'postal_code', 'city', 'manual_pin', 'import_unverified') then declared else 'unknown' end;
  end if;
  if new.lat is null then
    new.location_precision := 'unknown';
  end if;
  return new;
end;
$$;
-- Name sorts after stops_address_guard (which may clear lat/lng) and before stops_touch.
create trigger stops_location_versions before update on public.stops for each row execute function app.stops_location_versions();

create function app.stops_location_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  role text := app.actor_role(new.organization_id);
  declared text := current_setting('turvio.origin_provenance', true);
  prov text;
begin
  -- Drivers' stops are driver captures, whatever the client declares. Staff may declare the
  -- import channel; anything else is 'api'.
  prov := case
    when role = 'driver' then 'driver_capture'
    when declared in ('import_file', 'import_paste', 'dispatch_manual') then declared
    else 'api' end;
  insert into public.stop_location_origins (stop_id, organization_id, kind, provenance, street, house_number, postal_code, city, country_code, lat, lng, location_source, location_precision, captured_by)
  values (new.id, new.organization_id, 'original', prov, new.street, new.house_number, new.postal_code, new.city, new.country_code, new.lat, new.lng, new.location_source, new.location_precision, auth.uid());
  insert into public.stop_location_events (organization_id, stop_id, actor_user_id, actor_role, action, reason, previous, new)
  values (new.organization_id, new.id, auth.uid(), role, 'created', app.change_reason(), null, app.stop_location_json(new) || jsonb_build_object('provenance', prov));
  return null;
end;
$$;
create trigger stops_location_created after insert on public.stops for each row execute function app.stops_location_created();

create function app.stops_location_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  address_changed boolean := new.address_version <> old.address_version;
  location_changed boolean := new.location_version <> old.location_version;
  role text;
  reason text := app.change_reason();
  published boolean;
  d public.stop_location_decisions;
begin
  if not address_changed and not location_changed then
    if new.location_precision is distinct from old.location_precision then
      insert into public.stop_location_events (organization_id, stop_id, actor_user_id, actor_role, action, reason, previous, new)
      values (new.organization_id, new.id, auth.uid(), app.actor_role(new.organization_id), 'precision_changed', reason, app.stop_location_json(old), app.stop_location_json(new));
    end if;
    return null;
  end if;
  role := app.actor_role(new.organization_id);
  -- D4: after publication, staff must say why they change a delivery location.
  select t.published_at is not null into published from public.tours t where t.id = new.tour_id;
  if coalesce(published, false) and role in ('owner', 'admin', 'dispatcher') and reason is null then
    raise exception 'a reason is required to change the address or location of a stop on a published tour' using errcode = '22023';
  end if;
  insert into public.stop_location_events (organization_id, stop_id, actor_user_id, actor_role, action, reason, previous, new)
  values (new.organization_id, new.id, auth.uid(), role,
          case when address_changed then 'address_changed' when new.lat is null then 'location_cleared' else 'location_changed' end,
          reason, app.stop_location_json(old), app.stop_location_json(new));
  -- Decisions belong to the exact coordinate and address version: invalidate.
  select * into d from public.stop_location_decisions where stop_id = new.id for update;
  if found then
    if d.confirmed_at is not null then
      insert into public.stop_location_events (organization_id, stop_id, actor_user_id, actor_role, action, reason, previous, new)
      values (new.organization_id, new.id, auth.uid(), role, 'confirmation_invalidated', reason,
              jsonb_build_object('confirmedBy', d.confirmed_by, 'confirmedAt', d.confirmed_at, 'lat', d.confirmed_lat, 'lng', d.confirmed_lng, 'addressVersion', d.confirmed_address_version, 'issueCodes', d.confirmed_issue_codes), null);
    end if;
    if d.approach_accepted_at is not null then
      insert into public.stop_location_events (organization_id, stop_id, actor_user_id, actor_role, action, reason, previous, new)
      values (new.organization_id, new.id, auth.uid(), role, 'approach_invalidated', reason,
              jsonb_build_object('lat', d.approach_lat, 'lng', d.approach_lng, 'roadName', d.approach_road_name, 'acceptedBy', d.approach_accepted_by, 'acceptedAt', d.approach_accepted_at), null);
    end if;
    delete from public.stop_location_decisions where stop_id = new.id;
  end if;
  delete from public.stop_location_checks where stop_id = new.id;
  return null;
end;
$$;
create trigger stops_location_changed after update on public.stops for each row execute function app.stops_location_changed();

create function app.stops_location_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Part of the company's deletion: its whole history goes with it (no event for a deleted company).
  if position(',' || old.organization_id::text || ',' in coalesce(current_setting('turvio.deleting_orgs', true), '')) = 0 then
    insert into public.stop_location_events (organization_id, stop_id, actor_user_id, actor_role, action, reason, previous, new)
    values (old.organization_id, old.id, auth.uid(), app.actor_role(old.organization_id), 'stop_deleted', app.change_reason(), app.stop_location_json(old), null);
  end if;
  perform set_config('turvio.deleting_stop', old.id::text, true);
  delete from public.stop_location_origins where stop_id = old.id;
  perform set_config('turvio.deleting_stop', '', true);
  return old;
end;
$$;
create trigger stops_location_deleted before delete on public.stops for each row execute function app.stops_location_deleted();

-- ---------------------------------------------------------------- staff decisions (definer functions)
-- The caller states what they looked at; a changed stop is a conflict (40001), never a silent
-- confirmation of something else.
create function app.lock_stop_for_decision(p_stop uuid, p_expected_lat double precision, p_expected_lng double precision, p_expected_address_version int)
returns public.stops
language plpgsql security definer set search_path = '' as $$
declare
  s public.stops;
begin
  select * into s from public.stops where id = p_stop for update;
  if not found or not app.can_manage_stop(s.organization_id, s.id) then
    raise exception 'stop not found' using errcode = 'P0002';
  end if;
  if s.lat is null then
    raise exception 'the stop has no map position' using errcode = '22023';
  end if;
  if s.lat is distinct from p_expected_lat or s.lng is distinct from p_expected_lng or s.address_version is distinct from p_expected_address_version then
    raise exception 'stop location changed' using errcode = '40001';
  end if;
  return s;
end;
$$;

create function public.confirm_stop_location(p_stop uuid, p_expected_lat double precision, p_expected_lng double precision, p_expected_address_version int, p_issue_codes text[], p_note text default null)
returns public.stop_location_decisions
language plpgsql security definer set search_path = '' as $$
declare
  s public.stops := app.lock_stop_for_decision(p_stop, p_expected_lat, p_expected_lng, p_expected_address_version);
  d public.stop_location_decisions;
begin
  insert into public.stop_location_decisions (stop_id, organization_id, confirmed_by, confirmed_at, confirmed_lat, confirmed_lng, confirmed_address_version, confirmed_issue_codes, confirmation_note)
  values (s.id, s.organization_id, auth.uid(), now(), s.lat, s.lng, s.address_version, coalesce(p_issue_codes, '{}'), nullif(left(trim(coalesce(p_note, '')), 500), ''))
  on conflict (stop_id) do update set confirmed_by = excluded.confirmed_by, confirmed_at = excluded.confirmed_at, confirmed_lat = excluded.confirmed_lat,
    confirmed_lng = excluded.confirmed_lng, confirmed_address_version = excluded.confirmed_address_version, confirmed_issue_codes = excluded.confirmed_issue_codes,
    confirmation_note = excluded.confirmation_note
  returning * into d;
  insert into public.stop_location_events (organization_id, stop_id, actor_user_id, actor_role, action, reason, previous, new)
  values (s.organization_id, s.id, auth.uid(), app.actor_role(s.organization_id), 'confirmed', d.confirmation_note, null,
          jsonb_build_object('lat', s.lat, 'lng', s.lng, 'addressVersion', s.address_version, 'issueCodes', d.confirmed_issue_codes));
  perform pg_notify('turvio_changes', json_build_object('org', s.organization_id, 'depot', app.stop_depot(s.id), 'tour', s.tour_id, 'table', 'stops', 'op', 'update')::text);
  return d;
end;
$$;

-- D5: any point within 300 m of the stop; the API validates road access (non-motorway snap)
-- before calling. Never applied automatically: only this explicit call sets it.
create function public.accept_stop_approach(p_stop uuid, p_lat double precision, p_lng double precision, p_road_name text, p_distance_m int,
  p_expected_lat double precision, p_expected_lng double precision, p_expected_address_version int, p_reason text default null)
returns public.stop_location_decisions
language plpgsql security definer set search_path = '' as $$
declare
  s public.stops := app.lock_stop_for_decision(p_stop, p_expected_lat, p_expected_lng, p_expected_address_version);
  d public.stop_location_decisions;
  meters double precision;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid approach coordinates' using errcode = '22023';
  end if;
  meters := 2 * 6371008.8 * asin(least(1, sqrt(power(sin(radians(p_lat - s.lat) / 2), 2)
            + cos(radians(s.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - s.lng) / 2), 2))));
  if meters > 300 then
    raise exception 'the approach point must be within 300 m of the stop' using errcode = '22023';
  end if;
  insert into public.stop_location_decisions (stop_id, organization_id, approach_lat, approach_lng, approach_road_name, approach_distance_m, approach_accepted_by, approach_accepted_at, approach_for_lat, approach_for_lng, approach_for_address_version)
  values (s.id, s.organization_id, p_lat, p_lng, left(coalesce(p_road_name, ''), 200), coalesce(p_distance_m, round(meters)::int), auth.uid(), now(), s.lat, s.lng, s.address_version)
  on conflict (stop_id) do update set approach_lat = excluded.approach_lat, approach_lng = excluded.approach_lng, approach_road_name = excluded.approach_road_name,
    approach_distance_m = excluded.approach_distance_m, approach_accepted_by = excluded.approach_accepted_by, approach_accepted_at = excluded.approach_accepted_at,
    approach_for_lat = excluded.approach_for_lat, approach_for_lng = excluded.approach_for_lng, approach_for_address_version = excluded.approach_for_address_version
  returning * into d;
  insert into public.stop_location_events (organization_id, stop_id, actor_user_id, actor_role, action, reason, previous, new)
  values (s.organization_id, s.id, auth.uid(), app.actor_role(s.organization_id), 'approach_accepted', nullif(left(trim(coalesce(p_reason, '')), 500), ''), null,
          jsonb_build_object('lat', p_lat, 'lng', p_lng, 'roadName', d.approach_road_name, 'distanceM', d.approach_distance_m, 'forLat', s.lat, 'forLng', s.lng, 'addressVersion', s.address_version));
  perform pg_notify('turvio_changes', json_build_object('org', s.organization_id, 'depot', app.stop_depot(s.id), 'tour', s.tour_id, 'table', 'stops', 'op', 'update')::text);
  return d;
end;
$$;

create function public.clear_stop_approach(p_stop uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.stops;
  d public.stop_location_decisions;
begin
  select * into s from public.stops where id = p_stop for update;
  if not found or not app.can_manage_stop(s.organization_id, s.id) then
    raise exception 'stop not found' using errcode = 'P0002';
  end if;
  select * into d from public.stop_location_decisions where stop_id = p_stop for update;
  if not found or d.approach_accepted_at is null then
    return;
  end if;
  update public.stop_location_decisions set approach_lat = null, approach_lng = null, approach_road_name = null, approach_distance_m = null,
    approach_accepted_by = null, approach_accepted_at = null, approach_for_lat = null, approach_for_lng = null, approach_for_address_version = null
   where stop_id = p_stop;
  insert into public.stop_location_events (organization_id, stop_id, actor_user_id, actor_role, action, reason, previous, new)
  values (s.organization_id, s.id, auth.uid(), app.actor_role(s.organization_id), 'approach_cleared', nullif(left(trim(coalesce(p_reason, '')), 500), ''),
          jsonb_build_object('lat', d.approach_lat, 'lng', d.approach_lng, 'roadName', d.approach_road_name), null);
  perform pg_notify('turvio_changes', json_build_object('org', s.organization_id, 'depot', app.stop_depot(s.id), 'tour', s.tour_id, 'table', 'stops', 'op', 'update')::text);
end;
$$;

-- ---------------------------------------------------------------- system: store a check result
-- Called by the API's own database role only (not by users). Stores nothing if the stop changed
-- since the check started (the result would describe another location).
create function app.store_location_check(p_stop uuid, p_status text, p_severity text, p_issues jsonb, p_road jsonb,
  p_suggested_lat double precision, p_suggested_lng double precision, p_suggested_road_name text, p_suggested_distance_m int,
  p_checked_lat double precision, p_checked_lng double precision, p_checked_address_version int,
  p_road_data_version text, p_address_data_version text, p_rules_version int)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  s public.stops;
begin
  select * into s from public.stops where id = p_stop for share;
  if not found or s.lat is distinct from p_checked_lat or s.lng is distinct from p_checked_lng or s.address_version <> p_checked_address_version then
    return false;
  end if;
  insert into public.stop_location_checks (stop_id, organization_id, status, severity, issues, road, suggested_lat, suggested_lng, suggested_road_name, suggested_distance_m,
    checked_lat, checked_lng, checked_address_version, road_data_version, address_data_version, rules_version, checked_at)
  values (s.id, s.organization_id, p_status, p_severity, coalesce(p_issues, '[]'), p_road, p_suggested_lat, p_suggested_lng, p_suggested_road_name, p_suggested_distance_m,
    p_checked_lat, p_checked_lng, p_checked_address_version, p_road_data_version, p_address_data_version, p_rules_version, now())
  on conflict (stop_id) do update set status = excluded.status, severity = excluded.severity, issues = excluded.issues, road = excluded.road,
    suggested_lat = excluded.suggested_lat, suggested_lng = excluded.suggested_lng, suggested_road_name = excluded.suggested_road_name,
    suggested_distance_m = excluded.suggested_distance_m, checked_lat = excluded.checked_lat, checked_lng = excluded.checked_lng,
    checked_address_version = excluded.checked_address_version, road_data_version = excluded.road_data_version,
    address_data_version = excluded.address_data_version, rules_version = excluded.rules_version, checked_at = excluded.checked_at;
  return true;
end;
$$;

-- ---------------------------------------------------------------- driver edits: reason + stale check
-- Same permissions as before (own published tour, or staff of the depot); now with an optional
-- reason and an optional expected location version (offline edits that meet a newer dispatcher
-- change fail with 40001 instead of overwriting it).
drop function public.driver_update_stop(uuid, boolean, double precision, double precision, text);
create function public.driver_update_stop(p_stop_id uuid, p_locked boolean default null, p_lat double precision default null, p_lng double precision default null,
  p_location_source text default null, p_reason text default null, p_expected_location_version int default null)
returns public.stops
language plpgsql security definer set search_path = '' as $$
declare
  s public.stops;
begin
  select st.* into s from public.stops st
  join public.tours t on t.id = st.tour_id and t.organization_id = st.organization_id
  where st.id = p_stop_id
    and ((t.driver_id in (select app.my_driver_ids()) and t.published_at is not null)
         or app.can_access_depot(t.organization_id, t.depot_id))
  for update of st;
  if not found then
    raise exception 'stop not found' using errcode = 'P0002';
  end if;
  if (p_lat is null) <> (p_lng is null) then
    raise exception 'lat and lng go together' using errcode = '22023';
  end if;
  if p_location_source is not null and p_location_source not in ('geocoder', 'manual_pin') then
    raise exception 'invalid location source' using errcode = '22023';
  end if;
  if p_lat is not null and p_expected_location_version is not null and s.location_version <> p_expected_location_version then
    raise exception 'stop location changed' using errcode = '40001';
  end if;
  perform set_config('turvio.change_reason', coalesce(p_reason, ''), true);
  perform set_config('turvio.location_precision', case when coalesce(p_location_source, 'manual_pin') = 'manual_pin' then 'manual_pin' else '' end, true);
  update public.stops
     set locked = coalesce(p_locked, locked),
         lat = coalesce(p_lat, lat),
         lng = coalesce(p_lng, lng),
         location_source = case when p_lat is not null then coalesce(p_location_source, 'manual_pin') else location_source end
   where id = p_stop_id
   returning * into s;
  perform set_config('turvio.change_reason', '', true);
  perform set_config('turvio.location_precision', '', true);
  return s;
end;
$$;

drop function public.driver_edit_stop(uuid, text, text, text, text, text, double precision, double precision, text);
create function public.driver_edit_stop(
  p_stop_id uuid, p_recipient_name text, p_street text, p_house_number text, p_postal_code text, p_city text,
  p_lat double precision default null, p_lng double precision default null, p_location_source text default null,
  p_reason text default null, p_expected_address_version int default null
) returns public.stops
language plpgsql security definer set search_path = '' as $$
declare
  s public.stops := app.editable_stop(p_stop_id);
begin
  if not app.is_open_status(s.status) then
    raise exception 'only open stops can be edited' using errcode = '22023';
  end if;
  if coalesce(trim(p_street), '') = '' or coalesce(trim(p_city), '') = '' or p_postal_code !~ '^[0-9A-Za-z -]{3,10}$' then
    raise exception 'street, postal code and city are required' using errcode = '22023';
  end if;
  if (p_lat is null) <> (p_lng is null) then
    raise exception 'lat and lng go together' using errcode = '22023';
  end if;
  if p_expected_address_version is not null and s.address_version <> p_expected_address_version then
    raise exception 'stop address changed' using errcode = '40001';
  end if;
  perform set_config('turvio.change_reason', coalesce(p_reason, ''), true);
  perform set_config('turvio.location_precision', case when coalesce(p_location_source, 'manual_pin') = 'manual_pin' then 'manual_pin' else '' end, true);
  update public.stops
     set recipient_name = nullif(trim(p_recipient_name), ''),
         street = trim(p_street), house_number = nullif(trim(p_house_number), ''),
         postal_code = trim(p_postal_code), city = trim(p_city),
         lat = coalesce(p_lat, lat), lng = coalesce(p_lng, lng),
         location_source = case when p_lat is not null then coalesce(p_location_source, 'manual_pin') else location_source end
   where id = p_stop_id
   returning * into s;
  perform set_config('turvio.change_reason', '', true);
  perform set_config('turvio.location_precision', '', true);
  return s;
end;
$$;

-- ---------------------------------------------------------------- retention
create or replace function app.purge_expired_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.location_pings lp
  using public.organizations o
  where o.id = lp.organization_id
    and lp.recorded_at < now() - make_interval(days => o.location_retention_days);
  delete from public.driver_positions where recorded_at < now() - interval '24 hours';
  delete from public.proofs p
  using public.organizations o
  where o.id = p.organization_id
    and p.created_at < now() - make_interval(days => o.proof_retention_days);
  -- Check results: N days after the stop's tour was completed (recomputed on demand anyway).
  delete from public.stop_location_checks c
  using public.stops s, public.tours t, public.organizations o
  where s.id = c.stop_id and t.id = s.tour_id and o.id = c.organization_id
    and t.status = 'completed' and t.finished_at < now() - make_interval(days => o.location_check_retention_days);
  -- Location audit: per company setting (null = keep). Includes events of deleted stops.
  perform set_config('turvio.purging_location_events', 'on', true);
  delete from public.stop_location_events e
  using public.organizations o
  where o.id = e.organization_id and o.location_audit_retention_days is not null
    and e.occurred_at < now() - make_interval(days => o.location_audit_retention_days);
  perform set_config('turvio.purging_location_events', '', true);
end;
$$;

-- ---------------------------------------------------------------- execute permissions
revoke execute on function app.stop_depot(uuid), app.can_manage_stop(uuid, uuid), app.actor_role(uuid), app.stop_location_json(public.stops), app.change_reason(),
  app.location_history_guard(), app.organizations_mark_deleting(), app.stops_location_init(), app.stops_location_versions(),
  app.stops_location_created(), app.stops_location_changed(), app.stops_location_deleted(),
  app.lock_stop_for_decision(uuid, double precision, double precision, int),
  app.store_location_check(uuid, text, text, jsonb, jsonb, double precision, double precision, text, int, double precision, double precision, int, text, text, int),
  app.purge_expired_data() from public, anon, authenticated;
-- RLS policies call these as the querying user.
grant execute on function app.stop_depot(uuid), app.can_manage_stop(uuid, uuid) to authenticated;
revoke execute on function public.confirm_stop_location(uuid, double precision, double precision, int, text[], text),
  public.accept_stop_approach(uuid, double precision, double precision, text, int, double precision, double precision, int, text),
  public.clear_stop_approach(uuid, text),
  public.driver_update_stop(uuid, boolean, double precision, double precision, text, text, int),
  public.driver_edit_stop(uuid, text, text, text, text, text, double precision, double precision, text, text, int) from public, anon;
grant execute on function public.confirm_stop_location(uuid, double precision, double precision, int, text[], text),
  public.accept_stop_approach(uuid, double precision, double precision, text, int, double precision, double precision, int, text),
  public.clear_stop_approach(uuid, text),
  public.driver_update_stop(uuid, boolean, double precision, double precision, text, text, int),
  public.driver_edit_stop(uuid, text, text, text, text, text, double precision, double precision, text, text, int) to authenticated;

-- ---------------------------------------------------------------- backfill (existing stops)
-- Earliest RECORDED state, clearly labelled: kind 'baseline_at_migration', provenance 'unknown',
-- no captured_by. No events are invented for the past.
insert into public.stop_location_origins (stop_id, organization_id, kind, provenance, street, house_number, postal_code, city, country_code, lat, lng, location_source, location_precision, captured_at, captured_by)
select s.id, s.organization_id, 'baseline_at_migration', 'unknown', s.street, s.house_number, s.postal_code, s.city, s.country_code, s.lat, s.lng, s.location_source, 'unknown', now(), null
  from public.stops s;
