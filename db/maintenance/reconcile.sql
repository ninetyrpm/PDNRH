-- PD04D manual maintenance, run in Neon SQL Editor.
-- Close recorded exposures of completed sessions, including historical ones.
UPDATE exposures e
SET ended_at=GREATEST(e.displayed_at,s.ended_at)
FROM sessions s
WHERE e.session_id=s.id AND s.status<>'active' AND s.ended_at IS NOT NULL
  AND e.ended_at IS NULL;

-- Sessions without a heartbeat for 3 minutes are uncertain, NOT confirmed defeats.
WITH stale AS (
 UPDATE sessions SET status='uncertain', ended_at=last_seen_at
 WHERE status='active' AND last_seen_at < now()-interval '3 minutes'
 RETURNING id,last_seen_at
)
INSERT INTO outcomes(session_id,classification,evidence)
SELECT id,'uncertain',jsonb_build_object('reason','heartbeat_timeout','lastSeenAt',last_seen_at)
FROM stale ON CONFLICT(session_id) DO NOTHING;

-- Any stale sessions' exposures finish at the last verified server contact.
UPDATE exposures e SET ended_at=GREATEST(e.displayed_at,s.ended_at)
FROM sessions s WHERE e.session_id=s.id AND s.status='uncertain'
AND s.ended_at IS NOT NULL AND e.ended_at IS NULL;
