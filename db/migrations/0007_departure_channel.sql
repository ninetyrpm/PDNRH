-- Additive annotation: preserve the original five validated loss reasons.
-- Explicit allowlisted external-link clicks are pagehide losses with a recorded channel.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS exit_channel text;
INSERT INTO pdnrh_schema_migrations(version) VALUES ('0007_departure_channel')
  ON CONFLICT DO NOTHING;
