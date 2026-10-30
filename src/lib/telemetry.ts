import type { SessionSnapshot, LossReason } from './session';

export interface RemoteSession { id: string; credential: string; assignment: string }
export function validRemoteSession(value: unknown): value is RemoteSession {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string,unknown>;
  return typeof o.id === 'string' && /^[0-9a-f-]{36}$/i.test(o.id) &&
    typeof o.credential === 'string' && /^[a-zA-Z0-9_-]{43}$/.test(o.credential) &&
    ['adaptive','static_control','baseline_control'].includes(String(o.assignment));
}
export function telemetryPayload(s: SessionSnapshot, sequence: number, reason?: LossReason) {
  return { type: reason ? 'loss' : 'heartbeat', sequence, elapsedMs: s.elapsedMs,
    clicks: s.clicks, scrolls: s.scrolls, idleMs: s.idleMs, ...(reason ? { reason } : {}) };
}
