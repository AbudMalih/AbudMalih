-- Phase 4: driver execution – arrival, outcomes with failure reasons, driver
-- notes, parcel scans, personal routes, proof of delivery, idempotent offline
-- sync, and database-level protection against double-booking.

-- Organization settings for drivers ---------------------------------------------
-- {"failureReasons":[{"code":"...","label":"...","requiresNote":bool}],
--  "podLocation":bool,  -- store device position with proof of delivery
--  "showRecipientPhone":bool}
alter table public.organizations add column driver_settings jsonb not null default '{}'::jsonb
  check (jsonb_typeof(driver_settings) = 'object');

create or replace function app.default_failure_reasons() returns text[]
language sql immutable as $$
  select array['recipient_absent','refused','address_not_found','no_access','damaged','business_closed','rescheduled_by_recipient','other'];
$$;

create or replace function app.failure_reason_allowed(p_org uuid, p_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when jsonb_typeof(o.driver_settings -> 'failureReasons') = 'array' and jsonb_array_length(o.driver_settings -> 'failureReasons') > 0
      then exists (select 1 from jsonb_array_elements(o.driver_settings -> 'failureReasons') r where r ->> 'code' = p_code)
    else p_code = any (app.default_failure_reasons())
  end
  from public.organizations o where o.id = p_org;
$$;

-- Stops ---------------------------------------------------------------------------
alter table public.stops
  add column failure_reason text check (char_length(failure_reason) <= 40),
  add column driver_notes text check (char_length(driver_notes) <= 1000),
  add column locked boolean not null default false,
  add column location_source text check (location_source in ('geocoder', 'manual_pin', 'import', 'dispatch')),
  add column recipient_phone text check (char_length(recipient_phone) <= 40),
  add column arrived_at timestamptz,
  add column status_changed_at timestamptz;

alter table public.parcels add column loaded_at timestamptz;
create index parcels_stop_idx on public.parcels (stop_id);

alter table public.stop_events
  add column kind text not null default 'status' check (kind in ('status', 'note')),
  add column failure_reason text check (char_length(failure_reason) <= 40),
  add column client_event_id uuid,
  add column occurred_at timestamptz,
  -- false when a delayed (offline) update arrived after a newer one and was not applied
  add column applied boolean not null default true;
create unique index stop_events_client_event_uidx on public.stop_events (organization_id, client_event_id) where client_event_id is not null;

-- Tours: personal routes created by drivers ---------------------------------------
alter table public.tours add column origin text not null default 'dispatch' check (origin in ('dispatch', 'driver'));

-- Double-booking protection (concurrent requests): one open dispatch tour per
-- driver and per vehicle and day. Completed tours and personal routes are exempt.
create unique index tours_driver_day_open_uidx on public.tours (organization_id, driver_id, tour_date)
  where driver_id is not null and status <> 'completed' and origin = 'dispatch';
create unique index tours_vehicle_day_open_uidx on public.tours (organization_id, vehicle_id, tour_date)
  where vehicle_id is not null and status <> 'completed' and origin = 'dispatch';

-- Open = pending or in_progress (arrived) --------------------------------------------
create or replace function app.is_open_status(s public.stop_status) returns boolean
language sql immutable as $$ select s in ('pending', 'in_progress') $$;

alter table public.stops drop constraint stops_unassigned_pending;
alter table public.stops add constraint stops_unassigned_pending check (tour_id is not null or status = 'pending');

-- Stop status RPC v2: idempotent (client_event_id), ordered (occurred_at), with failure reasons.
drop function public.driver_set_stop_status(uuid, public.stop_status, text);
create function public.driver_set_stop_status(
  p_stop_id uuid,
  p_status public.stop_status,
  p_notes text default null,
  p_failure_reason text default null,
  p_client_event_id uuid default null,
  p_occurred_at timestamptz default null
) returns public.stops
language plpgsql security definer set search_path = '' as $$
declare
  s public.stops;
  at timestamptz := least(coalesce(p_occurred_at, now()), now());
  not_delivered boolean := p_status in ('failed', 'attempted', 'rescheduled', 'returned');
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
  -- Retried submission of the same offline action: already recorded.
  if p_client_event_id is not null and exists (
    select 1 from public.stop_events e where e.organization_id = s.organization_id and e.client_event_id = p_client_event_id) then
    return s;
  end if;
  if s.status = p_status then
    return s;
  end if;
  -- An older offline change arriving after a newer one: record, do not apply.
  if s.status_changed_at is not null and at < s.status_changed_at then
    insert into public.stop_events (organization_id, stop_id, status, notes, failure_reason, actor_user_id, client_event_id, occurred_at, applied)
    values (s.organization_id, s.id, p_status, p_notes, p_failure_reason, auth.uid(), p_client_event_id, at, false);
    return s;
  end if;
  if not app.is_open_status(s.status) and p_status <> 'pending' then
    raise exception 'invalid status transition % -> %', s.status, p_status using errcode = '22023';
  end if;
  if (p_status = 'delivered' and s.type <> 'delivery') or (p_status = 'picked_up' and s.type <> 'pickup') then
    raise exception 'status % not valid for stop type %', p_status, s.type using errcode = '22023';
  end if;
  if not_delivered and (p_failure_reason is null or not app.failure_reason_allowed(s.organization_id, p_failure_reason)) then
    raise exception 'a valid failure reason is required' using errcode = '22023';
  end if;
  update public.stops
     set status = p_status,
         completed_at = case when app.is_open_status(p_status) then null else at end,
         arrived_at = case when p_status = 'in_progress' then at when p_status = 'pending' then null else arrived_at end,
         failure_reason = case when not_delivered then p_failure_reason end,
         driver_notes = coalesce(p_notes, driver_notes),
         status_changed_at = at
   where id = p_stop_id
   returning * into s;
  insert into public.stop_events (organization_id, stop_id, status, notes, failure_reason, actor_user_id, client_event_id, occurred_at)
  values (s.organization_id, s.id, p_status, p_notes, p_failure_reason, auth.uid(), p_client_event_id, at);
  return s;
end;
$$;

-- Driver note (without status change), idempotent.
create function public.driver_add_stop_note(p_stop_id uuid, p_note text, p_client_event_id uuid default null)
returns public.stops
language plpgsql security definer set search_path = '' as $$
declare
  s public.stops;
begin
  if p_note is null or char_length(trim(p_note)) = 0 or char_length(p_note) > 1000 then
    raise exception 'note must be 1-1000 characters' using errcode = '22023';
  end if;
  select st.* into s from public.stops st
  join public.tours t on t.id = st.tour_id and t.organization_id = st.organization_id
  where st.id = p_stop_id
    and ((t.driver_id in (select app.my_driver_ids()) and t.published_at is not null)
         or app.can_access_depot(t.organization_id, t.depot_id))
  for update of st;
  if not found then
    raise exception 'stop not found' using errcode = 'P0002';
  end if;
  if p_client_event_id is not null and exists (
    select 1 from public.stop_events e where e.organization_id = s.organization_id and e.client_event_id = p_client_event_id) then
    return s;
  end if;
  update public.stops set driver_notes = trim(p_note) where id = p_stop_id returning * into s;
  insert into public.stop_events (organization_id, stop_id, status, kind, notes, actor_user_id, client_event_id)
  values (s.organization_id, s.id, s.status, 'note', trim(p_note), auth.uid(), p_client_event_id);
  return s;
end;
$$;

-- Tour status: repeating the current status is a no-op (offline retries).
create or replace function public.driver_set_tour_status(p_tour_id uuid, p_status public.tour_status)
returns public.tours
language plpgsql security definer set search_path = '' as $$
declare
  t public.tours;
begin
  select * into t from public.tours
  where id = p_tour_id
    and ((driver_id in (select app.my_driver_ids()) and published_at is not null) or app.can_access_depot(organization_id, depot_id))
  for update;
  if not found then
    raise exception 'tour not found' using errcode = 'P0002';
  end if;
  if t.status = p_status then
    return t;
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

-- Parcel scans: mark parcels of the tour as loaded. Returns matched / unknown codes.
create function public.driver_record_scans(p_tour_id uuid, p_scans jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.tours;
  sc jsonb;
  code text;
  matched text[] := '{}';
  unknown text[] := '{}';
  n int;
begin
  if jsonb_typeof(p_scans) <> 'array' or jsonb_array_length(p_scans) > 1000 then
    raise exception 'scans must be an array of at most 1000 items' using errcode = '22023';
  end if;
  select * into t from public.tours
   where id = p_tour_id
     and ((driver_id in (select app.my_driver_ids()) and published_at is not null) or app.can_access_depot(organization_id, depot_id));
  if not found then
    raise exception 'tour not found' using errcode = 'P0002';
  end if;
  for sc in select * from jsonb_array_elements(p_scans) loop
    code := upper(trim(sc ->> 'code'));
    if code is null or char_length(code) < 5 or char_length(code) > 64 then continue; end if;
    update public.parcels p
       set loaded_at = coalesce(p.loaded_at, least(coalesce((sc ->> 'at')::timestamptz, now()), now()))
      from public.stops s
     where s.id = p.stop_id and s.tour_id = t.id and p.organization_id = t.organization_id
       and (upper(p.tracking_number) = code or upper(p.barcode) = code);
    get diagnostics n = row_count;
    if n > 0 then matched := matched || code; else unknown := unknown || code; end if;
  end loop;
  if cardinality(matched) > 0 then
    -- touch one stop so the change feed informs Dispatch
    update public.stops set updated_at = now() where id = (select s.id from public.stops s where s.tour_id = t.id order by s.sequence limit 1);
  end if;
  return jsonb_build_object('matched', to_jsonb(matched), 'unknown', to_jsonb(unknown));
end;
$$;

-- Personal route: a driver creates their own tour (idempotent by client id).
create function public.driver_create_tour(p_id uuid, p_name text, p_date date)
returns public.tours
language plpgsql security definer set search_path = '' as $$
declare
  d public.drivers;
  t public.tours;
begin
  select * into t from public.tours where id = p_id;
  if found then
    if t.driver_id in (select app.my_driver_ids()) then return t; end if;
    raise exception 'tour id already in use' using errcode = '23505';
  end if;
  select dr.* into d from public.drivers dr
   where dr.user_id = auth.uid() and dr.active and app.is_org_member(dr.organization_id)
   order by dr.created_at limit 1;
  if not found then
    raise exception 'no active driver profile' using errcode = '42501';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 120 then
    raise exception 'name must be 1-120 characters' using errcode = '22023';
  end if;
  insert into public.tours (id, organization_id, depot_id, driver_id, name, tour_date, origin, published_at, published_by)
  values (p_id, d.organization_id, d.depot_id, d.id, trim(p_name), p_date, 'driver', now(), auth.uid())
  returning * into t;
  return t;
end;
$$;

-- Sequence: open = pending or in_progress; locked stops are honoured by the caller.
create or replace function public.set_tour_sequence(p_tour uuid, p_stop_ids uuid[], p_meta jsonb default null)
returns public.tours
language plpgsql security definer set search_path = '' as $$
declare
  t public.tours;
  bad int;
begin
  select * into t from public.tours where id = p_tour for update;
  if not found or not (
    app.can_access_depot(t.organization_id, t.depot_id)
    or (t.published_at is not null and t.driver_id in (select app.my_driver_ids()))
  ) then
    raise exception 'tour not found' using errcode = 'P0002';
  end if;
  if t.status = 'completed' then
    raise exception 'tour is completed' using errcode = '22023';
  end if;
  select count(*) into bad from unnest(p_stop_ids) as u(sid)
   where not exists (select 1 from public.stops s where s.id = u.sid and s.tour_id = p_tour and app.is_open_status(s.status));
  if bad > 0 then
    raise exception 'stop list contains stops that are not open stops of this tour' using errcode = '22023';
  end if;
  with ordered as (
    select s.id,
           row_number() over (
             order by case when not app.is_open_status(s.status) then 0 when array_position(p_stop_ids, s.id) is not null then 1 else 2 end,
                      case when not app.is_open_status(s.status) then s.sequence else coalesce(array_position(p_stop_ids, s.id), 100000 + s.sequence) end
           ) - 1 as seq
      from public.stops s where s.tour_id = p_tour
  )
  update public.stops s set sequence = o.seq from ordered o where s.id = o.id and s.sequence <> o.seq;
  if p_meta is not null then
    update public.tours set optimized_at = now(), optimization = p_meta where id = p_tour returning * into t;
  end if;
  return t;
end;
$$;

-- Driver may lock/unlock stop positions and correct the map position of stops on their own tour.
create function public.driver_update_stop(p_stop_id uuid, p_locked boolean default null, p_lat double precision default null, p_lng double precision default null, p_location_source text default null)
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
  update public.stops
     set locked = coalesce(p_locked, locked),
         lat = coalesce(p_lat, lat),
         lng = coalesce(p_lng, lng),
         location_source = case when p_lat is not null then coalesce(p_location_source, 'manual_pin') else location_source end
   where id = p_stop_id
   returning * into s;
  return s;
end;
$$;

-- Proof of delivery ------------------------------------------------------------------
alter table public.proofs
  add column recipient_name text check (char_length(recipient_name) <= 120),
  add column notes text check (char_length(notes) <= 1000),
  add column captured_at timestamptz not null default now(),
  add column lat double precision check (lat between -90 and 90),
  add column lng double precision check (lng between -180 and 180),
  add column content_type text not null default 'image/jpeg' check (content_type in ('image/jpeg', 'image/png', 'image/svg+xml')),
  add column size_bytes int check (size_bytes between 1 and 10485760),
  add column sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  add constraint proofs_location_pair check ((lat is null) = (lng is null)),
  add constraint proofs_org_id_uniq unique (organization_id, id);

-- Proofs only for stops of tours the user may work on (driver: own published tour; staff: depot scope).
drop policy proofs_insert on public.proofs;
create policy proofs_insert on public.proofs for insert to authenticated
  with check (created_by = auth.uid()
              and stop_id in (select s.id from public.stops s
                              join public.tours t on t.id = s.tour_id
                              where s.organization_id = proofs.organization_id
                                and ((t.driver_id in (select app.my_driver_ids()) and t.published_at is not null)
                                     or app.can_access_depot(t.organization_id, t.depot_id))));
create policy proofs_delete on public.proofs for delete to authenticated
  using (app.is_org_admin(organization_id));
grant delete on public.proofs to authenticated;

-- Files of deleted proofs (manual deletion or retention purge) are removed by the API worker.
create table app.storage_deletions (
  id bigint generated always as identity primary key,
  bucket text not null,
  path text not null,
  queued_at timestamptz not null default now()
);
revoke all on app.storage_deletions from public, anon, authenticated;

create or replace function app.queue_proof_file_deletion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into app.storage_deletions (bucket, path) values ('proofs', old.storage_path);
  return old;
end;
$$;
create trigger proofs_queue_file_deletion after delete on public.proofs for each row execute function app.queue_proof_file_deletion();
create trigger audit_proofs after insert or delete on public.proofs for each row execute function app.audit();

-- Change feed: proofs and stop notes reach Dispatch like stop changes.
create or replace function app.notify_proof_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec record := coalesce(new, old);
  t public.tours;
begin
  select tr.* into t from public.stops s join public.tours tr on tr.id = s.tour_id where s.id = rec.stop_id;
  perform pg_notify('turvio_changes', json_build_object(
    'org', rec.organization_id, 'depot', t.depot_id, 'tour', t.id, 'table', 'proofs', 'op', lower(tg_op))::text);
  return null;
end;
$$;
create trigger proofs_notify after insert or delete on public.proofs for each row execute function app.notify_proof_change();

-- Privileges ---------------------------------------------------------------------------
revoke execute on function public.driver_set_stop_status(uuid, public.stop_status, text, text, uuid, timestamptz) from public;
grant execute on function public.driver_set_stop_status(uuid, public.stop_status, text, text, uuid, timestamptz) to authenticated;
revoke execute on function public.driver_add_stop_note(uuid, text, uuid), public.driver_record_scans(uuid, jsonb),
  public.driver_create_tour(uuid, text, date), public.driver_update_stop(uuid, boolean, double precision, double precision, text) from public;
grant execute on function public.driver_add_stop_note(uuid, text, uuid), public.driver_record_scans(uuid, jsonb),
  public.driver_create_tour(uuid, text, date), public.driver_update_stop(uuid, boolean, double precision, double precision, text) to authenticated;
grant execute on function app.failure_reason_allowed(uuid, text), app.is_open_status(public.stop_status), app.default_failure_reasons() to authenticated;
