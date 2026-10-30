/** Client-only game state. The machine wins on the first focus/visibility loss after entry. */
export type LossReason = 'blur' | 'hidden' | 'pagehide' | 'concede' | 'reload';
export type SessionEvent = 'click' | 'scroll' | 'activity';
export type Phase = 'ready' | 'playing' | 'lost';
export interface SessionSnapshot {
  id: string; elapsedMs: number; clicks: number; scrolls: number; idleMs: number;
  phase: Phase; lossReason: LossReason | null; completed: boolean; concession: boolean;
}
export function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map(part => String(part).padStart(2, '0')).join(':');
}
export function nextMilestone(seconds: number, thresholds: readonly number[]) {
  let previous = 0;
  for (const target of thresholds) {
    if (seconds < target) return { previous, target };
    previous = target;
  }
  return null;
}
export function createSession(now: () => number = () => performance.now()) {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID() : `session-${Math.floor(now())}`;
  let phase: Phase = 'ready';
  let lossReason: LossReason | null = null;
  let elapsed = 0;
  let lastTick = now();
  let lastActivity = lastTick;
  let clicks = 0;
  let scrolls = 0;
  function accumulate() {
    const current = now();
    if (phase === 'playing') elapsed += Math.max(0, current - lastTick);
    lastTick = current;
    return current;
  }
  return {
    start() {
      if (phase !== 'ready') return;
      lastTick = now();
      lastActivity = lastTick;
      phase = 'playing';
    },
    record(event: SessionEvent) {
      if (phase !== 'playing') return;
      const current = accumulate();
      if (event === 'click') clicks++;
      if (event === 'scroll') scrolls++;
      lastActivity = current;
    },
    lose(reason: LossReason) {
      if (phase !== 'playing') return;
      accumulate();
      lossReason = reason;
      phase = 'lost';
    },
    snapshot(): SessionSnapshot {
      const current = accumulate();
      return { id, elapsedMs: Math.round(elapsed), clicks, scrolls,
        idleMs: phase === 'playing' ? Math.max(0, Math.round(current - lastActivity)) : 0,
        phase, lossReason, completed: phase === 'lost', concession: lossReason === 'concede' };
    }
  };
}
