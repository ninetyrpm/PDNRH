-- PD13E: model-authored worlds are not PD12 PageMutation exposures.
CREATE TABLE IF NOT EXISTS pd13_world_exposures (
 session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 ordinal integer NOT NULL CHECK (ordinal BETWEEN 1 AND 10000),
 world jsonb NOT NULL,
 plan jsonb,
 observations jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_id,ordinal)
);
CREATE INDEX IF NOT EXISTS pd13_world_exposures_recent ON pd13_world_exposures(session_id,ordinal DESC);
