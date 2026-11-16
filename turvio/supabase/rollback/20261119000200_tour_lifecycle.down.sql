-- =============================================================================
-- Rollback of 20261119000200_tour_lifecycle (Phase B).
--
-- Drops the lifecycle records added since the migration: close actor / reason / remote flag,
-- archive markers, stop cancel details, "returned to pool" links and the deletion log. Take a
-- dump of tours, stops and tour_deletions first. Refuses to run unless the caller sets
--   set local turvio.confirm_drop_tour_lifecycle = 'yes';
-- and refuses while any tour or stop is 'cancelled' (the previous functions do not know that
-- status: resolve those rows first). The enum values from 20261119000100 stay (Postgres cannot
-- drop an enum value; unused values are harmless). Restores the exact previous definitions of
-- every function, policy, constraint and index the migration replaced.
-- =============================================================================
do $$
begin
  if coalesce(current_setting('turvio.confirm_drop_tour_lifecycle', true), '') <> 'yes' then
    raise exception 'refusing to drop the tour lifecycle records: set local turvio.confirm_drop_tour_lifecycle = ''yes'' after taking a backup';
  end if;
  if exists (select 1 from public.tours where status = 'cancelled') or exists (select 1 from public.stops where status = 'cancelled') then
    raise exception 'refusing to roll back: cancelled tours or stops exist (the previous version cannot handle them)';
  end if;
end $$;

drop trigger if exists tours_lifecycle_guard on public.tours;
drop function if exists app.tours_lifecycle_guard();
drop function if exists public.close_tour(uuid, int, public.tour_status, text, text);
drop function if exists public.cancel_stop(uuid, text);
drop function if exists public.delete_tour(uuid, int, boolean);
drop function if exists public.tour_delete_eligibility(uuid);
drop function if exists public.delete_draft_stop(uuid);

drop policy if exists proofs_insert on public.proofs;
create policy proofs_insert on public.proofs for insert to authenticated
  with check (created_by = auth.uid()
              and stop_id in (select s.id from public.stops s
                              join public.tours t on t.id = s.tour_id
                              where s.organization_id = proofs.organization_id
                                and ((t.driver_id in (select app.my_driver_ids()) and t.published_at is not null)
                                     or app.can_access_depot(t.organization_id, t.depot_id))));
drop function if exists app.proof_target(uuid, uuid, timestamptz);

create or replace function app.tour_events_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.tour_events (organization_id, tour_id, kind) values (new.organization_id, new.id, 'created');
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.tour_events (organization_id, tour_id, kind, detail)
    values (new.organization_id, new.id,
            case when new.status = 'in_progress' and old.status = 'paused' then 'resumed'
                 when new.status = 'in_progress' then 'started'
                 when new.status = 'paused' then 'paused'
                 else 'completed' end,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.driver_id is distinct from old.driver_id or new.vehicle_id is distinct from old.vehicle_id then
    insert into public.tour_events (organization_id, tour_id, kind, detail)
    values (new.organization_id, new.id, 'assigned', jsonb_build_object('driver_id', new.driver_id, 'vehicle_id', new.vehicle_id));
  end if;
  if new.published_at is distinct from old.published_at then
    insert into public.tour_events (organization_id, tour_id, kind)
    values (new.organization_id, new.id, case when new.published_at is null then 'unpublished' else 'published' end);
  end if;
  if new.optimized_at is distinct from old.optimized_at and new.optimized_at is not null then
    insert into public.tour_events (organization_id, tour_id, kind, detail)
    values (new.organization_id, new.id, 'optimized', coalesce(new.optimization, '{}'::jsonb));
  end if;
  return new;
end;
$$;

create or replace function app.clear_position_on_complete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    delete from public.driver_positions where tour_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.driver_record_locations(p_tour uuid, p_points jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t record;
  o record;
  pt jsonb;
  v_id uuid;
  v_at timestamptz;
  v_lat double precision;
  v_lng double precision;
  v_acc real;
  v_speed real;
  v_heading real;
  v_ok boolean;
  v_accepted int := 0;
  v_dupes int := 0;
  v_rejected jsonb := '[]'::jsonb;
  v_latest jsonb;
  v_latest_at timestamptz;
  v_rows int;
begin
  if jsonb_typeof(p_points) <> 'array' or jsonb_array_length(p_points) = 0 or jsonb_array_length(p_points) > 500 then
    raise exception 'points must be an array of 1..500 positions' using errcode = '22023';
  end if;
  select tr.* into t from public.tours tr
  where tr.id = p_tour and tr.driver_id in (select app.my_driver_ids());
  if not found then
    raise exception 'tour not found' using errcode = 'P0002';
  end if;
  select * into o from public.organizations where id = t.organization_id;
  if not app.tracking_enabled_for(t.organization_id, t.driver_id) then
    raise exception 'tracking_disabled' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tracking_notice_acks a
                 where a.organization_id = t.organization_id and a.driver_id = t.driver_id and a.notice_version = o.tracking_notice_version) then
    raise exception 'tracking_notice_required' using errcode = '42501';
  end if;

  for pt in select * from jsonb_array_elements(p_points) loop
    begin
      v_id := (pt->>'id')::uuid;
      v_at := (pt->>'recordedAt')::timestamptz;
      v_lat := (pt->>'lat')::double precision;
      v_lng := (pt->>'lng')::double precision;
      v_acc := nullif(pt->>'accuracy', '')::real;
      v_speed := nullif(pt->>'speed', '')::real;
      v_heading := nullif(pt->>'heading', '')::real;
    exception when others then
      v_rejected := v_rejected || jsonb_build_object('id', pt->>'id', 'reason', 'malformed');
      continue;
    end;
    if v_id is null or v_at is null or v_lat is null or v_lng is null
       or v_lat not between -90 and 90 or v_lng not between -180 and 180
       or (v_acc is not null and v_acc not between 0 and 10000)
       or (v_speed is not null and v_speed not between 0 and 100)
       or (v_heading is not null and v_heading not between 0 and 360) then
      v_rejected := v_rejected || jsonb_build_object('id', pt->>'id', 'reason', 'invalid');
      continue;
    end if;
    if v_at > now() + interval '2 minutes' then
      v_rejected := v_rejected || jsonb_build_object('id', v_id, 'reason', 'future_timestamp');
      continue;
    end if;
    select exists (
      select 1 from (
        select e.kind, e.created_at,
               lead(e.created_at) over (order by e.created_at, e.id) as next_at
        from public.tour_events e
        where e.tour_id = p_tour and e.kind in ('started', 'resumed', 'paused', 'completed')
      ) p
      where p.kind in ('started', 'resumed')
        and v_at >= p.created_at - interval '30 seconds'
        and v_at <= coalesce(p.next_at, now()) + interval '30 seconds'
    ) into v_ok;
    if not v_ok then
      v_rejected := v_rejected || jsonb_build_object('id', v_id, 'reason', 'outside_active_tour');
      continue;
    end if;
    insert into public.location_pings (organization_id, driver_id, tour_id, vehicle_id, lat, lng, recorded_at, client_id, accuracy_m, speed_mps, heading_deg)
    values (t.organization_id, t.driver_id, p_tour, t.vehicle_id, v_lat, v_lng, v_at, v_id, v_acc, v_speed, v_heading)
    on conflict (organization_id, client_id) where client_id is not null do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      v_dupes := v_dupes + 1;
      continue;
    end if;
    v_accepted := v_accepted + 1;
    if v_latest_at is null or v_at > v_latest_at then
      v_latest_at := v_at;
      v_latest := jsonb_build_object('lat', v_lat, 'lng', v_lng, 'acc', v_acc, 'speed', v_speed, 'heading', v_heading);
    end if;
  end loop;

  if v_latest is not null and t.status = 'in_progress' then
    insert into public.driver_positions as dp (organization_id, driver_id, tour_id, vehicle_id, lat, lng, accuracy_m, speed_mps, heading_deg, recorded_at)
    values (t.organization_id, t.driver_id, p_tour, t.vehicle_id, (v_latest->>'lat')::double precision, (v_latest->>'lng')::double precision,
            (v_latest->>'acc')::real, (v_latest->>'speed')::real, (v_latest->>'heading')::real, v_latest_at)
    on conflict (organization_id, driver_id) do update
      set tour_id = excluded.tour_id, vehicle_id = excluded.vehicle_id, lat = excluded.lat, lng = excluded.lng,
          accuracy_m = excluded.accuracy_m, speed_mps = excluded.speed_mps, heading_deg = excluded.heading_deg,
          recorded_at = excluded.recorded_at, received_at = now()
      where dp.recorded_at < excluded.recorded_at;
    perform pg_notify('turvio_changes', json_build_object(
      'org', t.organization_id, 'depot', t.depot_id, 'tour', p_tour, 'table', 'driver_positions', 'op', 'update')::text);
  end if;
  return jsonb_build_object('accepted', v_accepted, 'duplicates', v_dupes, 'rejected', v_rejected);
end;
$$;

create or replace function app.editable_stop(p_stop uuid) returns public.stops
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.stops;
begin
  select st.* into s from public.stops st
  join public.tours t on t.id = st.tour_id and t.organization_id = st.organization_id
  where st.id = p_stop
    and ((t.driver_id in (select app.my_driver_ids()) and t.published_at is not null)
         or app.can_access_depot(t.organization_id, t.depot_id));
  if not found then
    raise exception 'stop not found' using errcode = 'P0002';
  end if;
  return s;
end;
$$;

create or replace function public.driver_record_scans(p_tour_id uuid, p_scans jsonb)
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

create or replace function public.set_tour_end(p_tour uuid, p_mode text, p_lat double precision default null, p_lng double precision default null, p_label text default null)
returns public.tours
language plpgsql security definer set search_path = '' as $$
declare
  t public.tours;
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
  if p_mode not in ('depot', 'address', 'last_stop') then
    raise exception 'invalid end mode' using errcode = '22023';
  end if;
  if (p_mode = 'address') <> (p_lat is not null and p_lng is not null) then
    raise exception 'an end address needs a position (and only an end address has one)' using errcode = '22023';
  end if;
  if t.end_mode = p_mode and t.end_lat is not distinct from p_lat and t.end_lng is not distinct from p_lng then
    return t;
  end if;
  update public.tours
     set end_mode = p_mode, end_lat = p_lat, end_lng = p_lng,
         end_label = case when p_mode = 'address' then nullif(btrim(p_label), '') end
   where id = p_tour
  returning * into t;
  return t;
end;
$$;

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
create or replace function public.driver_set_stop_status(
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

drop function if exists app.close_grace();
drop function if exists app.tour_close_time(public.tours);
drop function if exists app.is_closed_tour_status(public.tour_status);

drop table if exists public.tour_deletions;

drop index if exists public.tours_driver_day_open_uidx;
drop index if exists public.tours_vehicle_day_open_uidx;
create unique index tours_driver_day_open_uidx on public.tours (organization_id, driver_id, tour_date)
  where driver_id is not null and status <> 'completed' and origin = 'dispatch';
create unique index tours_vehicle_day_open_uidx on public.tours (organization_id, vehicle_id, tour_date)
  where vehicle_id is not null and status <> 'completed' and origin = 'dispatch';

alter table public.tour_events drop constraint if exists tour_events_kind_check;
delete from public.tour_events where kind in ('cancelled', 'archived', 'restored', 'rescheduled');
alter table public.tour_events add constraint tour_events_kind_check check (kind in ('created', 'assigned', 'optimized', 'published', 'unpublished', 'started', 'paused', 'resumed', 'completed'));
alter table public.stop_events drop constraint if exists stop_events_kind_check;
delete from public.stop_events where kind = 'returned';
alter table public.stop_events add constraint stop_events_kind_check check (kind in ('status', 'note'));
alter table public.stops drop constraint stops_unassigned_pending;
alter table public.stops add constraint stops_unassigned_pending check (tour_id is not null or status = 'pending');

drop index if exists public.stops_returned_from_idx;
drop index if exists public.tours_org_date_lifecycle_idx;
alter table public.stops
  drop column if exists cancel_reason, drop column if exists cancelled_at, drop column if exists cancelled_by,
  drop column if exists returned_from_tour_id, drop column if exists returned_at;
alter table public.tours
  drop column if exists closed_at, drop column if exists closed_by, drop column if exists close_reason,
  drop column if exists closed_remotely, drop column if exists archived_at, drop column if exists archived_by;
