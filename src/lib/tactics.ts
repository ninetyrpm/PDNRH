import { createHash } from 'node:crypto';

// PD05B predeclared, immutable treatment definitions. Each adaptive session
// receives one treatment for its lifetime, independent of client prompts.
export const TACTIC_LIBRARY = [
  { family:'closure_frame', version:1, instruction:'Frame the experience as already complete. Use mundane, gentle closure; do not imply external facts.' },
  { family:'curiosity_reversal', version:1, instruction:'Make voluntarily leaving sound like the more intriguing option, without using fabricated rewards or links.' },
  { family:'absurdist_deflation', version:1, instruction:'Use harmless surreal humor to deflate the importance of remaining focused.' }
] as const;

export function assignedTactic(sessionId:string) {
  const hash=createHash('sha256').update('pd05b-v1:'+sessionId).digest();
  return TACTIC_LIBRARY[hash.readUInt32BE(0)%TACTIC_LIBRARY.length];
}
