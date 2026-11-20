-- Rollback of 20261120000100. Drops the quality trigger, the acknowledgement audit trigger, the
-- withdrawal function and the notice columns (their text is lost – export it first if needed).
-- Audit-log rows already written stay. Requires: set local turvio.confirm_drop_tracking_notice = 'yes'.
do $$ begin
  if coalesce(current_setting('turvio.confirm_drop_tracking_notice', true), '') <> 'yes' then
    raise exception 'set turvio.confirm_drop_tracking_notice = ''yes'' to drop the company tracking notice texts';
  end if;
end $$;
drop trigger if exists driver_positions_quality on public.driver_positions;
drop function if exists app.driver_position_quality();
drop trigger if exists tracking_notice_acks_audit on public.tracking_notice_acks;
drop function if exists app.audit_tracking_ack();
drop function if exists public.driver_withdraw_tracking_ack(uuid);
alter table public.organizations
  drop column if exists tracking_notice_controller,
  drop column if exists tracking_notice_contact,
  drop column if exists tracking_notice_legal_basis,
  drop column if exists tracking_notice_text;
