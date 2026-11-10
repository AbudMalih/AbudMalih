-- =============================================================================
-- Rollback of 20261118000100_stop_location_history (P0-3.2).
--
-- DESTROYS the location history recorded since the migration: original-location records,
-- check results, confirmations / accepted approach points and the location audit. Take an
-- encrypted dump of these four tables first (runbook). Refuses to run unless the caller sets
--   set local turvio.confirm_drop_location_history = 'yes';
-- in the same transaction. Restores the exact previous definitions of the functions the
-- migration replaced (driver_update_stop, driver_edit_stop, app.purge_expired_data).
-- Stops, their current address and coordinates are not touched.
-- =============================================================================
do $$
begin
  if coalesce(current_setting('turvio.confirm_drop_location_history', true), '') <> 'yes' then
    raise exception 'refusing to drop the location history: set local turvio.confirm_drop_location_history = ''yes'' after taking a backup';
  end if;
end $$;

drop trigger if exists stops_location_init on public.stops;
drop trigger if exists stops_location_versions on public.stops;
drop trigger if exists stops_location_created on public.stops;
drop trigger if exists stops_location_changed on public.stops;
drop trigger if exists stops_location_deleted on public.stops;
drop trigger if exists organizations_mark_deleting on public.organizations;

drop function if exists public.confirm_stop_location(uuid, double precision, double precision, int, text[], text);
drop function if exists public.accept_stop_approach(uuid, double precision, double precision, text, int, double precision, double precision, int, text);
drop function if exists public.clear_stop_approach(uuid, text);
drop function if exists app.store_location_check(uuid, text, text, jsonb, jsonb, double precision, double precision, text, int, double precision, double precision, int, text, text, int);
drop function if exists app.lock_stop_for_decision(uuid, double precision, double precision, int);
drop function if exists app.stops_location_init();
drop function if exists app.stops_location_versions();
drop function if exists app.stops_location_created();
drop function if exists app.stops_location_changed();
drop function if exists app.stops_location_deleted();
drop function if exists app.organizations_mark_deleting();
-- Functions returning these row types are gone; guards first, then the tables.
drop trigger if exists stop_location_origins_guard on public.stop_location_origins;
drop trigger if exists stop_location_events_guard on public.stop_location_events;
drop table if exists public.stop_location_events;
drop table if exists public.stop_location_decisions;
drop table if exists public.stop_location_checks;
drop table if exists public.stop_location_origins;

drop function if exists app.location_history_guard();
drop function if exists app.change_reason();
drop function if exists app.stop_location_json(public.stops);
drop function if exists app.actor_role(uuid);
drop function if exists app.can_manage_stop(uuid, uuid);
drop function if exists app.stop_depot(uuid);

-- Previous driver functions (exact definitions and grants).
drop function if exists public.driver_update_stop(uuid, boolean, double precision, double precision, text, text, int);
drop function if exists public.driver_edit_stop(uuid, text, text, text, text, text, double precision, double precision, text, text, int);
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
revoke execute on function public.driver_update_stop(uuid, boolean, double precision, double precision, text) from public;
grant execute on function public.driver_update_stop(uuid, boolean, double precision, double precision, text) to authenticated;

create function public.driver_edit_stop(
  p_stop_id uuid, p_recipient_name text, p_street text, p_house_number text, p_postal_code text, p_city text,
  p_lat double precision default null, p_lng double precision default null, p_location_source text default null
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
  update public.stops
     set recipient_name = nullif(trim(p_recipient_name), ''),
         street = trim(p_street), house_number = nullif(trim(p_house_number), ''),
         postal_code = trim(p_postal_code), city = trim(p_city),
         lat = coalesce(p_lat, lat), lng = coalesce(p_lng, lng),
         location_source = case when p_lat is not null then coalesce(p_location_source, 'manual_pin') else location_source end
   where id = p_stop_id
   returning * into s;
  return s;
end;
$$;
revoke execute on function public.driver_edit_stop(uuid, text, text, text, text, text, double precision, double precision, text) from public;
grant execute on function public.driver_edit_stop(uuid, text, text, text, text, text, double precision, double precision, text) to authenticated;

-- Previous retention function (language sql, exact definition).
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
revoke execute on function app.purge_expired_data() from public, anon, authenticated;

alter table public.stops drop column if exists location_precision, drop column if exists location_version, drop column if exists address_version;
alter table public.organizations drop column if exists location_check_retention_days, drop column if exists location_audit_retention_days;
