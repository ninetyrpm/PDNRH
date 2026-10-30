/** In-memory, privacy-preserving instrumentation for PD02. No network calls. */
export type SessionEvent = 'click' | 'scroll' | 'activity';
export interface SessionSnapshot {
  id: string;
  elapsedMs: number;
  clicks: number;
  scrolls: number;
  idleMs: number;
  completed: boolean;
  concession: boolean;
}

export function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map(part => String(part).padStart(2, '0')).join(':');
}

export function nextMilestone(seconds: number, thresholds: readonly number[]) {
  let previous = 0;
  for (const target of thresholds) {
    if (seconds < target) return { previous, target };
    previous = target;
  }
  return null;
}

export function createSession(now: () => number = () => performance.now(), isVisible = true) {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `session-${Math.floor(now())}`;
  let accumulated = 0;
  let lastTick = now();
  let lastActivity = lastTick;
  let visible = isVisible;
  let clicks = 0;
  let scrolls = 0;
  let concession = false;

  function accumulate() {
    const current = now();
    if (visible && !concession) accumulated += Math.max(0, current - lastTick);
    lastTick = current;
    return current;
  }

  return {
    record(event: SessionEvent) {
      if (concession) return;
      const current = accumulate();
      if (event === 'click') clicks++;
      if (event === 'scroll') scrolls++;
      lastActivity = current;
    },
    setVisible(next: boolean) {
      const current = accumulate();
      visible = next;
      if (next) lastActivity = current;
    },
    concede() { accumulate(); concession = true; },
    snapshot(): SessionSnapshot {
      const current = accumulate();
      return {
        id,
        elapsedMs: Math.round(accumulated),
        clicks,
        scrolls,
        idleMs: visible && !concession ? Math.max(0, Math.round(current - lastActivity)) : 0,
        completed: concession,
        concession
      };
    }
  };
}
