import 'server-only';
import { randomBytes, randomUUID, createHash, randomInt } from 'node:crypto';
import { db } from '@/lib/db';
import { BASE_MUTATION } from '@/lib/mutation';

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
  await sql`INSERT INTO sessions(id,credential_hash,assignment)
    VALUES(${id},${hashCredential(credential)},${assignment})`;
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
