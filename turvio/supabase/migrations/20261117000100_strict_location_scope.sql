-- =============================================================================
-- Phase B: strict location permissions and safe invitations.
--
-- 1. Location access fails CLOSED: a dispatcher sees only explicitly assigned locations; no
--    assignment = no location data (before: no assignment = the whole company, and deleting a
--    dispatcher's last location silently widened them to all locations). Company-wide access for a
--    non-admin needs memberships.all_locations, which only a Company Admin/Owner can set.
-- 2. Invitations can no longer take over a driver profile: the profile must be in a location the
--    inviter may access and must not be linked to anyone; acceptance never relinks a linked profile
--    and never changes an existing member's role. Rows are locked, so two acceptances cannot race.
-- 3. Driver logins (drivers.user_id) can only be changed by Company Admins or by an invitation.
-- 4. Driver invitations and tracking-notice confirmations are visible per location.
--
-- Additive: one column on memberships, one on invitations; replaced functions, triggers and
-- policies. No organization, member, driver, vehicle, tour, stop, parcel or GPS row is changed.
-- PRE-FLIGHT: refuses to run while an active dispatcher has no assigned location (they would lose
-- all access). A Company Admin must first assign locations or grant all_locations explicitly.
-- =============================================================================

-- ---------------------------------------------------------------- pre-flight
do $$
declare
  n int;
  who text;
begin
  select count(*), string_agg(m.id::text, ', ')
    into n, who
    from public.memberships m
   where m.active and m.role = 'dispatcher'
     and not exists (select 1 from public.membership_depots md where md.membership_id = m.id);
  if n > 0 then
    raise exception 'strict location scope: % active dispatcher membership(s) have no assigned location and would lose all access (membership ids: %). Assign locations or set all_locations explicitly first.', n, who
      using errcode = 'P0001';
  end if;
end $$;

-- ---------------------------------------------------------------- explicit company-wide access
alter table public.memberships add column all_locations boolean not null default false;
comment on column public.memberships.all_locations is
  'Company-wide location access for a non-admin member (e.g. a dispatcher for all locations). Set only by a Company Admin/Owner; owners and admins always have it.';
alter table public.invitations add column all_locations boolean not null default false;

-- ---------------------------------------------------------------- fail-closed location check
create or replace function app.can_access_depot(org uuid, depot uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_org_admin(org) or (
    app.is_org_staff(org) and exists (
      select 1 from public.memberships m
       where m.organization_id = org and m.user_id = auth.uid() and m.active
         and (m.all_locations
              or exists (select 1 from public.membership_depots md where md.membership_id = m.id and md.depot_id = depot))
    )
  );
$$;
revoke execute on function app.can_access_depot(uuid, uuid) from public, anon;
grant execute on function app.can_access_depot(uuid, uuid) to authenticated;

-- May the current user hand out a login for this driver profile? (location + not yet linked)
create or replace function app.can_link_driver(org uuid, p_driver uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.drivers d
     where d.id = p_driver and d.organization_id = org and d.user_id is null
       and (app.is_org_admin(org) or app.can_access_depot(org, d.depot_id))
  );
$$;
revoke execute on function app.can_link_driver(uuid, uuid) from public, anon;
grant execute on function app.can_link_driver(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- invitations: guard every write
-- Runs for API and direct (PostgREST) writes alike. Admins and platform admins included, except
-- where noted: nobody may invite into a driver profile that is linked or out of their locations.
create or replace function app.invitations_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  admin boolean := app.is_org_admin(new.organization_id) or app.is_platform_admin();
begin
  -- Server-side work without a signed-in user (migrations, seed, service tasks) is trusted like
  -- the RLS-bypassing roles it runs as; the guard polices signed-in users (API and PostgREST).
  if auth.uid() is null then
    return new;
  end if;
  -- The acceptance function (app.accept_invitation) books the acceptance itself.
  if tg_op = 'UPDATE' and coalesce(current_setting('turvio.accepting_invitation', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE' and not admin then
    -- Non-admins may only cancel (revoke) an invitation, nothing else.
    if (new.organization_id, new.email, new.role, new.depot_ids, new.driver_id, new.token_hash, new.expires_at, new.accepted_at, new.accepted_by, new.all_locations)
       is distinct from
       (old.organization_id, old.email, old.role, old.depot_ids, old.driver_id, old.token_hash, old.expires_at, old.accepted_at, old.accepted_by, old.all_locations) then
      raise exception 'only cancelling an invitation is allowed' using errcode = '42501';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.driver_id is not distinct from old.driver_id and new.role = old.role
     and new.depot_ids is not distinct from old.depot_ids and new.all_locations = old.all_locations then
    return new; -- e.g. revoke/accept bookkeeping by an admin or the acceptance function
  end if;
  if new.role = 'driver' then
    if new.driver_id is null then
      raise exception 'a driver invitation needs a driver profile' using errcode = '22023';
    end if;
    if not app.can_link_driver(new.organization_id, new.driver_id) and not app.is_platform_admin() then
      raise exception 'this driver profile is not in your locations or already has a login' using errcode = '42501';
    end if;
  end if;
  if new.role <> 'driver' then
    new.driver_id := null; -- only driver logins are tied to a driver profile
  end if;
  if new.role = 'dispatcher' then
    if new.all_locations and not admin then
      raise exception 'only a Company Admin can grant access to all locations' using errcode = '42501';
    end if;
    if not new.all_locations and coalesce(array_length(new.depot_ids, 1), 0) = 0 then
      raise exception 'a dispatcher invitation needs at least one location (or all locations, set by a Company Admin)' using errcode = '22023';
    end if;
    if exists (select 1 from unnest(new.depot_ids) d where not exists (select 1 from public.depots x where x.id = d and x.organization_id = new.organization_id)) then
      raise exception 'unknown location in this invitation' using errcode = '22023';
    end if;
  elsif new.depot_ids is not null or new.all_locations then
    -- Locations are only meaningful for dispatchers (owners/admins are company-wide).
    new.depot_ids := null;
    new.all_locations := false;
  end if;
  return new;
end;
$$;
create trigger invitations_guard before insert or update on public.invitations
  for each row execute function app.invitations_guard();
revoke execute on function app.invitations_guard() from public, anon, authenticated;

-- Listing and cancelling: admins all; dispatchers only driver invitations of their locations.
drop policy invitations_select on public.invitations;
create policy invitations_select on public.invitations for select to authenticated
  using (app.is_org_admin(organization_id) or app.is_platform_admin()
         or (role = 'driver' and app.is_org_staff(organization_id)
             and driver_id in (select d.id from public.drivers d where app.can_access_depot(d.organization_id, d.depot_id))));
drop policy invitations_revoke on public.invitations;
create policy invitations_revoke on public.invitations for update to authenticated
  using (app.is_org_admin(organization_id) or app.is_platform_admin()
         or (role = 'driver' and app.is_org_staff(organization_id)
             and driver_id in (select d.id from public.drivers d where app.can_access_depot(d.organization_id, d.depot_id))))
  with check (app.is_org_admin(organization_id) or app.is_platform_admin()
         or (role = 'driver' and app.is_org_staff(organization_id)
             and driver_id in (select d.id from public.drivers d where app.can_access_depot(d.organization_id, d.depot_id))));

-- ---------------------------------------------------------------- driver logins
-- drivers_write lets location staff edit their drivers; the login link is not part of that.
create or replace function app.drivers_link_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new; -- server-side work without a signed-in user (see invitations_guard)
  end if;
  if (case when tg_op = 'INSERT' then new.user_id is not null else new.user_id is distinct from old.user_id end)
     and coalesce(current_setting('turvio.linking_driver', true), '') <> 'on'
     and not app.is_org_admin(new.organization_id) then
    raise exception 'only a Company Admin or an accepted invitation can change a driver''s login' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger drivers_link_guard before insert or update of user_id on public.drivers
  for each row execute function app.drivers_link_guard();
revoke execute on function app.drivers_link_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------- acceptance
create or replace function app.accept_invitation(p_token_hash text, p_user uuid)
returns public.invitations
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations;
  m public.memberships;
  d public.drivers;
  m_id uuid;
  user_email text;
begin
  -- Lock the invitation: a second, concurrent acceptance waits and then sees it accepted.
  select * into inv from public.invitations where token_hash = p_token_hash for update;
  if not found or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at < now() then
    raise exception 'invitation is invalid or expired' using errcode = 'P0002';
  end if;
  select email into user_email from auth.users where id = p_user;
  if lower(user_email) is distinct from lower(inv.email) then
    raise exception 'invitation was issued for a different email address' using errcode = '42501';
  end if;

  -- Never change an existing member: same role = just (re)activate; another role = refused.
  select * into m from public.memberships where organization_id = inv.organization_id and user_id = p_user for update;
  if found and m.role <> inv.role then
    raise exception 'already a member of this company with another role – change the role in Team instead' using errcode = '23505';
  end if;

  if inv.role = 'driver' and inv.driver_id is not null then
    -- Lock the profile: two invitations for the same profile cannot both link it.
    select * into d from public.drivers where id = inv.driver_id and organization_id = inv.organization_id for update;
    if not found then
      raise exception 'the driver profile of this invitation no longer exists' using errcode = 'P0002';
    end if;
    if d.user_id is not null and d.user_id <> p_user then
      raise exception 'this driver profile already belongs to another login' using errcode = '23505';
    end if;
    if exists (select 1 from public.drivers x where x.organization_id = inv.organization_id and x.user_id = p_user and x.id <> d.id) then
      raise exception 'this login already belongs to another driver profile of the company' using errcode = '23505';
    end if;
  end if;

  if m.id is null then
    insert into public.memberships (organization_id, user_id, role, active, all_locations)
    values (inv.organization_id, p_user, inv.role, true, inv.role = 'dispatcher' and inv.all_locations)
    returning id into m_id;
    -- Locations of a new dispatcher: exactly the invited ones (none = no access, never all).
    if inv.role = 'dispatcher' and inv.depot_ids is not null then
      insert into public.membership_depots (organization_id, membership_id, depot_id)
      select inv.organization_id, m_id, x from unnest(inv.depot_ids) x
       where exists (select 1 from public.depots dp where dp.id = x and dp.organization_id = inv.organization_id)
      on conflict do nothing;
    end if;
  elsif not m.active then
    -- Same role, deactivated earlier: reactivate; its locations stay as they were.
    update public.memberships set active = true where id = m.id;
  end if;

  if inv.role = 'driver' and inv.driver_id is not null and d.user_id is null then
    perform set_config('turvio.linking_driver', 'on', true);
    update public.drivers set user_id = p_user where id = d.id;
    perform set_config('turvio.linking_driver', 'off', true);
  end if;

  perform set_config('turvio.accepting_invitation', 'on', true);
  update public.invitations set accepted_at = now(), accepted_by = p_user where id = inv.id returning * into inv;
  perform set_config('turvio.accepting_invitation', 'off', true);
  return inv;
end;
$$;
revoke execute on function app.accept_invitation(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- tracking-notice confirmations
drop policy notice_acks_select on public.tracking_notice_acks;
create policy notice_acks_select on public.tracking_notice_acks for select to authenticated
  using (driver_id in (select app.my_driver_ids())
         or (app.is_org_staff(organization_id)
             and driver_id in (select dr.id from public.drivers dr where app.can_access_depot(dr.organization_id, dr.depot_id))));
