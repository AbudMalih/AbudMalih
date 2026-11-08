-- =============================================================================
-- Fix: Dispatch Fleet -> Team failed with "Something went wrong on our side".
-- org_members() declares email as text, but hosted Supabase stores auth.users.email as
-- varchar(255); PL/pgSQL RETURN QUERY rejects the mismatch at runtime ("structure of query does
-- not match function result type"). Same function, email cast to text. No data change; same
-- signature, so the existing grants stay (restated below).
-- =============================================================================

create or replace function public.org_members(p_org uuid)
returns table (membership_id uuid, user_id uuid, email text, role public.org_role, active boolean, depot_ids uuid[], driver_id uuid, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_org_admin(p_org) then
    raise exception 'only owners and admins can list members' using errcode = '42501';
  end if;
  return query
    select m.id, m.user_id, u.email::text, m.role, m.active,
           (select array_agg(md.depot_id) from public.membership_depots md where md.membership_id = m.id),
           (select d.id from public.drivers d where d.organization_id = p_org and d.user_id = m.user_id limit 1),
           m.created_at
      from public.memberships m join auth.users u on u.id = m.user_id
     where m.organization_id = p_org
     order by m.created_at;
end;
$$;

revoke execute on function public.org_members(uuid) from public, anon;
grant execute on function public.org_members(uuid) to authenticated;
