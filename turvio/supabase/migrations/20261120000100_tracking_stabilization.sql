-- Tracking stabilization (final sprint). Additive: new columns with defaults, new functions and
-- triggers; no existing row, column or function body changes.
--
-- 1. Live-position quality: a fix worse than 150 m, or one implying more than 70 m/s (~250 km/h)
--    from the current live position of the same tour, does not replace the live position. The fix
--    itself stays in location_pings (history) – driver_record_locations is unchanged.
-- 2. Drivers can withdraw their tracking acknowledgement: acknowledgements and the live position
--    are removed, further uploads are refused (tracking_notice_required) until they acknowledge
--    again. Every acknowledgement and withdrawal is written to the audit log.
-- 3. Company tracking notice: controller, contact, legal basis and an additional text, shown to
--    drivers with the notice. (The API raises tracking_notice_version when they change.)

-- ---------------------------------------------------------------- 1. live-position quality
create or replace function app.driver_position_quality() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  secs double precision;
  meters double precision;
begin
  if new.accuracy_m is not null and new.accuracy_m > 150 then
    return null;  -- insert: no live row; update: keep the previous live position
  end if;
  if tg_op = 'UPDATE' and old.tour_id = new.tour_id then
    -- (Older fixes never reach this point: driver_record_locations only overwrites a newer fix.)
    secs := extract(epoch from (new.recorded_at - old.recorded_at));
    if secs <= 0 then
      return new;
    end if;
    meters := 2 * 6371008.8 * asin(sqrt(
      power(sin(radians(new.lat - old.lat) / 2), 2)
      + cos(radians(old.lat)) * cos(radians(new.lat)) * power(sin(radians(new.lng - old.lng) / 2), 2)));
    if meters / secs > 70 and meters > 200 then
      return null;  -- physically impossible jump (GPS glitch)
    end if;
  end if;
  return new;
end;
$$;
create trigger driver_positions_quality before insert or update on public.driver_positions
  for each row execute function app.driver_position_quality();

-- ---------------------------------------------------------------- 2. acknowledgement audit + withdrawal
create or replace function app.audit_tracking_ack() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r public.tracking_notice_acks := coalesce(new, old);
begin
  insert into public.audit_log (organization_id, actor_user_id, action, table_name, record_id, changed_columns)
  values (r.organization_id, auth.uid(), case tg_op when 'INSERT' then 'acknowledge' else 'withdraw' end,
          'tracking_notice_acks', r.driver_id::text, array['notice_version:' || r.notice_version]);
  return r;
end;
$$;
create trigger tracking_notice_acks_audit after insert or delete on public.tracking_notice_acks
  for each row execute function app.audit_tracking_ack();

create or replace function public.driver_withdraw_tracking_ack(p_org uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not exists (select 1 from public.drivers d where d.organization_id = p_org and d.id in (select app.my_driver_ids())) then
    raise exception 'no driver profile in this company' using errcode = '42501';
  end if;
  delete from public.tracking_notice_acks a
   where a.organization_id = p_org and a.driver_id in (select app.my_driver_ids());
  get diagnostics n = row_count;
  delete from public.driver_positions p
   where p.organization_id = p_org and p.driver_id in (select app.my_driver_ids());
  perform pg_notify('turvio_changes', json_build_object('org', p_org, 'table', 'driver_positions', 'op', 'delete')::text);
  return n;
end;
$$;
revoke execute on function public.driver_withdraw_tracking_ack(uuid) from public, anon;
grant execute on function public.driver_withdraw_tracking_ack(uuid) to authenticated;

-- ---------------------------------------------------------------- 3. company tracking notice
alter table public.organizations
  add column tracking_notice_controller text check (char_length(tracking_notice_controller) <= 500),
  add column tracking_notice_contact text check (char_length(tracking_notice_contact) <= 300),
  add column tracking_notice_legal_basis text check (char_length(tracking_notice_legal_basis) <= 500),
  add column tracking_notice_text text check (char_length(tracking_notice_text) <= 2000);
