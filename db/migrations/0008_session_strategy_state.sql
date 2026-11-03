-- PD12D: durable within-session strategic state; no changes to policy or outcomes.
CREATE TABLE IF NOT EXISTS session_strategy_state (
  session_id uuid PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision >= 1),
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO pdnrh_schema_migrations(version) VALUES ('0008_session_strategy_state')
  ON CONFLICT DO NOTHING;
