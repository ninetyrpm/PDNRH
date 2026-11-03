-- PD12A: retain the original terminal reasons and distinguish user-activated
-- allowlisted external links from generic pagehide/navigation losses.
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_loss_reason_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_loss_reason_check
  CHECK (loss_reason IN ('blur','hidden','pagehide','concede','reload','external_link'));
INSERT INTO pdnrh_schema_migrations(version) VALUES ('0007_external_link_reason')
  ON CONFLICT DO NOTHING;
