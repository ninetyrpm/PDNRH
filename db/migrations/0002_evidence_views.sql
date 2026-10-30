-- PD05A: observational evidence views, no autonomous strategy updates.
BEGIN;
CREATE OR REPLACE VIEW pdnrh_session_evidence AS
SELECT s.id AS session_id, s.assignment, s.status, s.loss_reason,
  s.started_at, s.ended_at, s.elapsed_ms,
  count(e.id)::integer AS exposure_count,
  count(e.id) FILTER (WHERE e.source='model')::integer AS model_exposures,
  count(e.id) FILTER (WHERE e.source='fallback')::integer AS fallback_exposures,
  count(e.id) FILTER (WHERE e.ordinal=0)::integer AS baseline_exposures,
  count(e.id) FILTER (WHERE e.ended_at IS NULL)::integer AS unclosed_exposures,
  CASE WHEN s.status='confirmed_loss' THEN true ELSE false END AS observed_loss,
  CASE WHEN s.status='uncertain' THEN true ELSE false END AS censored,
  CASE WHEN s.status='active' THEN true ELSE false END AS ongoing,
  CASE WHEN s.status='confirmed_loss' THEN s.elapsed_ms ELSE NULL END AS observed_survival_ms
FROM sessions s LEFT JOIN exposures e ON e.session_id=s.id
GROUP BY s.id;
CREATE OR REPLACE VIEW pdnrh_cohort_evidence AS
SELECT assignment,
  count(*)::integer AS sessions,
  count(*) FILTER (WHERE status='confirmed_loss')::integer AS confirmed_losses,
  count(*) FILTER (WHERE status='uncertain')::integer AS uncertain_sessions,
  count(*) FILTER (WHERE status='active')::integer AS active_sessions,
  count(*) FILTER (WHERE baseline_exposures>0)::integer AS sessions_with_baseline,
  avg(observed_survival_ms) FILTER (WHERE observed_loss)::numeric(14,2) AS mean_confirmed_loss_ms
FROM pdnrh_session_evidence GROUP BY assignment;
CREATE OR REPLACE VIEW pdnrh_tactic_observations AS
WITH ordered AS (
  SELECT e.id AS exposure_id,e.session_id,e.ordinal,e.source,e.tactic_id,
    e.mutation->>'strategy' AS claimed_strategy,
    e.displayed_at,e.ended_at,s.status,s.loss_reason,s.assignment,
    row_number() OVER (PARTITION BY e.session_id ORDER BY e.ordinal DESC) AS reverse_ordinal
  FROM exposures e JOIN sessions s ON s.id=e.session_id
)
SELECT exposure_id,session_id,ordinal,source,tactic_id,claimed_strategy,assignment,
  displayed_at,ended_at,
  CASE WHEN ended_at IS NOT NULL THEN greatest(0,extract(epoch FROM (ended_at-displayed_at))) ELSE NULL END AS observed_seconds,
  (reverse_ordinal=1 AND status='confirmed_loss') AS last_exposure_before_reported_loss,
  status,loss_reason
FROM ordered;
INSERT INTO pdnrh_schema_migrations(version) VALUES ('0002_evidence_views') ON CONFLICT DO NOTHING;
COMMIT;
