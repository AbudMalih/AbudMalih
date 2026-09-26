-- =============================================================================
-- JARBOU Recruiting Command Center – initial PostgreSQL schema (v2.0 NAS)
-- Applied automatically by the application on start (see backend/src/migrate.js).
-- Never edit an applied migration – add a new numbered file instead.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- Users & auth
CREATE TABLE roles (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  description text NOT NULL DEFAULT ''
);
INSERT INTO roles (key, label, description) VALUES
  ('admin',     'Admin',     'Full access incl. users, settings, backups, restore and audit log'),
  ('recruiter', 'Recruiter', 'Manage candidates, documents, contracts, onboarding and follow-ups'),
  ('viewer',    'Viewer',    'Read-only access to dashboard, candidates and reports');

CREATE TABLE users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username             text NOT NULL,
  email                text,
  full_name            text NOT NULL,
  role                 text NOT NULL REFERENCES roles(key),
  password_hash        text NOT NULL,
  is_active            boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  preferences          jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_login_at        timestamptz,
  password_changed_at  timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9._-]{3,40}$'),
  CONSTRAINT users_full_name_len CHECK (char_length(full_name) BETWEEN 1 AND 120)
);
CREATE UNIQUE INDEX users_username_uq ON users (lower(username));
CREATE UNIQUE INDEX users_email_uq ON users (lower(email)) WHERE email IS NOT NULL AND email <> '';

CREATE TABLE sessions (
  id_hash      text PRIMARY KEY,               -- sha256 of the session token; the token itself is never stored
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token   text NOT NULL,
  remember     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  user_agent   text
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- ---------------------------------------------------------------- Master data
CREATE TABLE projects (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_name_len CHECK (char_length(name) BETWEEN 1 AND 80)
);
CREATE UNIQUE INDEX projects_name_uq ON projects (lower(name));

CREATE TABLE stations (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stations_name_len CHECK (char_length(name) BETWEEN 1 AND 80)
);
CREATE UNIQUE INDEX stations_name_uq ON stations (lower(name));

CREATE TABLE positions (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT positions_name_len CHECK (char_length(name) BETWEEN 1 AND 80)
);
CREATE UNIQUE INDEX positions_name_uq ON positions (lower(name));

CREATE TABLE recruitment_sources (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sources_name_len CHECK (char_length(name) BETWEEN 1 AND 80)
);
CREATE UNIQUE INDEX sources_name_uq ON recruitment_sources (lower(name));

CREATE TABLE document_types (
  key            text PRIMARY KEY,
  label          text NOT NULL,
  short_label    text,
  required_default boolean NOT NULL DEFAULT true,
  has_expiry     boolean NOT NULL DEFAULT false,
  is_builtin     boolean NOT NULL DEFAULT false,
  case_by_case   boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true,
  sort_order     int NOT NULL DEFAULT 0,
  CONSTRAINT document_types_key_format CHECK (key ~ '^[a-z0-9_]{2,60}$')
);

CREATE TABLE onboarding_templates (
  key        text PRIMARY KEY,
  label      text NOT NULL,
  auto_rule  text CHECK (auto_rule IN ('documents', 'contract')),
  is_active  boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  CONSTRAINT onboarding_key_format CHECK (key ~ '^[a-z0-9_]{2,60}$')
);

CREATE TABLE recruitment_targets (
  id         serial PRIMARY KEY,
  project_id int NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  station_id int REFERENCES stations(id) ON DELETE CASCADE,    -- NULL = all stations of the project
  required   int NOT NULL CHECK (required BETWEEN 0 AND 100000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX recruitment_targets_uq ON recruitment_targets (project_id, COALESCE(station_id, 0));

CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------- Candidates
CREATE SEQUENCE candidate_number_seq START 1;

CREATE TABLE candidates (
  id                     text PRIMARY KEY,                      -- e.g. JRB-0001
  first_name             text NOT NULL,
  last_name              text NOT NULL,
  phone                  text NOT NULL DEFAULT '',
  email                  text NOT NULL DEFAULT '',
  dob                    date,
  address                text NOT NULL DEFAULT '',
  city                   text NOT NULL DEFAULT '',
  nationality            text NOT NULL DEFAULT '',
  language               text NOT NULL DEFAULT '',
  position_id            int REFERENCES positions(id),
  project_id             int REFERENCES projects(id),
  station_id             int REFERENCES stations(id),
  employment_type        text NOT NULL DEFAULT '',
  start_date             date,
  tax_class              text NOT NULL DEFAULT '',
  salary_reference       numeric(10,2),
  salary_basis           text NOT NULL DEFAULT 'net' CHECK (salary_basis IN ('net', 'gross')),
  salary_expectation_min numeric(10,2),
  salary_expectation_max numeric(10,2),
  hours_per_week         numeric(5,2),
  availability           text NOT NULL DEFAULT '' CHECK (availability IN ('', 'ready', 'later', 'undecided', 'not_available')),
  application_date       date,
  source_id              int REFERENCES recruitment_sources(id),
  interview_date         date,
  interview_status       text NOT NULL DEFAULT 'Not Scheduled',
  recruiter_id           uuid REFERENCES users(id) ON DELETE SET NULL,
  recruiter_label        text NOT NULL DEFAULT '',            -- free-text recruiter from imported data without an account
  stage                  text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','contacted','interview','interested','documents','contract','ready','started')),
  next_action            text NOT NULL DEFAULT '',
  notes                  text NOT NULL DEFAULT '',
  last_contact           date,
  ready_since            date,
  started_on             date,
  archived               boolean NOT NULL DEFAULT false,
  archive_reason         text NOT NULL DEFAULT '',
  archive_date           date,
  archive_note           text NOT NULL DEFAULT '',
  version                int NOT NULL DEFAULT 1,
  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  updated_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT candidates_names CHECK (char_length(first_name) BETWEEN 1 AND 100 AND char_length(last_name) BETWEEN 1 AND 100),
  CONSTRAINT candidates_salary_range CHECK (salary_expectation_max IS NULL OR salary_expectation_min IS NULL OR salary_expectation_max >= salary_expectation_min),
  CONSTRAINT candidates_hours CHECK (hours_per_week IS NULL OR hours_per_week BETWEEN 0 AND 60)
);
CREATE INDEX candidates_updated_idx  ON candidates (updated_at);
CREATE INDEX candidates_start_idx    ON candidates (start_date) WHERE NOT archived;
CREATE INDEX candidates_stage_idx    ON candidates (stage) WHERE NOT archived;
CREATE INDEX candidates_project_idx  ON candidates (project_id, station_id);
CREATE INDEX candidates_archived_idx ON candidates (archived);
CREATE INDEX candidates_name_idx     ON candidates (lower(last_name), lower(first_name));
CREATE INDEX candidates_phone_idx    ON candidates (regexp_replace(phone, '\D', '', 'g'));

-- Tombstones so that clients can remove permanently deleted candidates during incremental sync.
CREATE TABLE candidate_deletions (
  candidate_id text PRIMARY KEY,
  deleted_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE candidate_documents (
  candidate_id text NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  doc_key      text NOT NULL,
  status       text NOT NULL CHECK (status IN ('not_required','missing','requested','received','verified')),
  issue_date   date,
  expiry_date  date,
  note         text NOT NULL DEFAULT '',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (candidate_id, doc_key)
);
CREATE INDEX candidate_documents_status_idx ON candidate_documents (doc_key, status);
CREATE INDEX candidate_documents_expiry_idx ON candidate_documents (expiry_date) WHERE expiry_date IS NOT NULL;

CREATE TABLE contracts (
  candidate_id text PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','preparing','prepared','sent','signed','completed')),
  contract_type text NOT NULL DEFAULT '',
  salary       numeric(10,2),
  hours        numeric(5,2),
  start_date   date,
  end_date     date,
  signed_date  date,
  note         text NOT NULL DEFAULT '',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX contracts_status_idx ON contracts (status);

CREATE TABLE candidate_onboarding (
  candidate_id text NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  step_key     text NOT NULL,
  done         boolean NOT NULL DEFAULT false,
  done_date    date,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (candidate_id, step_key)
);

CREATE TABLE follow_ups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id text NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  due_date     date NOT NULL,
  due_time     time,
  type         text NOT NULL DEFAULT 'phone' CHECK (type IN ('phone','whatsapp','email','meeting','other')),
  note         text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  completed_by uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX follow_ups_open_idx ON follow_ups (due_date) WHERE status = 'open';
CREATE INDEX follow_ups_candidate_idx ON follow_ups (candidate_id);

CREATE TABLE candidate_activity (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id text NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('call','whatsapp','email','meeting','document','note','other','system')),
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  text         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT activity_text_len CHECK (char_length(text) BETWEEN 1 AND 4000)
);
CREATE INDEX candidate_activity_candidate_idx ON candidate_activity (candidate_id, occurred_at DESC);
CREATE INDEX candidate_activity_recent_idx ON candidate_activity (created_at DESC);

CREATE TABLE candidate_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id text NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  text         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT note_text_len CHECK (char_length(text) BETWEEN 1 AND 8000)
);
CREATE INDEX candidate_notes_candidate_idx ON candidate_notes (candidate_id, created_at DESC);

CREATE TABLE attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  text NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  doc_key       text,                                   -- optional link to a checklist document
  original_name text NOT NULL,
  stored_name   text NOT NULL UNIQUE,                   -- generated server-side, never user controlled
  mime_type     text NOT NULL,
  size_bytes    bigint NOT NULL CHECK (size_bytes > 0),
  sha256        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX attachments_candidate_idx ON attachments (candidate_id);

-- ---------------------------------------------------------------- Audit & operations
CREATE TABLE audit_logs (
  id           bigserial PRIMARY KEY,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  actor_id     uuid,                                    -- no FK: audit entries must survive user changes
  actor_name   text NOT NULL,
  actor_role   text,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text,
  candidate_id text,
  summary      text NOT NULL DEFAULT '',
  changes      jsonb,
  ip           text
);
CREATE INDEX audit_logs_time_idx      ON audit_logs (occurred_at DESC);
CREATE INDEX audit_logs_candidate_idx ON audit_logs (candidate_id, occurred_at DESC);
CREATE INDEX audit_logs_actor_idx     ON audit_logs (actor_id, occurred_at DESC);
CREATE INDEX audit_logs_action_idx    ON audit_logs (action);

-- Audit log is append-only: updates and deletes are rejected by the database itself.
CREATE FUNCTION audit_logs_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END $$;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_immutable();

CREATE TABLE backup_history (
  id          bigserial PRIMARY KEY,
  file_name   text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('auto','manual','pre-restore','pre-update')),
  status      text NOT NULL CHECK (status IN ('success','failed')),
  size_bytes  bigint,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  message     text NOT NULL DEFAULT '',
  created_by  text
);
CREATE INDEX backup_history_time_idx ON backup_history (started_at DESC);
