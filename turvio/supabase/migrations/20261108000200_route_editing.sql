-- Phase 5: route editing – address corrections, removing and merging stops.

-- A changed address must never keep the coordinates of the old address: unless new
-- coordinates are written in the same update, the stop becomes "needs map position".
create or replace function app.stops_address_guard() returns trigger
language plpgsql as $$
begin
  if (new.street, coalesce(new.house_number, ''), new.postal_code, new.city) is distinct from (old.street, coalesce(old.house_number, ''), old.postal_code, old.city)
     and new.lat is not distinct from old.lat and new.lng is not distinct from old.lng then
    new.lat := null;
    new.lng := null;
    new.location_source := null;
  end if;
  return new;
end;
$$;
create trigger stops_address_guard before update on public.stops for each row execute function app.stops_address_guard();

-- Access helper: open stop on a tour the caller may work on (driver: own published tour; staff: depot scope).
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

-- Drivers remove stops only from their own personal routes (dispatch tours are changed by dispatch).
create function public.driver_delete_stop(p_stop_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.stops := app.editable_stop(p_stop_id);
  origin text;
begin
  select t.origin into origin from public.tours t where t.id = s.tour_id;
  if origin <> 'driver' and not app.can_access_depot(s.organization_id, (select t.depot_id from public.tours t where t.id = s.tour_id)) then
    raise exception 'stops of dispatch tours are removed by dispatch' using errcode = '42501';
  end if;
  if not app.is_open_status(s.status) then
    raise exception 'only open stops can be removed' using errcode = '22023';
  end if;
  delete from public.stops where id = p_stop_id;
end;
$$;

-- Merge one open stop into another of the same tour: parcels move (none are lost), notes are kept.
create function public.merge_stops(p_from uuid, p_into uuid) returns public.stops
language plpgsql security definer set search_path = '' as $$
declare
  a public.stops := app.editable_stop(p_from);
  b public.stops := app.editable_stop(p_into);
begin
  if a.id = b.id or a.tour_id <> b.tour_id or a.organization_id <> b.organization_id then
    raise exception 'stops must be two different stops of the same tour' using errcode = '22023';
  end if;
  if not app.is_open_status(a.status) or not app.is_open_status(b.status) or a.type <> b.type then
    raise exception 'only open stops of the same type can be merged' using errcode = '22023';
  end if;
  update public.parcels set stop_id = b.id where stop_id = a.id and organization_id = a.organization_id;
  update public.stops
     set priority = b.priority or a.priority,
         notes = nullif(concat_ws(' · ', b.notes, a.notes), ''),
         recipient_name = coalesce(b.recipient_name, a.recipient_name)
   where id = b.id
   returning * into b;
  delete from public.stops where id = a.id;
  return b;
end;
$$;

revoke execute on function public.driver_edit_stop(uuid, text, text, text, text, text, double precision, double precision, text), public.driver_delete_stop(uuid), public.merge_stops(uuid, uuid), app.editable_stop(uuid) from public;
grant execute on function public.driver_edit_stop(uuid, text, text, text, text, text, double precision, double precision, text), public.driver_delete_stop(uuid), public.merge_stops(uuid, uuid), app.editable_stop(uuid) to authenticated;
