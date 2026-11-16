-- =============================================================================
-- Rollback of 20261119000300_settings_preferences (Phase B).
-- Drops personal preferences and the company contact fields. Refuses unless the caller sets
--   set local turvio.confirm_drop_settings = 'yes';
-- =============================================================================
do $$
begin
  if coalesce(current_setting('turvio.confirm_drop_settings', true), '') <> 'yes' then
    raise exception 'refusing to drop settings: set local turvio.confirm_drop_settings = ''yes'' after taking a backup';
  end if;
end $$;
drop index if exists public.stops_tour_status_idx;
alter table public.organizations
  drop column if exists contact_email, drop column if exists contact_phone, drop column if exists address_street,
  drop column if exists address_postal_code, drop column if exists address_city, drop column if exists address_country,
  drop column if exists website;
drop table if exists public.user_preferences;
