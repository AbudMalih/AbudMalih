-- =============================================================================
-- Tours: own start and end address, and where a tour ends.
--   end_mode = 'depot'     back to the tour's depot (default, previous behaviour)
--            = 'address'   at end_lat/end_lng (end_label for people)
--            = 'last_stop' at the last stop: no return trip in optimization, road route or ETA
-- start_lat/start_lng (+ start_label) override the depot as the starting point.
-- Additive: existing rows keep their behaviour (a row with an end point becomes 'address').
-- =============================================================================

alter table public.tours
  add column end_mode text not null default 'depot',
  add column start_label text,
  add column end_label text;

update public.tours set end_mode = 'address' where end_lat is not null and end_lng is not null;
-- A half-set point was never usable (every reader needs both coordinates).
update public.tours set start_lat = null, start_lng = null where (start_lat is null) <> (start_lng is null);
update public.tours set end_lat = null, end_lng = null, end_mode = 'depot' where (end_lat is null) <> (end_lng is null);

alter table public.tours
  add constraint tours_end_mode_check check (end_mode in ('depot', 'address', 'last_stop')),
  add constraint tours_start_point_check check (
    (start_lat is null) = (start_lng is null)
    and (start_lat is null or (start_lat between -90 and 90 and start_lng between -180 and 180))
    and (start_label is null or start_lat is not null)
    and (start_label is null or char_length(start_label) between 1 and 200)
  ),
  add constraint tours_end_point_check check (
    (end_lat is null) = (end_lng is null)
    and (end_lat is null or (end_lat between -90 and 90 and end_lng between -180 and 180))
    and ((end_mode = 'address') = (end_lat is not null))
    and (end_label is null or end_lat is not null)
    and (end_label is null or char_length(end_label) between 1 and 200)
  );

-- The driver app's "end at" choice (Optimize screen) is kept for the tour, so its road route and
-- live ETA end where the driver ends. Same access rule as set_tour_sequence: depot staff, or the
-- assigned driver of a published tour. Drivers cannot update tours directly (RLS).
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
revoke execute on function public.set_tour_end(uuid, text, double precision, double precision, text) from public;
grant execute on function public.set_tour_end(uuid, text, double precision, double precision, text) to authenticated;
