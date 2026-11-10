# Stop location history (P0-3.2)

Migration `supabase/migrations/20261118000100_stop_location_history.sql`, rollback
`supabase/rollback/20261118000100_stop_location_history.down.sql`.

## Four concepts, kept apart

| Concept | Where | Who writes |
|---|---|---|
| Original address + coordinates | `stop_location_origins` (one row per stop, immutable) | trigger when the stop is created |
| Current address + coordinates | `stops` (now with `address_version`, `location_version`, `location_precision`) | staff (RLS, Phase B depot scope), drivers through `driver_update_stop` / `driver_edit_stop` |
| Suggested approach point | `stop_location_checks.suggested_*` (part of the latest check result) | the API's own role via `app.store_location_check` |
| Accepted navigation approach | `stop_location_decisions.approach_*` | staff via `accept_stop_approach` (explicit; never automatic) |

Plus `stop_location_events`: append-only audit of every address / coordinate change, confirmation,
approach acceptance / removal / invalidation and stop deletion, with actor, role, time, reason,
previous and new values.

### Existing stops

Stops created before the migration get `kind = 'baseline_at_migration'`, `provenance = 'unknown'`,
`captured_by = null`: the earliest state TURVIO recorded. The API labels it "Earliest recorded
state – original import not recorded"; it is never presented as imported data. No events are
created for the past.

### Provenance

`provenance` is the channel declared by the creating client (`import_file`, `import_paste`,
`dispatch_manual`, otherwise `api`). Stops created by a driver are always `driver_capture`,
whatever the client declares. The actor (`captured_by`, `actor_user_id`) and role always come from
the authenticated database session (`auth.uid()`, memberships) – never from request data.

## Rules enforced by the database

- **Originals are immutable.** Users and the API role have SELECT only; a trigger rejects UPDATE
  always and DELETE except while the stop itself (or the whole company) is being deleted.
- **The audit is append-only.** Same mechanism; DELETE only by the retention purge or company deletion.
- **Versions** are set by triggers; client values are ignored.
- **Reason after publication (D4).** Staff changes to the address or coordinates of a stop on a
  published tour need a reason (`turvio.change_reason`); otherwise the change is refused.
- **Confirmations and approach points** belong to the exact coordinate and address version. Any
  change deletes them (and records `confirmation_invalidated` / `approach_invalidated`); the API
  also compares on every read.
- **Stale edits.** `expectedLocationVersion` / `expectedAddressVersion` on dispatcher and driver
  edits; a newer change answers 409 `version_conflict`.
- **Visibility.** Originals and history: staff with access to the stop's depot (company admins also
  for deleted stops). Check results and decisions: whoever may see the stop, incl. the driver of the
  published tour. Drivers never see originals or history (D9).

## Retention and deletion (D2, D7)

| Data | Kept | Deleted by |
|---|---|---|
| Original record | as long as the stop exists | deleting the stop or the company |
| Location audit (`stop_location_events`) | `organizations.location_audit_retention_days` (default **400**, configurable 30–3650, `null` = keep) – also for deleted stops | hourly / nightly `app.purge_expired_data()`; deleting the company |
| Check results | until `location_check_retention_days` (default 30) after the tour is completed | `app.purge_expired_data()`; any change of the stop's address or coordinates; deleting the stop |
| Decisions | while valid | any change of the stop's address or coordinates; deleting the stop |

**Purpose of the audit:** to show who changed a delivery location, when, why and from what, so that
a dispatcher can review driver corrections and wrong deliveries can be investigated. The 400-day
default is a product default (one year of operations plus a buffer for disputes) and **not** a legal
requirement; each company sets its own period. The audit contains addresses and coordinates –
personal data – so it must not be kept longer than the company needs.

## Stored check results are never shown as current when stale

A stored result is reused only when its coordinate (exact), address version, tour start, road-data
version (`ROUTING_DATA_VERSION`), address-data version (`ADDRESS_DATA_VERSION`) and rules version all
match; without configured data versions only for 24 h. Otherwise the API computes a new result
("pending" while it runs – never stored, never shown as checked).

## Deployment notes (not yet applied anywhere but local test databases)

- Apply like the other migrations (one transaction, `lock_timeout = '5s'`), then re-run
  `supabase/hosted/10_turvio_service.sql` (grants `app.store_location_check` to `turvio_service`).
- Before a rollback: encrypted dump of the four tables; the rollback refuses to run without
  `set local turvio.confirm_drop_location_history = 'yes'`.
- Verified locally: PostgreSQL 17 (data, catalog, visibility) and 18 (catalog) round trips.
