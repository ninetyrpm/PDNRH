import 'server-only';
import { randomBytes, randomUUID, createHash, randomInt } from 'node:crypto';
import { db } from '@/lib/db';
import { BASE_MUTATION } from '@/lib/mutation';
import { calculateWeights, selectTactic } from '@/lib/tactic-policy';

export type Assignment = 'adaptive' | 'static_control' | 'baseline_control';
export function chooseAssignment(n = randomInt(100)): Assignment {
  if (!Number.isInteger(n) || n < 0 || n > 99) throw new RangeError('assignment seed');
  if (n < 10) return 'baseline_control';
  if (n < 20) return 'static_control';
  return 'adaptive';
}
export function hashCredential(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
export async function openExperimentSession() {
  const id = randomUUID();
  const credential = randomBytes(32).toString('base64url');
  const assignment = chooseAssignment();
  const sql = db();
  const cohorts = await sql`SELECT COUNT(*)::int AS n FROM sessions WHERE assignment='baseline_control' AND status='confirmed_loss' AND elapsed_ms IS NOT NULL`;
  const arms = await sql`SELECT tactic_family AS family,COUNT(*)::int AS completed,AVG(elapsed_ms)::float8 AS mean_elapsed_ms
    FROM sessions WHERE assignment='adaptive' AND status='confirmed_loss' AND elapsed_ms IS NOT NULL
    AND tactic_family IS NOT NULL GROUP BY tactic_family`;
  const evidence = { baselineCompleted: Number(cohorts[0]?.n ?? 0),
    arms: arms.map(r => ({family:String(r.family), completed:Number(r.completed), meanElapsedMs:Number(r.mean_elapsed_ms)})) };
  const governance=await sql`SELECT mode,revision FROM experiment_policy_control WHERE singleton=true`;
  const mode=String(governance[0]?.mode??'uniform');
  const revision=Number(governance[0]?.revision??1);
  const calculated=calculateWeights(evidence);
  const selection=mode==='eligible_preference'&&calculated.eligible ? calculated :
    {weights:Array(3).fill(1/3) as number[],policy:'uniform-v1',eligible:false};
  const tactic = assignment==='adaptive' ? selectTactic(id,selection.weights) : null;
  await sql`INSERT INTO sessions(id,credential_hash,assignment,tactic_family,tactic_policy)
    VALUES(${id},${hashCredential(credential)},${assignment},${tactic?.family ?? null},${tactic ? selection.policy+'-governance-r'+revision : 'control-v1'})`;
  // Create the baseline exposure before returning credentials, so a rapid exit
  // cannot race its insertion. Retried clients cannot create duplicate ordinals.
  await sql`INSERT INTO exposures(session_id,ordinal,mutation,source)
    VALUES(${id},0,${JSON.stringify(BASE_MUTATION)}::jsonb,'control')
    ON CONFLICT(session_id,ordinal) DO NOTHING`;
  await sql`INSERT INTO tactics(strategy_family,strategy_version,definition)
    VALUES('baseline',1,'{"kind":"control","version":1}'::jsonb)
    ON CONFLICT(strategy_family,strategy_version) DO NOTHING`;
  await sql`UPDATE exposures SET tactic_id=(
    SELECT id FROM tactics WHERE strategy_family='baseline' AND strategy_version=1
  ) WHERE session_id=${id} AND ordinal=0 AND tactic_id IS NULL`;
  return { id, credential, assignment, startedAt: new Date().toISOString() };
}
