ALTER TABLE sessions ADD COLUMN IF NOT EXISTS engine_version text NOT NULL DEFAULT 'legacy-v1';
INSERT INTO pdnrh_schema_migrations(version) VALUES('0006_engine_version') ON CONFLICT DO NOTHING;
