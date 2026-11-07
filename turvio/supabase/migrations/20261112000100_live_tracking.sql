-- Live GPS tracking of drivers during active tours (smartphone GPS).
--
-- Principles (docs/LIVE_TRACKING.md):
-- * OFF by default. A company admin switches it on (tracking_mode = 'active_tours') only after
--   the legal prerequisites (DPIA, works-council agreement, driver information) are in place;
--   who did it and when is stored and audited.
-- * No hidden monitoring: a driver's positions are only accepted after the driver acknowledged
--   the current tracking notice in the app.
-- * Only during working periods: a point is accepted only if it was recorded while the tour was
--   being driven (between started/resumed and paused/completed in tour_events) – including
--   points that were buffered offline and arrive later. Nothing outside these periods.
-- * Idempotent: each point carries a client UUID; retried uploads never duplicate.
-- * Retention: location_pings follow organizations.location_retention_days (existing purge);
--   the "latest position" row is removed when the tour is completed.

alter table public.organizations
  add column tracking_mode text not null default 'off' check (tracking_mode in ('off', 'active_tours')),
  add column tracking_interval_seconds int not null default 10 check (tracking_interval_seconds between 5 and 60),
  add column tracking_notice_version int not null default 1 check (tracking_notice_version >= 1),
  add column tracking_enabled_at timestamptz,
  add column tracking_enabled_by uuid;

alter table public.location_pings
  add column client_id uuid,
  add column vehicle_id uuid,
  add column accuracy_m real check (accuracy_m is null or accuracy_m between 0 and 10000),
  add column speed_mps real check (speed_mps is null or speed_mps between 0 and 100),
  add column heading_deg real check (heading_deg is null or heading_deg between 0 and 360),
  add column received_at timestamptz not null default now();
create unique index location_pings_client_idx on public.location_pings (organization_id, client_id) where client_id is not null;
create index location_pings_driver_idx on public.location_pings (organization_id, driver_id, recorded_at desc);

-- Driver acknowledged the tracking notice (version) – shown in the app before tracking starts.
create table public.tracking_notice_acks (
  organization_id uuid not null,
  driver_id uuid not null,
  notice_version int not null,
  acknowledged_at timestamptz not null default now(),
  primary key (organization_id, driver_id, notice_version),
  foreign key (organization_id, driver_id) references public.drivers (organization_id, id) on delete cascade
);

-- Latest position per driver for the live fleet map (one row, overwritten).
create table public.driver_positions (
  organization_id uuid not null,
  driver_id uuid not null,
  tour_id uuid not null,
  vehicle_id uuid,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m real,
  speed_mps real,
  heading_deg real,
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  primary key (organization_id, driver_id),
  foreign key (organization_id, driver_id) references public.drivers (organization_id, id) on delete cascade,
  foreign key (organization_id, tour_id) references public.tours (organization_id, id) on delete cascade
);

alter table public.tracking_notice_acks enable row level security;
alter table public.driver_positions enable row level security;
-- Staff in depot scope see positions of tours they can see; drivers see only their own row.
create policy positions_select on public.driver_positions for select to authenticated
  using ((app.is_org_staff(organization_id) and tour_id in (select t.id from public.tours t))
         or driver_id in (select app.my_driver_ids()));
create policy notice_acks_select on public.tracking_notice_acks for select to authenticated
  using (app.is_org_staff(organization_id) or driver_id in (select app.my_driver_ids()));
-- Read through RLS; all writes go through the functions below. Explicit, independent of the
-- platform's default privileges.
revoke all on public.driver_positions, public.tracking_notice_acks from anon, authenticated;
grant select on public.driver_positions, public.tracking_notice_acks to authenticated;
-- Pings are written only by driver_record_locations (validated); the old direct-insert path closes.
drop policy pings_insert on public.location_pings;
revoke insert on public.location_pings from authenticated;

-- Driver: acknowledge the organization's current tracking notice.
create or replace function public.driver_ack_tracking_notice(p_org uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_driver uuid;
  v_version int;
begin
  select d.id into v_driver from public.drivers d
  where d.organization_id = p_org and d.id in (select app.my_driver_ids());
  if v_driver is null then
    raise exception 'not a driver of this organization' using errcode = '42501';
  end if;
  select tracking_notice_version into v_version from public.organizations where id = p_org;
  insert into public.tracking_notice_acks (organization_id, driver_id, notice_version)
  values (p_org, v_driver, v_version) on conflict do nothing;
  return v_version;
end;
$$;

-- Driver: upload a batch of positions for one tour. Returns
-- {"accepted": n, "duplicates": n, "rejected": [{"id": ..., "reason": ...}]}.
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
  if o.tracking_mode <> 'active_tours' then
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
    -- Inside a driving period of this tour? (start/resume .. pause/complete, 30 s tolerance)
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

  -- The live position moves only while the tour is being driven.
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

-- A completed tour has no live position any more (history stays until the retention purge).
create or replace function app.clear_position_on_complete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    delete from public.driver_positions where tour_id = new.id;
  end if;
  return new;
end;
$$;
create trigger tours_clear_position after update of status on public.tours for each row execute function app.clear_position_on_complete();

-- Retention: also drop stale live rows (e.g. a tour never completed).
create or replace function app.purge_expired_data() returns void
language sql security definer set search_path = '' as $$
  delete from public.location_pings lp
  using public.organizations o
  where o.id = lp.organization_id
    and lp.recorded_at < now() - make_interval(days => o.location_retention_days);
  delete from public.driver_positions where recorded_at < now() - interval '24 hours';
  delete from public.proofs p
  using public.organizations o
  where o.id = p.organization_id
    and p.created_at < now() - make_interval(days => o.proof_retention_days);
$$;

revoke execute on function public.driver_record_locations(uuid, jsonb) from public, anon;
revoke execute on function public.driver_ack_tracking_notice(uuid) from public, anon;
grant execute on function public.driver_record_locations(uuid, jsonb) to authenticated;
grant execute on function public.driver_ack_tracking_notice(uuid) to authenticated;
revoke execute on function app.clear_position_on_complete() from public, anon, authenticated;
revoke execute on function app.purge_expired_data() from public, anon, authenticated;
