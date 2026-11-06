-- =============================================================================
-- Pin search_path on the remaining helper/trigger functions (Supabase security
-- advisor: function_search_path_mutable, found on turvio-staging 2026-11-06).
-- Their bodies use only built-ins and NEW/OLD, so an empty search_path is safe.
-- No data or behaviour change.
-- =============================================================================
alter function app.bump_version() set search_path = '';
alter function app.touch_updated_at() set search_path = '';
alter function app.default_failure_reasons() set search_path = '';
alter function app.is_open_status(public.stop_status) set search_path = '';
alter function app.stops_address_guard() set search_path = '';
alter function geo.norm(text) set search_path = '';
