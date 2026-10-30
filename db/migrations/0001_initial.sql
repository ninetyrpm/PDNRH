-- PD04A: append-only experiment foundation. Apply once using Neon's SQL editor.
BEGIN;
CREATE TABLE IF NOT EXISTS pdnrh_schema_migrations (
  version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  credential_hash text NOT NULL,
  assignment text NOT NULL CHECK (assignment IN ('adaptive','static_control','baseline_control')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','confirmed_loss','inferred_loss','uncertain')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  loss_reason text CHECK (loss_reason IN ('blur','hidden','pagehide','concede','reload')),
  elapsed_ms bigint CHECK (elapsed_ms IS NULL OR elapsed_ms >= 0),
  CONSTRAINT finished_session_consistency CHECK (status = 'active' OR ended_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS sessions_started_at_idx ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS sessions_status_seen_idx ON sessions(status,last_seen_at);
CREATE TABLE IF NOT EXISTS tactics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_family text NOT NULL,
  strategy_version integer NOT NULL DEFAULT 1,
  parent_tactic_id uuid REFERENCES tactics(id),
  definition jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(strategy_family,strategy_version)
);
CREATE TABLE IF NOT EXISTS exposures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id),
  tactic_id uuid REFERENCES tactics(id),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  mutation jsonb NOT NULL,
  source text NOT NULL CHECK(source IN ('model','fallback','control')),
  displayed_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  UNIQUE(session_id,ordinal),
  CHECK(ended_at IS NULL OR ended_at >= displayed_at)
);
CREATE INDEX IF NOT EXISTS exposures_session_idx ON exposures(session_id,displayed_at);
CREATE TABLE IF NOT EXISTS events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id),
  event_key text NOT NULL,
  type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(session_id,event_key)
);
CREATE INDEX IF NOT EXISTS events_session_time_idx ON events(session_id,occurred_at);
CREATE TABLE IF NOT EXISTS outcomes (
  session_id uuid PRIMARY KEY REFERENCES sessions(id),
  classification text NOT NULL CHECK(classification IN ('confirmed_loss','inferred_loss','uncertain')),
  observed_reason text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  assessed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO pdnrh_schema_migrations(version) VALUES ('0001_initial') ON CONFLICT DO NOTHING;
COMMIT;
