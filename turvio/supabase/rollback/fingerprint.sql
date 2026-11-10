-- Read-only data fingerprint for migrations: row count + content hash per critical table.
-- Prints no personal data (counts and md5 hashes only). The all_locations column added by
-- 20261117000100 is excluded so the hashes before and after that migration are comparable; so are
-- the columns added by 20261118000100 (stop address/location versions + precision, retention).
select t, n, h from (
  select 'organizations' t, count(*) n, md5(coalesce(string_agg((to_jsonb(x) - 'location_audit_retention_days' - 'location_check_retention_days')::text, '|' order by x.id), '')) h from public.organizations x
  union all select 'subscriptions', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) from public.subscriptions x
  union all select 'memberships', count(*), md5(coalesce(string_agg((to_jsonb(x) - 'all_locations')::text, '|' order by x.id), '')) from public.memberships x
  union all select 'membership_depots', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) from public.membership_depots x
  union all select 'invitations', count(*), md5(coalesce(string_agg((to_jsonb(x) - 'all_locations')::text, '|' order by x.id), '')) from public.invitations x
  union all select 'platform_admins', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) from public.platform_admins x
  union all select 'depots', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.depots x
  union all select 'drivers', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.drivers x
  union all select 'vehicles', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.vehicles x
  union all select 'tours', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.tours x
  union all select 'stops', count(*), md5(coalesce(string_agg((to_jsonb(x) - 'address_version' - 'location_version' - 'location_precision')::text, '|' order by x.id), '')) from public.stops x
  union all select 'parcels', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.parcels x
  union all select 'driver_positions', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) from public.driver_positions x
  union all select 'location_pings', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) from public.location_pings x
  union all select 'tracking_notice_acks', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) from public.tracking_notice_acks x
  union all select 'audit_log', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.audit_log x
  union all select 'auth.users', count(*), md5(coalesce(string_agg(x.id::text || coalesce(x.email, ''), '|' order by x.id), '')) from auth.users x
) f order by t;
