import 'server-only';
import { randomBytes, randomUUID, createHash, randomInt } from 'node:crypto';
import { db } from '@/lib/db';

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
  return { id, credential, assignment, startedAt: new Date().toISOString() };
}
