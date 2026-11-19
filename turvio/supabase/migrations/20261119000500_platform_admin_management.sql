-- Platform administrators can be added and removed from TURVIO Admin (previously SQL only).
-- public.platform_admins has no write policy; these two SECURITY DEFINER functions are the only way in,
-- and both require the caller to be a platform administrator. The API additionally requires
-- two-step verification (aal2) for every platform route. Additive: no existing row changes.

create or replace function public.platform_add_admin(p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
begin
  if not app.is_platform_admin() then
    raise exception 'platform administrators only' using errcode = '42501';
  end if;
  select u.id into uid from auth.users u where lower(u.email) = lower(trim(p_email));
  if uid is null then
    raise exception 'no TURVIO account uses this e-mail address' using errcode = 'P0002';
  end if;
  insert into public.platform_admins (user_id) values (uid) on conflict (user_id) do nothing;
  return uid;
end;
$$;

create or replace function public.platform_remove_admin(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_platform_admin() then
    raise exception 'platform administrators only' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'you cannot remove your own platform access' using errcode = '22023';
  end if;
  delete from public.platform_admins where user_id = p_user;
  if not found then
    raise exception 'not a platform administrator' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.platform_admins) then
    raise exception 'at least one platform administrator must remain' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.platform_add_admin(text), public.platform_remove_admin(uuid) from public, anon;
grant execute on function public.platform_add_admin(text), public.platform_remove_admin(uuid) to authenticated;
