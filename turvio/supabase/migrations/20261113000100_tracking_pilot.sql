-- Live tracking pilot: tracking for explicitly named drivers only (e.g. the owner's own phone),
-- while it stays off for every other employee. tracking_mode:
--   'off'          nobody (default)
--   'pilot'        only drivers with tracking_pilot = true
--   'active_tours' every driver who acknowledged the notice (needs DPIA / works council)

alter table public.organizations drop constraint if exists organizations_tracking_mode_check;
alter table public.organizations
  add constraint organizations_tracking_mode_check check (tracking_mode in ('off', 'pilot', 'active_tours'));
alter table public.drivers add column tracking_pilot boolean not null default false;

-- Effective mode for one driver.
create or replace function app.tracking_enabled_for(p_org uuid, p_driver uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case o.tracking_mode
           when 'active_tours' then true
           when 'pilot' then coalesce((select d.tracking_pilot from public.drivers d where d.organization_id = p_org and d.id = p_driver), false)
           else false end
  from public.organizations o where o.id = p_org;
$$;
revoke execute on function app.tracking_enabled_for(uuid, uuid) from public, anon;
grant execute on function app.tracking_enabled_for(uuid, uuid) to authenticated;

-- Same function as in 20261112000100, with the per-driver check.
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
revoke execute on function public.driver_record_locations(uuid, jsonb) from public, anon;
grant execute on function public.driver_record_locations(uuid, jsonb) to authenticated;
