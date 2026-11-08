-- =============================================================================
-- Parcels: own recipient company, and a company-wide tracking-number check for imports.
-- Additive: two nullable columns, one index, one read-only function. Existing parcels and
-- policies are unchanged (the new column falls under the existing row-level security).
-- =============================================================================

alter table public.parcels add column company text;
alter table public.parcels add constraint parcels_company_check check (company is null or char_length(company) between 1 and 160);
-- Position of the parcel within its stop in the imported file (parcels saved in one statement share
-- created_at); keeps the file order when a stop's parcels are listed. Null for older parcels.
alter table public.parcels add column import_position int check (import_position is null or import_position >= 0);

-- Case-insensitive lookups of tracking numbers per organization (import duplicate check).
create index parcels_tracking_upper_idx on public.parcels (organization_id, upper(tracking_number));

-- Which of these tracking numbers are already on a stop of the organization?
-- Company-wide on purpose: a dispatcher of one depot must not import a parcel that another depot
-- already has (row-level security alone would hide it). Returns only what the duplicate check
-- needs; tour name/date only where the caller may see that depot. Members of the organization
-- only (staff and its drivers); nothing for anyone else.
--   blocking = the parcel is planned (open stop) or already delivered/picked up;
--   false    = an earlier attempt ended (failed, attempted, rescheduled, returned, skipped):
--              importing it again is a re-delivery and is allowed.
create or replace function public.find_planned_tracking(p_org uuid, p_tracking text[])
returns table (tracking_number text, stop_status text, blocking boolean, tour_id uuid, tour_name text, tour_date date, visible boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  wanted text[] := (select coalesce(array_agg(distinct upper(btrim(x))), '{}') from unnest(p_tracking) as x);
begin
  if not app.is_org_member(p_org) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  if coalesce(array_length(p_tracking, 1), 0) > 5000 then
    raise exception 'at most 5000 tracking numbers per check' using errcode = '22023';
  end if;
  return query
    select p.tracking_number,
           s.status::text,
           (app.is_open_status(s.status) or s.status in ('delivered', 'picked_up')),
           case when vis then t.id end,
           case when vis then t.name end,
           case when vis then t.tour_date end,
           vis
      from public.parcels p
      join public.stops s on s.id = p.stop_id
      left join public.tours t on t.id = s.tour_id
      cross join lateral (select app.can_access_depot(p.organization_id, coalesce(t.depot_id, s.depot_id)) as vis) v
     where p.organization_id = p_org
       and upper(p.tracking_number) = any (wanted);
end;
$$;
revoke execute on function public.find_planned_tracking(uuid, text[]) from public, anon;
grant execute on function public.find_planned_tracking(uuid, text[]) to authenticated;
