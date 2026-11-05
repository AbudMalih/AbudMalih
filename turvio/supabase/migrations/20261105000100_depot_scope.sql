-- =============================================================================
-- TURVIO – depot-scoped dispatch access and unassigned stops
--
-- * Owners/admins keep company-wide access.
-- * A dispatcher can be limited to specific depots (membership_depots). With
--   no rows, the dispatcher sees all depots of their company.
-- * Depot scoping never widens access: it is evaluated inside the tenant
--   checks from the core migration, so another tenant's rows stay invisible.
-- * Stops can exist without a tour ("unassigned", waiting for planning); they
--   then belong to a depot.
-- =============================================================================

alter table public.memberships add constraint memberships_org_id_key unique (organization_id, id);

create table public.membership_depots (
  organization_id uuid not null,
  membership_id uuid not null,
  depot_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (membership_id, depot_id),
  foreign key (organization_id, membership_id) references public.memberships (organization_id, id) on delete cascade,
  foreign key (organization_id, depot_id) references public.depots (organization_id, id) on delete cascade
);

create or replace function app.can_access_depot(org uuid, depot uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_org_admin(org) or (
    app.is_org_staff(org) and (
      not exists (
        select 1 from public.membership_depots md
        join public.memberships m on m.id = md.membership_id
        where m.organization_id = org and m.user_id = auth.uid() and m.active
      )
      or exists (
        select 1 from public.membership_depots md
        join public.memberships m on m.id = md.membership_id
        where m.organization_id = org and m.user_id = auth.uid() and m.active and md.depot_id = depot
      )
    )
  );
$$;

-- Unassigned stops ----------------------------------------------------------
alter table public.stops alter column tour_id drop not null;
alter table public.stops add column depot_id uuid;
alter table public.stops add constraint stops_depot_fk foreign key (organization_id, depot_id) references public.depots (organization_id, id);
alter table public.stops add constraint stops_tour_or_depot check (tour_id is not null or depot_id is not null);
alter table public.stops add constraint stops_unassigned_pending check (tour_id is not null or status = 'pending');
create index stops_unassigned_idx on public.stops (organization_id, depot_id) where tour_id is null;

-- Replace staff policies with depot-aware versions ---------------------------
drop policy depots_select on public.depots;
create policy depots_select on public.depots for select to authenticated
  using (app.can_access_depot(organization_id, id)
         or id in (select d.depot_id from public.drivers d where d.id in (select app.my_driver_ids())));

drop policy vehicles_select on public.vehicles;
drop policy vehicles_write on public.vehicles;
create policy vehicles_select on public.vehicles for select to authenticated
  using (app.can_access_depot(organization_id, depot_id)
         or id in (select t.vehicle_id from public.tours t where t.driver_id in (select app.my_driver_ids())));
create policy vehicles_write on public.vehicles for all to authenticated
  using (app.can_access_depot(organization_id, depot_id)) with check (app.can_access_depot(organization_id, depot_id));

drop policy drivers_select on public.drivers;
drop policy drivers_write on public.drivers;
create policy drivers_select on public.drivers for select to authenticated
  using (app.can_access_depot(organization_id, depot_id) or id in (select app.my_driver_ids()));
create policy drivers_write on public.drivers for all to authenticated
  using (app.can_access_depot(organization_id, depot_id)) with check (app.can_access_depot(organization_id, depot_id));

drop policy tours_select on public.tours;
drop policy tours_write on public.tours;
create policy tours_select on public.tours for select to authenticated
  using (app.can_access_depot(organization_id, depot_id) or driver_id in (select app.my_driver_ids()));
create policy tours_write on public.tours for all to authenticated
  using (app.can_access_depot(organization_id, depot_id)) with check (app.can_access_depot(organization_id, depot_id));

drop policy stops_select on public.stops;
drop policy stops_staff_write on public.stops;
-- Assigned stops follow their tour's visibility (tours RLS applies in the subquery).
create policy stops_select on public.stops for select to authenticated
  using (tour_id in (select t.id from public.tours t)
         or (tour_id is null and app.can_access_depot(organization_id, depot_id)));
create policy stops_staff_write on public.stops for all to authenticated
  using ((tour_id is null and app.can_access_depot(organization_id, depot_id))
         or tour_id in (select t.id from public.tours t where app.can_access_depot(t.organization_id, t.depot_id)))
  with check ((tour_id is null and app.can_access_depot(organization_id, depot_id))
              or tour_id in (select t.id from public.tours t where app.can_access_depot(t.organization_id, t.depot_id)));

drop policy parcels_staff_write on public.parcels;
create policy parcels_staff_write on public.parcels for all to authenticated
  using (app.is_org_staff(organization_id) and stop_id in (select s.id from public.stops s))
  with check (app.is_org_staff(organization_id) and stop_id in (select s.id from public.stops s));

drop policy pings_select on public.location_pings;
create policy pings_select on public.location_pings for select to authenticated
  using (app.is_org_staff(organization_id) and tour_id in (select t.id from public.tours t));

-- membership_depots: admins manage, members read their own scope.
alter table public.membership_depots enable row level security;
create policy membership_depots_select on public.membership_depots for select to authenticated
  using (app.is_org_admin(organization_id)
         or membership_id in (select m.id from public.memberships m where m.user_id = auth.uid()));
create policy membership_depots_write on public.membership_depots for all to authenticated
  using (app.is_org_admin(organization_id)) with check (app.is_org_admin(organization_id));

-- Driver RPCs: staff access now respects depot scope.
create or replace function public.driver_set_stop_status(p_stop_id uuid, p_status public.stop_status, p_notes text default null)
returns public.stops
language plpgsql security definer set search_path = '' as $$
declare
  s public.stops;
begin
  select st.* into s from public.stops st
  join public.tours t on t.id = st.tour_id and t.organization_id = st.organization_id
  where st.id = p_stop_id
    and (t.driver_id in (select app.my_driver_ids()) or app.can_access_depot(t.organization_id, t.depot_id))
  for update of st;
  if not found then
    raise exception 'stop not found' using errcode = 'P0002';
  end if;
  if s.status <> 'pending' and p_status <> 'pending' then
    raise exception 'invalid status transition % -> %', s.status, p_status using errcode = '22023';
  end if;
  if (p_status = 'delivered' and s.type <> 'delivery') or (p_status = 'picked_up' and s.type <> 'pickup') then
    raise exception 'status % not valid for stop type %', p_status, s.type using errcode = '22023';
  end if;
  update public.stops
     set status = p_status,
         completed_at = case when p_status = 'pending' then null else now() end,
         notes = coalesce(p_notes, notes)
   where id = p_stop_id
   returning * into s;
  insert into public.stop_events (organization_id, stop_id, status, notes, actor_user_id)
  values (s.organization_id, s.id, p_status, p_notes, auth.uid());
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
    and (driver_id in (select app.my_driver_ids()) or app.can_access_depot(organization_id, depot_id))
  for update;
  if not found then
    raise exception 'tour not found' using errcode = 'P0002';
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

create trigger audit_membership_depots after insert or update or delete on public.membership_depots
  for each row execute function app.audit();

revoke all on public.membership_depots from anon;
grant select, insert, update, delete on public.membership_depots to authenticated;
revoke execute on function app.can_access_depot(uuid, uuid) from public;
grant execute on function app.can_access_depot(uuid, uuid) to authenticated;
revoke execute on function public.driver_set_stop_status(uuid, public.stop_status, text), public.driver_set_tour_status(uuid, public.tour_status) from public;
grant execute on function public.driver_set_stop_status(uuid, public.stop_status, text), public.driver_set_tour_status(uuid, public.tour_status) to authenticated;
