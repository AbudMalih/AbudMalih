# JARBOU Recruiting Command Center – API reference (v2.0 NAS)

All endpoints are under `/api`, exchange JSON, and (except `/api/health` and `/api/auth/login`) require a
signed-in session (HttpOnly cookie `jrc_session`). Every non-GET request must send the header
`X-CSRF-Token` with the token returned by `/api/auth/me` or `/api/auth/login`.

Errors: `{ "error": "<code>", "message": "<English text>", "details": {…} }`

| HTTP | code | meaning |
|---|---|---|
| 400 | `validation` | invalid input (message explains) |
| 401 | `unauthorized`, `session_expired`, `invalid_credentials` | not signed in |
| 403 | `forbidden`, `csrf`, `password_change_required` | role lacks permission / missing token |
| 404 | `not_found` | unknown record |
| 409 | `conflict`, `duplicate` | changed by another user / already exists |
| 429 | `rate_limited` | too many sign-in attempts |
| 503 | `db_unavailable`, `maintenance` | database down / restore running |

## Roles and permissions (enforced by the server)

| permission | viewer | recruiter | admin |
|---|:-:|:-:|:-:|
| `read` (dashboard, candidates, reports, settings read) | ✓ | ✓ | ✓ |
| `candidate.write` (create/edit, documents, contract, onboarding, follow-ups, notes, pipeline) | | ✓ | ✓ |
| `candidate.archive` (archive/restore) | | ✓ | ✓ |
| `attachment.read` / `attachment.write` (download/upload files) | | ✓ | ✓ |
| `export` (CSV/XLSX/JSON in the UI) | | ✓ | ✓ |
| `candidate.delete` (permanent delete of archived candidates) | | | ✓ |
| `settings.write`, `users.manage`, `backup.manage`, `audit.read`, `import` | | | ✓ |

## Auth
- `POST /api/auth/login` `{username, password, remember}` → `{user, csrfToken}`
- `POST /api/auth/logout`
- `GET /api/auth/me` → `{user:{id, username, fullName, email, role, mustChangePassword, permissions[], preferences{}}, csrfToken, version}`
- `POST /api/auth/password` `{currentPassword, newPassword}` (also allowed while `mustChangePassword`)
- `PUT /api/me/preferences` `{language?, activeProject?, tableColumns?, pageSize?, sidebarCollapsed?}` (any role)

## Candidates
Candidate object (same shape the frontend always used):
```
{ id, version, createdAt, updatedAt, createdBy, updatedBy,           // read-only
  firstName, lastName, phone, email, dob, address, city, nationality, language,
  project, station, position, source, recruiter,                     // names (lists in settings)
  employmentType, startDate, taxClass, salaryReference, salaryBasis, salaryExpectationMin, salaryExpectationMax,
  hoursPerWeek, availability, applicationDate, interviewDate, interviewStatus, stage, nextAction, notes,
  lastContact, readySince, startedOn, archived, archiveReason, archiveDate, archiveNote,
  followUpDate, followUpNote, followUpTime, followUpType, followUpId,  // = earliest OPEN follow-up
  documents: { <docKey>: {status, issueDate, expiryDate, note} },
  contract: {status, type, salary, hours, startDate, endDate, signedDate, note},
  onboarding: { <stepKey>: {done, date} },
  // only in detail responses (detail: true):
  activities: [{id, type, date, text, by}], noteLog: [{id, date, text, by}],
  attachments: [{id, docKey, name, mime, size, date, by}],
  followUps: [{id, date, time, type, note, status, by, createdAt, completedAt, completedBy}] }
```
- `GET /api/candidates` → `{items[], deleted[], serverTime, full}` (compact, without detail arrays)
- `GET /api/candidates?since=<ISO>` → only candidates changed after `since` + ids deleted since then
- `GET /api/candidates/:id` → full candidate (detail)
- `POST /api/candidates` (candidate.write) body = candidate object without id → 201 full candidate (server assigns id)
- `PATCH /api/candidates/:id` (candidate.write) →
  `{changes:[{path, from, to}], addActivities:[{type,date,text}], removeActivities:[id], addNotes:[{text}], removeNotes:[id]}`
  `path` examples: `startDate`, `station`, `documents.fuehrungszeugnis.status`, `contract.status`, `onboarding.workwear.done`.
  A change is applied only if the stored value still equals `from` (or already equals `to`); otherwise **409 conflict**
  with `details.conflicts=[{field, yours, theirs}]` and nothing is saved. Changing `archived*` needs `candidate.archive`.
  Returns the full candidate.
- `DELETE /api/candidates/:id` (candidate.delete) – only archived candidates
- `POST /api/candidates/:id/follow-ups` (candidate.write) `{date:'YYYY-MM-DD', time?:'HH:MM', type:'phone|whatsapp|email|meeting|other', note, replaceOpen?:bool, activityText?}` → full candidate
- `POST /api/candidates/:id/follow-ups/:fid/complete` `{activityText?}` → full candidate

## Attachments (secure file storage)
- `POST /api/candidates/:id/attachments` multipart: `file`, optional `docKey`, optional `activityText` → full candidate
  (PDF, JPG, PNG, WEBP, HEIC, DOCX, XLSX; content-verified; max `UPLOAD_MAX_MB`)
- `GET /api/attachments/:aid` → file download (`?inline=1` to view PDF/images in the browser)
- `DELETE /api/attachments/:aid` `{activityText?}` → full candidate

## Settings
- `GET /api/settings` → shared settings:
  `companyName, defaultProject, defaultStation, defaultPosition, targetPosition, standardSalaryReference, standardSalaryBasis,
  expiryWarningDays, contractWarningDays, idPrefix, nextNumber, projects[], stations[], positions[], sources[] (active names),
  lists:{projects|stations|positions|sources:[{id,name,active,used}]}, documents[] (active), allDocuments[],
  onboardingSteps[] (active), allOnboardingSteps[], targets:[{id, project, station, required}], requiredDrivers, recruiters[]`
- `PUT /api/settings` (settings.write) `{companyName?, …scalar keys}` → settings
- `POST /api/settings/lists/:type` `{name}` – type = projects | stations | positions | sources
- `PATCH /api/settings/lists/:type/:id` `{name?, active?, move?: -1|1}`
- `DELETE /api/settings/lists/:type/:id` (only if unused, else 409 → deactivate instead)
- `PUT /api/settings/documents` `[ {key?, label, required, expiry} … ]` (order = display order; missing custom keys are deactivated; built-in cannot be removed)
- `PUT /api/settings/onboarding` `[ {key?, label} … ]`
- `PUT /api/settings/targets` `[ {project, station ('' = all stations), required} … ]`

## Users (users.manage)
- `GET /api/users` → `[{id, username, fullName, email, role, active, mustChangePassword, lastLoginAt, createdAt, activeSessions}]`
- `POST /api/users` `{username, fullName, email, role, password}` (user must change the password at first sign-in)
- `PATCH /api/users/:id` `{fullName?, email?, role?, username?, active?}` (deactivation ends all sessions)
- `POST /api/users/:id/reset-password` `{password?}` → `{temporaryPassword?}` (generated when no password given)
- `POST /api/users/:id/revoke-sessions`

## Audit & activity
- `GET /api/audit?limit&offset&q&action&actor&candidate&from&to` (audit.read) → `{items:[{id, occurred_at, actor_name, actor_role, action, entity_type, entity_id, candidate_id, summary, changes:[{field, from, to}]}], total, actors:[{id, full_name}]}`
- `GET /api/activity/recent?limit=12` → `[{id, candidateId, candidate, type, text, date, by}]`

## Backups (backup.manage)
- `GET /api/backups` → `{files:[{name, kind, size, createdAt}], history[], lastSuccess:{file_name, finished_at}, lastStatus, lastMessage, nextScheduled, busy, config:{enabled, time, keepDaily, keepWeekly, keepMonthly, location, timezone}}`
- `POST /api/backups` → create now
- `GET /api/backups/:name/download`
- `POST /api/backups/upload` multipart `file` (.tar.gz from another server/backup location)
- `GET /api/backups/:name/manifest`
- `POST /api/backups/:name/restore` `{confirm:'RESTORE'}` → replaces the database; all users are signed out
- `DELETE /api/backups/:name`

## Import from the offline edition (import)
- `POST /api/import/legacy/preview` body = the JSON backup file of the offline edition →
  `{token, total, duplicates, archived, exportedAt, rows:[{legacyId, name, startDate, archived, duplicateOf, duplicateName, reason, newIdNeeded}], createLists:{projects[], stations[], positions[], sources[]}, newDocuments[], newOnboardingSteps[]}`
- `POST /api/import/legacy/commit` `{token, includeDuplicates:false}` → `{imported, skipped, created}`

## Live updates
- `GET /api/events` – Server-Sent Events: `candidates` `{ids[]|deleted[]|reload}`, `settings` `{what}`, `session`.
  Events carry no personal data; the browser re-syncs via `GET /api/candidates?since=…`.

## Health
- `GET /api/health` (no auth) → `{status:'ok', database:'ok', version}` or 503.
