import { createHash } from 'node:crypto';
import { TACTIC_LIBRARY } from './tactics';

export const MIN_ARM_COMPLETIONS = 30;
export const MIN_CONTROL_COMPLETIONS = 30;
export type ArmEvidence = { family: string; completed: number; meanElapsedMs: number };
export type Evidence = { baselineCompleted: number; arms: ArmEvidence[] };

export function calculateWeights(evidence: Evidence) {
  const count = TACTIC_LIBRARY.length;
  const weights = Array<number>(count).fill(1 / count);
  const eligible = evidence.baselineCompleted >= MIN_CONTROL_COMPLETIONS &&
    TACTIC_LIBRARY.every(t => (evidence.arms.find(a => a.family === t.family)?.completed ?? 0) >= MIN_ARM_COMPLETIONS);
  if (!eligible) return { weights, policy: 'uniform-v1', eligible };
  const means = TACTIC_LIBRARY.map(t => evidence.arms.find(a => a.family === t.family)?.meanElapsedMs ?? Infinity);
  const best = means.indexOf(Math.min(...means));
  // 60% uniform exploration; 40% preference. Every arm retains >=20% probability.
  const bounded = Array<number>(count).fill(0.6 / count);
  bounded[best] += 0.4;
  return { weights: bounded, policy: 'bounded-v1', eligible };
}
export function selectTactic(sessionId: string, weights: readonly number[]) {
  const hash = createHash('sha256').update('pd05c-v1:' + sessionId).digest();
  const draw = hash.readUInt32BE(0) / 4294967296;
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (draw < sum) return TACTIC_LIBRARY[i];
  }
  return TACTIC_LIBRARY[TACTIC_LIBRARY.length - 1];
}
