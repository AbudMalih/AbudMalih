-- =============================================================================
-- TURVIO – persistent dispatch workflow
--
-- * Optimistic concurrency (tours.version) and publishing of tours to drivers.
-- * Drivers only see tours that dispatch has published.
-- * Tour status/assignment events, stop sequencing, change notifications
--   (LISTEN/NOTIFY, relayed by the API as server-sent events).
-- * Company invitations (owners/admins invite staff, staff invite drivers).
-- * Aggregate tenant statistics for platform admins (no delivery data).
-- =============================================================================

-- Operating time zone of a company (ETAs, "today", shift times).
alter table public.organizations add column time_zone text not null default 'Europe/Berlin';

-- Tours ------------------------------------------------------------------------
alter table public.tours
  add column version int not null default 1,
  add column published_at timestamptz,
  add column published_by uuid,
  add column optimized_at timestamptz,
  add column optimization jsonb,
  add column updated_at timestamptz not null default now();

alter table public.stops add column updated_at timestamptz not null default now();

create or replace function app.bump_version() returns trigger
language plpgsql as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger tours_version before update on public.tours for each row execute function app.bump_version();

create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger stops_touch before update on public.stops for each row execute function app.touch_updated_at();

-- Drivers see published tours only.
drop policy tours_select on public.tours;
create policy tours_select on public.tours for select to authenticated
  using (app.can_access_depot(organization_id, depot_id)
         or (published_at is not null and driver_id in (select app.my_driver_ids())));

-- Tour events -------------------------------------------------------------------
create table public.tour_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  tour_id uuid not null,
  kind text not null check (kind in ('created', 'assigned', 'optimized', 'published', 'unpublished', 'started', 'paused', 'resumed', 'completed')),
  detail jsonb not null default '{}'::jsonb,
  actor_user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (organization_id, tour_id) references public.tours (organization_id, id) on delete cascade
);
create index tour_events_tour_idx on public.tour_events (tour_id, created_at);

create or replace function app.tour_events_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.tour_events (organization_id, tour_id, kind) values (new.organization_id, new.id, 'created');
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.tour_events (organization_id, tour_id, kind, detail)
    values (new.organization_id, new.id,
            case when new.status = 'in_progress' and old.status = 'paused' then 'resumed'
                 when new.status = 'in_progress' then 'started'
                 when new.status = 'paused' then 'paused'
                 else 'completed' end,
            jsonb_build_object('from', old.status, 'to', new.status));
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
  return new;
end;
$$;
create trigger tours_events after insert or update on public.tours for each row execute function app.tour_events_trigger();

alter table public.tour_events enable row level security;
create policy tour_events_select on public.tour_events for select to authenticated
  using (tour_id in (select t.id from public.tours t));

-- Publishing ----------------------------------------------------------------------
create or replace function public.publish_tour(p_tour uuid, p_expected_version int)
returns public.tours
language plpgsql security definer set search_path = '' as $$
declare
  t public.tours;
begin
  select * into t from public.tours where id = p_tour for update;
  if not found or not app.can_access_depot(t.organization_id, t.depot_id) then
    raise exception 'tour not found' using errcode = 'P0002';
  end if;
  if t.version <> p_expected_version then
    raise exception 'version conflict' using errcode = '40001';
  end if;
  if t.driver_id is null then
    raise exception 'assign a driver before publishing' using errcode = '22023';
  end if;
  if not exists (select 1 from public.stops s where s.tour_id = t.id) then
    raise exception 'a tour needs at least one stop' using errcode = '22023';
  end if;
  update public.tours set published_at = now(), published_by = auth.uid() where id = p_tour returning * into t;
  return t;
end;
$$;

create or replace function public.unpublish_tour(p_tour uuid, p_expected_version int)
returns public.tours
language plpgsql security definer set search_path = '' as $$
declare
  t public.tours;
begin
  select * into t from public.tours where id = p_tour for update;
  if not found or not app.can_access_depot(t.organization_id, t.depot_id) then
    raise exception 'tour not found' using errcode = 'P0002';
  end if;
  if t.version <> p_expected_version then
    raise exception 'version conflict' using errcode = '40001';
  end if;
  if t.status <> 'planned' then
    raise exception 'only planned tours can be withdrawn' using errcode = '22023';
  end if;
  update public.tours set published_at = null, published_by = null where id = p_tour returning * into t;
  return t;
end;
$$;

-- Stop order (optimization or manual). Completed stops keep their place in
-- front; the given pending stops follow in order, any others after them.
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
  if t.status = 'completed' then
    raise exception 'tour is completed' using errcode = '22023';
  end if;
  select count(*) into bad from unnest(p_stop_ids) as u(sid)
   where not exists (select 1 from public.stops s where s.id = u.sid and s.tour_id = p_tour and s.status = 'pending');
  if bad > 0 then
    raise exception 'stop list contains stops that are not pending stops of this tour' using errcode = '22023';
  end if;
  with ordered as (
    select s.id,
           row_number() over (
             order by case when s.status <> 'pending' then 0 when array_position(p_stop_ids, s.id) is not null then 1 else 2 end,
                      case when s.status <> 'pending' then s.sequence else coalesce(array_position(p_stop_ids, s.id), 100000 + s.sequence) end
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

-- Change notifications ------------------------------------------------------------
-- Payload carries ids only; clients refetch through RLS-protected endpoints.
create or replace function app.notify_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec record := coalesce(new, old);
  depot uuid;
  tour uuid;
begin
  if tg_table_name = 'tours' then
    tour := rec.id;
    depot := rec.depot_id;
  else
    tour := rec.tour_id;
    depot := coalesce((select t.depot_id from public.tours t where t.id = rec.tour_id), rec.depot_id);
  end if;
  perform pg_notify('turvio_changes', json_build_object(
    'org', rec.organization_id, 'depot', depot, 'tour', tour, 'table', tg_table_name, 'op', lower(tg_op))::text);
  return null;
end;
$$;
create trigger tours_notify after insert or update or delete on public.tours for each row execute function app.notify_change();
create trigger stops_notify after insert or update or delete on public.stops for each row execute function app.notify_change();

-- Invitations ---------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.org_role not null,
  depot_ids uuid[],
  driver_id uuid,
  token_hash text not null unique,
  invited_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid,
  revoked_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, driver_id) references public.drivers (organization_id, id) on delete cascade,
  check (role = 'driver' or driver_id is null)
);
create index invitations_open_idx on public.invitations (organization_id) where accepted_at is null and revoked_at is null;

alter table public.invitations enable row level security;
create policy invitations_select on public.invitations for select to authenticated
  using (app.is_org_admin(organization_id) or app.is_platform_admin()
         or (role = 'driver' and app.is_org_staff(organization_id)));
-- Owners invite anyone; admins anyone but owners; dispatchers drivers only; platform admins (company onboarding).
create policy invitations_insert on public.invitations for insert to authenticated
  with check (
    app.has_org_role(organization_id, array['owner']::public.org_role[])
    or (app.is_org_admin(organization_id) and role <> 'owner')
    or (app.is_org_staff(organization_id) and role = 'driver')
    or app.is_platform_admin()
  );
create policy invitations_revoke on public.invitations for update to authenticated
  using (app.is_org_admin(organization_id) or (role = 'driver' and app.is_org_staff(organization_id)) or app.is_platform_admin())
  with check (app.is_org_admin(organization_id) or (role = 'driver' and app.is_org_staff(organization_id)) or app.is_platform_admin());

create trigger audit_invitations after insert or update or delete on public.invitations
  for each row execute function app.audit();

-- Called by the API service (not by end users) after it verified the user's
-- identity: turns an invitation into a membership.
create or replace function app.accept_invitation(p_token_hash text, p_user uuid)
returns public.invitations
language plpgsql security definer set search_path = '' as $$
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
$$;

-- Team list for org admins (auth.users is not readable by end users).
create or replace function public.org_members(p_org uuid)
returns table (membership_id uuid, user_id uuid, email text, role public.org_role, active boolean, depot_ids uuid[], driver_id uuid, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_org_admin(p_org) then
    raise exception 'only owners and admins can list members' using errcode = '42501';
  end if;
  return query
    select m.id, m.user_id, u.email, m.role, m.active,
           (select array_agg(md.depot_id) from public.membership_depots md where md.membership_id = m.id),
           (select d.id from public.drivers d where d.organization_id = p_org and d.user_id = m.user_id limit 1),
           m.created_at
      from public.memberships m join auth.users u on u.id = m.user_id
     where m.organization_id = p_org
     order by m.created_at;
end;
$$;

-- Public invitation lookup (service only): shows what the invitee is accepting.
create or replace function app.invitation_info(p_token_hash text)
returns table (organization_name text, email text, role public.org_role, state text)
language sql stable security definer set search_path = '' as $$
  select o.name, i.email, i.role,
         case when i.revoked_at is not null then 'revoked'
              when i.accepted_at is not null then 'accepted'
              when i.expires_at < now() then 'expired'
              else 'open' end
    from public.invitations i join public.organizations o on o.id = i.organization_id
   where i.token_hash = p_token_hash;
$$;

-- Platform statistics (aggregates only) --------------------------------------------
create or replace function public.platform_tenant_stats()
returns table (organization_id uuid, active_drivers int, vehicles int, depots int, members int, tours_last_30d int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_platform_admin() then
    raise exception 'platform admins only' using errcode = '42501';
  end if;
  return query
    select o.id,
           (select count(*)::int from public.drivers d where d.organization_id = o.id and d.active),
           (select count(*)::int from public.vehicles v where v.organization_id = o.id and v.active),
           (select count(*)::int from public.depots p where p.organization_id = o.id),
           (select count(*)::int from public.memberships m where m.organization_id = o.id and m.active),
           (select count(*)::int from public.tours t where t.organization_id = o.id and t.tour_date > current_date - 30)
      from public.organizations o;
end;
$$;

-- Subscription summary for any active member (plan gating in the API) – no billing ids.
create or replace function public.subscription_summary(p_org uuid)
returns table (plan_code text, status public.subscription_status, billing_interval public.billing_interval, seats int,
               trial_ends_at timestamptz, current_period_end timestamptz, cancel_at_period_end boolean, limit_overrides jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.is_org_member(p_org) or app.is_platform_admin()) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  return query
    select s.plan_code, s.status, s.billing_interval, s.seats, s.trial_ends_at, s.current_period_end, s.cancel_at_period_end, s.limit_overrides
      from public.subscriptions s where s.organization_id = p_org;
end;
$$;
revoke execute on function public.subscription_summary(uuid) from public;
grant execute on function public.subscription_summary(uuid) to authenticated;

-- Audit: ignore bookkeeping columns when listing changed columns.
create or replace function app.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  cols text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into cols
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value and n.key not in ('updated_at', 'version');
    if cols is null then
      return new;
    end if;
  end if;
  insert into public.audit_log (organization_id, actor_user_id, action, table_name, record_id, changed_columns)
  values (
    case when tg_table_name = 'organizations' then (rec ->> 'id')::uuid else (rec ->> 'organization_id')::uuid end,
    auth.uid(), lower(tg_op), tg_table_name, rec ->> 'id', cols
  );
  return coalesce(new, old);
end;
$$;

-- Privileges ------------------------------------------------------------------------
revoke all on public.tour_events, public.invitations from anon;
grant select on public.tour_events to authenticated;
grant select, insert, update on public.invitations to authenticated;
revoke execute on function public.publish_tour(uuid, int), public.unpublish_tour(uuid, int), public.set_tour_sequence(uuid, uuid[], jsonb), public.platform_tenant_stats() from public;
grant execute on function public.publish_tour(uuid, int), public.unpublish_tour(uuid, int), public.set_tour_sequence(uuid, uuid[], jsonb), public.platform_tenant_stats() to authenticated;
revoke execute on function app.accept_invitation(text, uuid), app.invitation_info(text) from public, authenticated;
revoke execute on function public.org_members(uuid) from public;
grant execute on function public.org_members(uuid) to authenticated;
