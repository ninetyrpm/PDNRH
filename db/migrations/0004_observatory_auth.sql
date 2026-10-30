CREATE TABLE IF NOT EXISTS observatory_login_attempts (
  key_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0
);
INSERT INTO pdnrh_schema_migrations(version) VALUES('0004_observatory_auth') ON CONFLICT DO NOTHING;
