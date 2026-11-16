-- Tour lifecycle (Phase B), part 2: finish / cancel by Dispatch, archive / restore, safe delete,
-- closed-tour guards, stop cancellation.
--
-- Additive: new nullable columns, new functions, replaced function bodies, recreated partial
-- indexes. No existing row is rewritten. Rollback: 20261119000200_tour_lifecycle.rollback.sql.
--
-- Rules
-- * Archive is a marker (archived_at), not a status: restore only clears the marker, so it can
--   never reactivate a completed or cancelled tour.
-- * Withdraw (unpublish, existing), Finish (status completed) and Cancel (status cancelled) are
--   separate. Finish/Cancel by Dispatch record who, when, why and "remote".
-- * A closed tour (completed / cancelled) rejects driver updates that happened after the close.
--   Offline events that happened before the close are still accepted (approved decision 4).
-- * Permanent delete only for tours without protected history (checked here, not by status).

-- ---------------------------------------------------------------- columns
alter table public.tours
  add column closed_at timestamptz,
  add column closed_by uuid,
  add column close_reason text check (char_length(close_reason) <= 500),
  add column closed_remotely boolean not null default false,
  add column archived_at timestamptz,
  add column archived_by uuid;
comment on column public.tours.closed_at is
  'When the tour became completed or cancelled (null for tours closed before this column existed: use finished_at).';
comment on column public.tours.archived_at is
  'Hidden from the default views; everything is kept. Not a status: restore clears it and never changes the status.';

alter table public.stops
  add column cancel_reason text check (char_length(cancel_reason) <= 500),
  add column cancelled_at timestamptz,
  add column cancelled_by uuid,
  -- Set when Dispatch closed the tour and returned the open stop to the unassigned pool: the
  -- tour's driver may still report what happened before the close (offline phone).
  add column returned_from_tour_id uuid references public.tours (id) on delete set null,
  add column returned_at timestamptz;

create index tours_org_date_lifecycle_idx on public.tours (organization_id, tour_date) include (status, archived_at, depot_id, driver_id);
create index stops_returned_from_idx on public.stops (returned_from_tour_id) where returned_from_tour_id is not null;

-- Unassigned stops are pending, or cancelled by Dispatch (e.g. an order the customer withdrew).
alter table public.stops drop constraint stops_unassigned_pending;
alter table public.stops add constraint stops_unassigned_pending check (tour_id is not null or status in ('pending', 'cancelled'));

-- Stop history kinds: + 'returned' (moved to the pool when Dispatch closed the tour).
alter table public.stop_events drop constraint if exists stop_events_kind_check;
alter table public.stop_events add constraint stop_events_kind_check check (kind in ('status', 'note', 'returned'));

-- Tour history kinds: + cancelled, archived, restored, rescheduled.
alter table public.tour_events drop constraint if exists tour_events_kind_check;
alter table public.tour_events add constraint tour_events_kind_check check (kind in (
  'created', 'assigned', 'optimized', 'published', 'unpublished', 'started', 'paused', 'resumed', 'completed',
  'cancelled', 'archived', 'restored', 'rescheduled'));

-- One open tour per driver / vehicle and day: closed or archived tours do not count.
drop index if exists public.tours_driver_day_open_uidx;
drop index if exists public.tours_vehicle_day_open_uidx;
create unique index tours_driver_day_open_uidx on public.tours (organization_id, driver_id, tour_date)
  where driver_id is not null and status not in ('completed', 'cancelled') and archived_at is null and origin = 'dispatch';
create unique index tours_vehicle_day_open_uidx on public.tours (organization_id, vehicle_id, tour_date)
  where vehicle_id is not null and status not in ('completed', 'cancelled') and archived_at is null and origin = 'dispatch';

-- Deleted tours: what was deleted, by whom (tour_events cascade with the tour; audit_log keeps ids only).
create table public.tour_deletions (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  tour_id uuid not null,
  depot_id uuid,
  name text not null,
  tour_date date not null,
  status public.tour_status not null,
  driver_id uuid,
  stop_count int not null,
  stops_action text not null check (stops_action in ('returned', 'deleted', 'none')),
  deleted_by uuid default auth.uid(),
  deleted_at timestamptz not null default now()
);
create index tour_deletions_org_idx on public.tour_deletions (organization_id, deleted_at desc);
alter table public.tour_deletions enable row level security;
create policy tour_deletions_select on public.tour_deletions for select to authenticated
  using (app.can_access_depot(organization_id, depot_id));
grant select on public.tour_deletions to authenticated;

-- ---------------------------------------------------------------- helpers
create or replace function app.is_closed_tour_status(s public.tour_status) returns boolean
language sql immutable as $$ select s in ('completed', 'cancelled') $$;

-- Moment a closed tour stopped accepting updates (older tours: finished_at).
create or replace function app.tour_close_time(t public.tours) returns timestamptz
language sql stable as $$ select case when t.status in ('completed', 'cancelled') then coalesce(t.closed_at, t.finished_at, t.created_at) end $$;

-- Grace for clock skew between phone and server (same tolerance as location pings).
create or replace function app.close_grace() returns interval language sql immutable as $$ select interval '30 seconds' $$;

-- ---------------------------------------------------------------- tour row guards
create or replace function app.tours_lifecycle_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Close time and actor for every way a tour closes (driver, Dispatch).
  if new.status in ('completed', 'cancelled') and old.status not in ('completed', 'cancelled') then
    new.closed_at := coalesce(new.closed_at, now());
    new.closed_by := coalesce(new.closed_by, auth.uid());
  end if;
  -- A closed tour never opens again (no "reactivate").
  if old.status in ('completed', 'cancelled') and new.status is distinct from old.status then
    raise exception 'tour_closed' using errcode = '55000';
  end if;
  -- Archive: only tours that are closed, or planned and not published.
  if new.archived_at is not null and old.archived_at is null then
    if not (new.status in ('completed', 'cancelled') or (new.status = 'planned' and new.published_at is null)) then
      raise exception 'only completed, cancelled or unpublished planned tours can be archived' using errcode = '22023';
    end if;
    new.archived_by := auth.uid();
  elsif new.archived_at is null and old.archived_at is not null then
    new.archived_by := null;
  end if;
  -- An archived tour is read-only until it is restored.
  if old.archived_at is not null and new.archived_at is not null and (
       new.status is distinct from old.status or new.published_at is distinct from old.published_at
    or new.driver_id is distinct from old.driver_id or new.vehicle_id is distinct from old.vehicle_id
    or new.tour_date is distinct from old.tour_date or new.depot_id is distinct from old.depot_id
    or new.name is distinct from old.name or new.planned_start_minute is distinct from old.planned_start_minute
    or new.start_lat is distinct from old.start_lat or new.end_mode is distinct from old.end_mode
    or new.optimized_at is distinct from old.optimized_at) then
    raise exception 'tour_archived' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger tours_lifecycle_guard before update on public.tours for each row execute function app.tours_lifecycle_guard();

-- Tour history (replaces 20261106000100): new kinds, remote close details, archive, reschedule.
create or replace function app.tour_events_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  created_detail jsonb;
begin
  if tg_op = 'INSERT' then
    created_detail := coalesce(nullif(current_setting('turvio.tour_created_detail', true), '')::jsonb, '{}'::jsonb);
    insert into public.tour_events (organization_id, tour_id, kind, detail) values (new.organization_id, new.id, 'created', created_detail);
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.tour_events (organization_id, tour_id, kind, detail)
    values (new.organization_id, new.id,
            case when new.status = 'in_progress' and old.status = 'paused' then 'resumed'
                 when new.status = 'in_progress' then 'started'
                 when new.status = 'paused' then 'paused'
                 when new.status = 'cancelled' then 'cancelled'
                 else 'completed' end,
            jsonb_build_object('from', old.status, 'to', new.status)
              || case when new.closed_remotely and not old.closed_remotely
                      then jsonb_build_object('remote', true, 'reason', new.close_reason)
                      else '{}'::jsonb end);
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
  if new.tour_date is distinct from old.tour_date or new.depot_id is distinct from old.depot_id then
    insert into public.tour_events (organization_id, tour_id, kind, detail)
    values (new.organization_id, new.id, 'rescheduled', jsonb_build_object(
      'fromDate', old.tour_date, 'toDate', new.tour_date, 'fromDepotId', old.depot_id, 'toDepotId', new.depot_id));
  end if;
  if new.archived_at is distinct from old.archived_at then
    insert into public.tour_events (organization_id, tour_id, kind)
    values (new.organization_id, new.id, case when new.archived_at is null then 'restored' else 'archived' end);
  end if;
  return new;
end;
$$;

-- The live position ends with the tour, however it closes (history stays until the retention purge).
create or replace function app.clear_position_on_complete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('completed', 'cancelled') and old.status not in ('completed', 'cancelled') then
    delete from public.driver_positions where tour_id = new.id;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------- live tracking: a cancel ends the period
-- Same as 20261113000100, with 'cancelled' closing the driving period (no pings accepted after it).
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
        where e.tour_id = p_tour and e.kind in ('started', 'resumed', 'paused', 'completed', 'cancelled')
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
revoke execute on function public.driver_record_locations(uuid, jsonb) from public, anon;
grant execute on function public.driver_record_locations(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------- closed-tour guards
-- Editing helper (replaces 20261108000200): open stop on a tour the caller may work on, and the
-- tour still open. Used by driver_edit_stop, driver_update_stop, driver_delete_stop, merge_stops.
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
  if exists (select 1 from public.tours t where t.id = s.tour_id and app.is_closed_tour_status(t.status)) then
    raise exception 'tour_closed' using errcode = '55000';
  end if;
  return s;
end;
$$;

-- Stop status (replaces 20261107000200). Additions:
--  * closed tour: only what happened before the close (+ grace) is applied;
--  * a stop Dispatch returned to the pool on close: the tour's driver can still report it, and a
--    report from before the close puts the stop back on that tour;
--  * a stop Dispatch cancelled: a real outcome that happened before the cancel wins over it,
--    a later one is refused; drivers cannot set 'cancelled'.
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
  t public.tours;
  at timestamptz := least(coalesce(p_occurred_at, now()), now());
  not_delivered boolean := p_status in ('failed', 'attempted', 'rescheduled', 'returned');
  via_return boolean := false;
  override_cancel boolean := false;
begin
  if p_status = 'cancelled' then
    raise exception 'stops are cancelled by Dispatch with a reason' using errcode = '22023';
  end if;
  select st.* into s from public.stops st
  join public.tours tt on tt.id = st.tour_id and tt.organization_id = st.organization_id
  where st.id = p_stop_id
    and ((tt.driver_id in (select app.my_driver_ids()) and tt.published_at is not null)
         or app.can_access_depot(tt.organization_id, tt.depot_id))
  for update of st;
  if found then
    select * into t from public.tours where id = s.tour_id;
  else
    select st.* into s from public.stops st
    join public.tours tt on tt.id = st.returned_from_tour_id and tt.organization_id = st.organization_id
    where st.id = p_stop_id and tt.driver_id in (select app.my_driver_ids()) and tt.published_at is not null
    for update of st;
    if not found then
      raise exception 'stop not found' using errcode = 'P0002';
    end if;
    via_return := true;
    select * into t from public.tours where id = s.returned_from_tour_id;
  end if;
  -- Retried submission of the same offline action: already recorded.
  if p_client_event_id is not null and exists (
    select 1 from public.stop_events e where e.organization_id = s.organization_id and e.client_event_id = p_client_event_id) then
    return s;
  end if;
  if app.is_closed_tour_status(t.status) and at > app.tour_close_time(t) + app.close_grace() then
    raise exception 'tour_closed' using errcode = '55000';
  end if;
  if via_return then
    if s.tour_id is not null then
      -- Planned on another tour since: keep the report as evidence, do not apply it.
      insert into public.stop_events (organization_id, stop_id, status, notes, failure_reason, actor_user_id, client_event_id, occurred_at, applied)
      values (s.organization_id, s.id, p_status, p_notes, p_failure_reason, auth.uid(), p_client_event_id, at, false);
      return s;
    end if;
    -- Back onto the tour it was served on (it happened before the close).
    update public.stops
       set tour_id = t.id, depot_id = null,
           sequence = (select coalesce(max(x.sequence) + 1, 0) from public.stops x where x.tour_id = t.id),
           returned_from_tour_id = null, returned_at = null
     where id = s.id
     returning * into s;
    insert into public.stop_events (organization_id, stop_id, status, kind, notes, actor_user_id, occurred_at)
    values (s.organization_id, s.id, s.status, 'returned', 'Back on its tour: the driver reported it from before the tour was closed', auth.uid(), at);
  end if;
  if s.status = p_status then
    return s;
  end if;
  if s.status = 'cancelled' then
    if p_status = 'pending' or s.status_changed_at is null or at >= s.status_changed_at then
      raise exception 'stop_cancelled' using errcode = '55000';
    end if;
    override_cancel := true;
  elsif s.status_changed_at is not null and at < s.status_changed_at then
    -- An older offline change arriving after a newer one: record, do not apply.
    insert into public.stop_events (organization_id, stop_id, status, notes, failure_reason, actor_user_id, client_event_id, occurred_at, applied)
    values (s.organization_id, s.id, p_status, p_notes, p_failure_reason, auth.uid(), p_client_event_id, at, false);
    return s;
  end if;
  if not override_cancel and not app.is_open_status(s.status) and p_status <> 'pending' then
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
         status_changed_at = at,
         cancel_reason = case when override_cancel then null else cancel_reason end,
         cancelled_at = case when override_cancel then null else cancelled_at end,
         cancelled_by = case when override_cancel then null else cancelled_by end
   where id = s.id
   returning * into s;
  insert into public.stop_events (organization_id, stop_id, status, notes, failure_reason, actor_user_id, client_event_id, occurred_at)
  values (s.organization_id, s.id, p_status, p_notes, p_failure_reason, auth.uid(), p_client_event_id, at);
  return s;
end;
$$;
revoke execute on function public.driver_set_stop_status(uuid, public.stop_status, text, text, uuid, timestamptz) from public, anon;
grant execute on function public.driver_set_stop_status(uuid, public.stop_status, text, text, uuid, timestamptz) to authenticated;

-- Tour status by the driver (replaces 20261107000200): a tour Dispatch closed answers "tour_closed"
-- (the installed app shows it as a refused action); repeating the current status stays a no-op.
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
  if app.is_closed_tour_status(t.status) then
    raise exception 'tour_closed' using errcode = '55000';
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

-- Proof target: may the caller attach a proof (photo / signature) captured at p_at to this stop?
-- 'ok', 'not_found' or 'tour_closed'. Includes stops returned to the pool on close (see above).
create or replace function app.proof_target(p_stop uuid, p_org uuid, p_at timestamptz) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  t public.tours;
begin
  select tt.* into t from public.stops st
  join public.tours tt on tt.id = st.tour_id and tt.organization_id = st.organization_id
  where st.id = p_stop and st.organization_id = p_org
    and ((tt.driver_id in (select app.my_driver_ids()) and tt.published_at is not null)
         or app.can_access_depot(tt.organization_id, tt.depot_id));
  if not found then
    select tt.* into t from public.stops st
    join public.tours tt on tt.id = st.returned_from_tour_id and tt.organization_id = st.organization_id
    where st.id = p_stop and st.organization_id = p_org
      and tt.driver_id in (select app.my_driver_ids()) and tt.published_at is not null;
    if not found then
      return 'not_found';
    end if;
  end if;
  if app.is_closed_tour_status(t.status) and least(coalesce(p_at, now()), now()) > app.tour_close_time(t) + app.close_grace() then
    return 'tour_closed';
  end if;
  return 'ok';
end;
$$;
revoke execute on function app.proof_target(uuid, uuid, timestamptz) from public, anon;
grant execute on function app.proof_target(uuid, uuid, timestamptz) to authenticated;

drop policy proofs_insert on public.proofs;
create policy proofs_insert on public.proofs for insert to authenticated
  with check (created_by = auth.uid() and app.proof_target(stop_id, organization_id, captured_at) = 'ok');

-- Scans (replaces 20261107000200): on a closed tour only scans from before the close count.
-- Additive response key "rejected", present only when scans were refused (older apps read matched / unknown).
create or replace function public.driver_record_scans(p_tour_id uuid, p_scans jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.tours;
  sc jsonb;
  code text;
  scanned_at timestamptz;
  matched text[] := '{}';
  unknown text[] := '{}';
  rejected text[] := '{}';
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
    scanned_at := least(coalesce((sc ->> 'at')::timestamptz, now()), now());
    if app.is_closed_tour_status(t.status) and scanned_at > app.tour_close_time(t) + app.close_grace() then
      rejected := rejected || code;
      continue;
    end if;
    update public.parcels p
       set loaded_at = coalesce(p.loaded_at, scanned_at)
      from public.stops s
     where s.id = p.stop_id and s.tour_id = t.id and p.organization_id = t.organization_id
       and (upper(p.tracking_number) = code or upper(p.barcode) = code);
    get diagnostics n = row_count;
    if n > 0 then matched := matched || code; else unknown := unknown || code; end if;
  end loop;
  if cardinality(rejected) > 0 and cardinality(matched) = 0 and cardinality(unknown) = 0 then
    raise exception 'tour_closed' using errcode = '55000';
  end if;
  if cardinality(matched) > 0 then
    update public.stops set updated_at = now() where id = (select s.id from public.stops s where s.tour_id = t.id order by s.sequence limit 1);
  end if;
  -- "rejected" only when something was refused: the usual response stays exactly as before.
  return jsonb_build_object('matched', to_jsonb(matched), 'unknown', to_jsonb(unknown))
         || case when cardinality(rejected) > 0 then jsonb_build_object('rejected', to_jsonb(rejected)) else '{}'::jsonb end;
end;
$$;
revoke execute on function public.driver_record_scans(uuid, jsonb) from public, anon;
grant execute on function public.driver_record_scans(uuid, jsonb) to authenticated;

-- Stop order (replaces 20261107000200): closed or archived tours keep their order.
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
  if app.is_closed_tour_status(t.status) then
    raise exception 'tour_closed' using errcode = '55000';
  end if;
  if t.archived_at is not null then
    raise exception 'tour_archived' using errcode = '55000';
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

-- Tour end (replaces 20261114000100): closed tours keep their end.
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
  if app.is_closed_tour_status(t.status) then
    raise exception 'tour_closed' using errcode = '55000';
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

-- ---------------------------------------------------------------- Dispatch: finish / cancel
-- p_status: 'completed' (finish) or 'cancelled'. p_open_stops: 'return' (default: back to the
-- depot's unassigned pool) or 'cancel' (kept on the tour as cancelled, with the reason).
-- Delivered / failed stops, proofs, scans, events and GPS history are never touched.
create or replace function public.close_tour(p_tour uuid, p_expected_version int, p_status public.tour_status, p_reason text, p_open_stops text default 'return')
returns public.tours
language plpgsql security definer set search_path = '' as $$
declare
  t public.tours;
  reason text := nullif(btrim(p_reason), '');
begin
  select * into t from public.tours where id = p_tour for update;
  if not found or not app.can_access_depot(t.organization_id, t.depot_id) then
    raise exception 'tour not found' using errcode = 'P0002';
  end if;
  if t.version <> p_expected_version then
    raise exception 'version conflict' using errcode = '40001';
  end if;
  if p_status not in ('completed', 'cancelled') or p_open_stops not in ('return', 'cancel') then
    raise exception 'invalid close request' using errcode = '22023';
  end if;
  if reason is null or char_length(reason) < 3 or char_length(reason) > 500 then
    raise exception 'a reason (3-500 characters) is required' using errcode = '22023';
  end if;
  if app.is_closed_tour_status(t.status) then
    raise exception 'tour_closed' using errcode = '55000';
  end if;
  if t.archived_at is not null then
    raise exception 'tour_archived' using errcode = '55000';
  end if;
  if p_status = 'completed' and t.status not in ('in_progress', 'paused') then
    raise exception 'only a started tour can be finished – cancel or withdraw a tour that has not started' using errcode = '22023';
  end if;

  if p_open_stops = 'return' then
    insert into public.stop_events (organization_id, stop_id, status, kind, notes, actor_user_id, occurred_at)
    select s.organization_id, s.id, 'pending', 'returned', reason, auth.uid(), now()
      from public.stops s where s.tour_id = t.id and app.is_open_status(s.status);
    -- status_changed_at stays: a driver's report from before the close must still apply.
    update public.stops
       set tour_id = null, depot_id = t.depot_id, sequence = 0, status = 'pending', arrived_at = null,
           returned_from_tour_id = t.id, returned_at = now()
     where tour_id = t.id and app.is_open_status(status);
  else
    insert into public.stop_events (organization_id, stop_id, status, notes, actor_user_id, occurred_at)
    select s.organization_id, s.id, 'cancelled', reason, auth.uid(), now()
      from public.stops s where s.tour_id = t.id and app.is_open_status(s.status);
    update public.stops
       set status = 'cancelled', cancel_reason = reason, cancelled_at = now(), cancelled_by = auth.uid(), status_changed_at = now()
     where tour_id = t.id and app.is_open_status(status);
  end if;

  update public.tours
     set status = p_status,
         finished_at = case when p_status = 'completed' then now() else finished_at end,
         closed_at = now(), closed_by = auth.uid(), close_reason = reason, closed_remotely = true
   where id = t.id
   returning * into t;
  return t;
end;
$$;
revoke execute on function public.close_tour(uuid, int, public.tour_status, text, text) from public, anon;
grant execute on function public.close_tour(uuid, int, public.tour_status, text, text) to authenticated;

-- Cancel one stop (Dispatch): open stops only, on an open tour or in the unassigned pool.
create or replace function public.cancel_stop(p_stop uuid, p_reason text) returns public.stops
language plpgsql security definer set search_path = '' as $$
declare
  s public.stops;
  reason text := nullif(btrim(p_reason), '');
  tour_status public.tour_status;
begin
  select * into s from public.stops where id = p_stop for update;
  if not found or not app.can_manage_stop(s.organization_id, s.id) then
    raise exception 'stop not found' using errcode = 'P0002';
  end if;
  if reason is null or char_length(reason) < 3 or char_length(reason) > 500 then
    raise exception 'a reason (3-500 characters) is required' using errcode = '22023';
  end if;
  if s.tour_id is not null then
    select t.status into tour_status from public.tours t where t.id = s.tour_id;
    if app.is_closed_tour_status(tour_status) then
      raise exception 'tour_closed' using errcode = '55000';
    end if;
  end if;
  if s.status = 'cancelled' then
    return s;
  end if;
  if not app.is_open_status(s.status) then
    raise exception 'only open stops can be cancelled – this stop already has an outcome' using errcode = '22023';
  end if;
  update public.stops
     set status = 'cancelled', cancel_reason = reason, cancelled_at = now(), cancelled_by = auth.uid(), status_changed_at = now(), arrived_at = null
   where id = s.id returning * into s;
  insert into public.stop_events (organization_id, stop_id, status, notes, actor_user_id, occurred_at)
  values (s.organization_id, s.id, 'cancelled', reason, auth.uid(), now());
  return s;
end;
$$;
revoke execute on function public.cancel_stop(uuid, text) from public, anon;
grant execute on function public.cancel_stop(uuid, text) to authenticated;

-- ---------------------------------------------------------------- delete eligibility
-- Decided from history, never from status alone: a cancelled or archived tour is not eligible
-- because of its status. Eligible = a planned, unpublished tour that never started and whose
-- stops carry no protected record.
create or replace function public.tour_delete_eligibility(p_tour uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t public.tours;
  reasons text[] := '{}';
  n_stops int;
  n_processed int;
  n_events int;
  n_proofs int;
  n_loaded int;
  n_pings int;
  n_returned int;
begin
  select * into t from public.tours where id = p_tour;
  if not found or not app.can_access_depot(t.organization_id, t.depot_id) then
    raise exception 'tour not found' using errcode = 'P0002';
  end if;
  select count(*), count(*) filter (where s.status <> 'pending') into n_stops, n_processed from public.stops s where s.tour_id = t.id;
  select count(*) into n_events from public.stop_events e join public.stops s on s.id = e.stop_id where s.tour_id = t.id;
  select count(*) into n_proofs from public.proofs p join public.stops s on s.id = p.stop_id where s.tour_id = t.id;
  select count(*) into n_loaded from public.parcels p join public.stops s on s.id = p.stop_id where s.tour_id = t.id and p.loaded_at is not null;
  select count(*) into n_pings from public.location_pings lp where lp.tour_id = t.id;
  select count(*) into n_returned from public.stops s where s.returned_from_tour_id = t.id;
  if t.status <> 'planned' then reasons := reasons || ('status_' || t.status::text); end if;
  if t.started_at is not null then reasons := reasons || 'started'::text; end if;
  if t.published_at is not null then reasons := reasons || 'published'::text; end if;
  if n_processed > 0 then reasons := reasons || 'processed_stops'::text; end if;
  if n_events > 0 then reasons := reasons || 'stop_history'::text; end if;
  if n_proofs > 0 then reasons := reasons || 'proofs'::text; end if;
  if n_loaded > 0 then reasons := reasons || 'scans'::text; end if;
  if n_pings > 0 then reasons := reasons || 'tracking'::text; end if;
  if n_returned > 0 then reasons := reasons || 'returned_stops'::text; end if;
  if exists (select 1 from public.tour_events e where e.tour_id = t.id and e.kind in ('started', 'paused', 'resumed', 'completed', 'cancelled')) then
    reasons := reasons || 'execution_history'::text;
  end if;
  return jsonb_build_object(
    'tourId', t.id, 'eligible', cardinality(reasons) = 0, 'reasons', to_jsonb(reasons),
    'stops', n_stops, 'processedStops', n_processed, 'stopEvents', n_events, 'proofs', n_proofs,
    'scannedParcels', n_loaded, 'locationPoints', n_pings, 'version', t.version);
end;
$$;
revoke execute on function public.tour_delete_eligibility(uuid) from public, anon;
grant execute on function public.tour_delete_eligibility(uuid) to authenticated;

-- Permanent delete of an eligible tour. Its stops go back to the unassigned pool (default), or –
-- p_delete_stops – are deleted too (they are unprocessed by definition of eligibility).
create or replace function public.delete_tour(p_tour uuid, p_expected_version int, p_delete_stops boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.tours;
  e jsonb;
  n int;
begin
  select * into t from public.tours where id = p_tour for update;
  if not found or not app.can_access_depot(t.organization_id, t.depot_id) then
    raise exception 'tour not found' using errcode = 'P0002';
  end if;
  if t.version <> p_expected_version then
    raise exception 'version conflict' using errcode = '40001';
  end if;
  -- Lock its stops, then re-check under the lock (a driver or another dispatcher may have acted).
  perform 1 from public.stops where tour_id = t.id for update;
  e := public.tour_delete_eligibility(p_tour);
  if not (e ->> 'eligible')::boolean then
    raise exception 'tour_protected' using errcode = '55000', detail = e::text;
  end if;
  select count(*) into n from public.stops where tour_id = t.id;
  insert into public.tour_deletions (organization_id, tour_id, depot_id, name, tour_date, status, driver_id, stop_count, stops_action)
  values (t.organization_id, t.id, t.depot_id, t.name, t.tour_date, t.status, t.driver_id, n,
          case when n = 0 then 'none' when p_delete_stops then 'deleted' else 'returned' end);
  if p_delete_stops then
    delete from public.stops where tour_id = t.id;
  else
    update public.stops set tour_id = null, depot_id = t.depot_id, sequence = 0 where tour_id = t.id;
  end if;
  delete from public.tours where id = t.id;
  return jsonb_build_object('tourId', t.id, 'stops', n, 'stopsAction', case when n = 0 then 'none' when p_delete_stops then 'deleted' else 'returned' end);
end;
$$;
revoke execute on function public.delete_tour(uuid, int, boolean) from public, anon;
grant execute on function public.delete_tour(uuid, int, boolean) to authenticated;

-- Delete one unprocessed stop (draft / test): no outcome, no history, no proof, no scan.
create or replace function public.delete_draft_stop(p_stop uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.stops;
  tour_status public.tour_status;
begin
  select * into s from public.stops where id = p_stop for update;
  if not found or not app.can_manage_stop(s.organization_id, s.id) then
    raise exception 'stop not found' using errcode = 'P0002';
  end if;
  if s.tour_id is not null then
    select t.status into tour_status from public.tours t where t.id = s.tour_id;
    if app.is_closed_tour_status(tour_status) then
      raise exception 'tour_closed' using errcode = '55000';
    end if;
  end if;
  if s.status <> 'pending'
     or s.returned_from_tour_id is not null
     or exists (select 1 from public.stop_events e where e.stop_id = s.id)
     or exists (select 1 from public.proofs p where p.stop_id = s.id)
     or exists (select 1 from public.parcels p where p.stop_id = s.id and p.loaded_at is not null) then
    raise exception 'stop_protected' using errcode = '55000';
  end if;
  delete from public.stops where id = s.id;
end;
$$;
revoke execute on function public.delete_draft_stop(uuid) from public, anon;
grant execute on function public.delete_draft_stop(uuid) to authenticated;

-- ---------------------------------------------------------------- retention: cancelled like completed
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
  delete from public.stop_location_checks c
  using public.stops s, public.tours t, public.organizations o
  where s.id = c.stop_id and t.id = s.tour_id and o.id = c.organization_id
    and t.status in ('completed', 'cancelled')
    -- completed: finished_at as before; cancelled: the close time.
    and (case when t.status = 'completed' then t.finished_at else t.closed_at end) < now() - make_interval(days => o.location_check_retention_days);
  perform set_config('turvio.purging_location_events', 'on', true);
  delete from public.stop_location_events e
  using public.organizations o
  where o.id = e.organization_id and o.location_audit_retention_days is not null
    and e.occurred_at < now() - make_interval(days => o.location_audit_retention_days);
  perform set_config('turvio.purging_location_events', '', true);
end;
$$;

-- app.tour_events_trigger keeps its previous permissions (a trigger function cannot be called directly).
revoke execute on function app.tours_lifecycle_guard(), app.clear_position_on_complete(), app.purge_expired_data() from public, anon, authenticated;
