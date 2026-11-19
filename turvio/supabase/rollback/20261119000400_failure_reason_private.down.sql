-- Rollback of 20261119000400: restore the previous grant (no data involved).
grant execute on function app.failure_reason_allowed(uuid, text) to authenticated;
