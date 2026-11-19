-- app.failure_reason_allowed(org, code) answered "does this failure-reason code exist in company X?" to
-- any signed-in user for any company (Phase H finding, low). Its only callers are SECURITY DEFINER
-- functions (driver_set_stop_status), which run as the owner and keep working without the grant.
-- Additive in effect: no table, row or other function changes.
revoke execute on function app.failure_reason_allowed(uuid, text) from public, anon, authenticated;
