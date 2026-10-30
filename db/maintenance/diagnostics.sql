-- PD04D diagnostic report. Safe read-only queries.
SELECT s.assignment,s.status,count(*)::integer AS sessions,
  count(*) FILTER (WHERE EXISTS(SELECT 1 FROM exposures e WHERE e.session_id=s.id))::integer AS sessions_with_exposure
FROM sessions s GROUP BY s.assignment,s.status ORDER BY s.assignment,s.status;

SELECT s.id::text,s.assignment,s.status,s.started_at,s.ended_at,
  count(e.id)::integer AS exposures,
  count(e.id) FILTER (WHERE e.ordinal=0)::integer AS baseline_exposures,
  count(e.id) FILTER (WHERE e.ended_at IS NULL)::integer AS open_exposures,
  count(e.id) FILTER (WHERE e.source='model')::integer AS model_exposures
FROM sessions s LEFT JOIN exposures e ON e.session_id=s.id
GROUP BY s.id ORDER BY s.started_at DESC LIMIT 50;

SELECT e.session_id::text,e.ordinal,e.source,e.displayed_at,e.ended_at,
  e.mutation->>'strategy' AS strategy,e.mutation->>'headline' AS headline
FROM exposures e ORDER BY e.displayed_at DESC LIMIT 50;
