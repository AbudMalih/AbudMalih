-- =============================================================================
-- ROLLBACK of 20261117000100_strict_location_scope.sql
--
-- Restores the database objects exactly as they were before the migration. The function bodies
-- and policies below were copied from the turvio-staging catalog (pg_get_functiondef /
-- pg_policies) on 2026-11-08, before the migration.
--
-- WARNING: this re-opens the Phase B vulnerabilities (fail-open location scope, driver-profile
-- takeover, role overwrite on acceptance, company-wide invitation/notice visibility). Use it only
-- if the migration itself breaks something that an application rollback cannot fix.
--
-- ORDER: roll the APPLICATION back first (release 9e21c2b does not read all_locations), then run
-- this script. The release 13516df reads memberships.all_locations and fails without it.
--
-- Data: no row of any table is changed or deleted. Only the two all_locations columns are
-- dropped; any explicit "all locations" grants made after the migration are listed (as ids)
-- by the NOTICE below before they are lost.
-- Run as one transaction (this file has begin/commit).
-- =============================================================================
begin;
set local lock_timeout = '5s';

do $$
declare n int; who text;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'memberships' and column_name = 'all_locations') then
    raise exception 'rollback: migration 20261117000100 is not applied here – nothing to roll back' using errcode = 'P0001';
  end if;
  select count(*), string_agg(id::text, ', ') into n, who from public.memberships where all_locations;
  if n > 0 then
    raise notice 'rollback: % membership(s) lose their explicit all-locations grant (ids: %). Without assigned locations they become company-wide again (old fail-open rule); with locations, they keep only those.', n, who;
  end if;
end $$;

-- ---------------------------------------------------------------- triggers and new functions
drop trigger if exists invitations_guard on public.invitations;
drop trigger if exists drivers_link_guard on public.drivers;
drop function if exists app.invitations_guard();
drop function if exists app.drivers_link_guard();
drop function if exists app.can_link_driver(uuid, uuid);

-- ---------------------------------------------------------------- previous function bodies
CREATE OR REPLACE FUNCTION app.can_access_depot(org uuid, depot uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
revoke execute on function app.can_access_depot(uuid, uuid) from public, anon;
grant execute on function app.can_access_depot(uuid, uuid) to authenticated;

CREATE OR REPLACE FUNCTION app.accept_invitation(p_token_hash text, p_user uuid)
 RETURNS invitations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  inv public.invitations;
  m_id uuid;
  user_email text;
begin
  select * into inv from public.invitations where token_hash = p_token_hash for update;
  if not found or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at < now() then
    raise exception 'invitation is invalid or expired' using errcode = 'P0002';
  end if;
  select email into user_email from auth.users where id = p_user;
  if lower(user_email) is distinct from lower(inv.email) then
    raise exception 'invitation was issued for a different email address' using errcode = '42501';
  end if;
  insert into public.memberships (organization_id, user_id, role, active)
  values (inv.organization_id, p_user, inv.role, true)
  on conflict (organization_id, user_id) do update set role = excluded.role, active = true
  returning id into m_id;
  delete from public.membership_depots where membership_id = m_id;
  if inv.depot_ids is not null and inv.role = 'dispatcher' then
    insert into public.membership_depots (organization_id, membership_id, depot_id)
    select inv.organization_id, m_id, d from unnest(inv.depot_ids) d;
  end if;
  if inv.driver_id is not null then
    update public.drivers set user_id = p_user where id = inv.driver_id and organization_id = inv.organization_id;
  end if;
  update public.invitations set accepted_at = now(), accepted_by = p_user where id = inv.id returning * into inv;
  return inv;
end;
$function$;
revoke execute on function app.accept_invitation(text, uuid) from public, anon, authenticated;
grant execute on function app.accept_invitation(text, uuid) to turvio_service;

-- ---------------------------------------------------------------- previous policies
drop policy invitations_select on public.invitations;
create policy invitations_select on public.invitations for select to authenticated
  using (app.is_org_admin(organization_id) or app.is_platform_admin() or ((role = 'driver'::org_role) and app.is_org_staff(organization_id)));
drop policy invitations_revoke on public.invitations;
create policy invitations_revoke on public.invitations for update to authenticated
  using (app.is_org_admin(organization_id) or ((role = 'driver'::org_role) and app.is_org_staff(organization_id)) or app.is_platform_admin())
  with check (app.is_org_admin(organization_id) or ((role = 'driver'::org_role) and app.is_org_staff(organization_id)) or app.is_platform_admin());
drop policy notice_acks_select on public.tracking_notice_acks;
create policy notice_acks_select on public.tracking_notice_acks for select to authenticated
  using (app.is_org_staff(organization_id) or (driver_id in (select app.my_driver_ids() as my_driver_ids)));

-- ---------------------------------------------------------------- columns
alter table public.invitations drop column all_locations;
alter table public.memberships drop column all_locations;

delete from supabase_migrations.schema_migrations where version = '20261117000100';
commit;
