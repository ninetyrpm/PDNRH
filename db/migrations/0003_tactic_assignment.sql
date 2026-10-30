ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tactic_family text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tactic_policy text;
INSERT INTO pdnrh_schema_migrations(version) VALUES ('0003_tactic_assignment') ON CONFLICT DO NOTHING;
