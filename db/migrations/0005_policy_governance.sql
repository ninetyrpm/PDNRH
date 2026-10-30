CREATE TABLE IF NOT EXISTS experiment_policy_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  mode text NOT NULL DEFAULT 'uniform' CHECK(mode IN ('uniform','eligible_preference')),
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT 'Initial governance lock'
);
INSERT INTO experiment_policy_control(singleton,mode,revision,reason) VALUES(true,'uniform',1,'PD08 safe default') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS experiment_policy_audit (
  id bigserial PRIMARY KEY,
  revision integer NOT NULL UNIQUE,
  previous_mode text NOT NULL,
  new_mode text NOT NULL,
  reason text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO pdnrh_schema_migrations(version) VALUES('0005_policy_governance') ON CONFLICT DO NOTHING;
