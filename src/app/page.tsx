'use client';

import { useEffect, useRef, useState } from 'react';
import { createSession, formatElapsed, nextMilestone, type SessionSnapshot, type LossReason } from '@/lib/session';

const THRESHOLDS = [60, 180, 600, 1800, 3600];
const STORAGE_KEY = 'pdnrh-active-round';
const INITIAL: SessionSnapshot = { id: '', elapsedMs: 0, clicks: 0, scrolls: 0, idleMs: 0, phase: 'ready', lossReason: null, completed: false, concession: false };
const REASONS: Record<LossReason,string> = {
  blur: 'You focused another window. The machine wins.',
  hidden: 'You hid this page. The machine wins.',
  pagehide: 'You navigated away or reloaded. The machine wins.',
  reload: 'You reloaded an active round. The machine wins.',
  concede: 'You conceded. The machine wins.'
};
export default function Home() {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(INITIAL);
  const [ready, setReady] = useState(false);
  const sessionRef = useRef<ReturnType<typeof createSession> | null>(null);
  const [previousReload, setPreviousReload] = useState(false);

  useEffect(() => {
    const session = createSession();
    sessionRef.current = session;
    // sessionStorage survives reloads but not typical new tabs; mark a reload as a loss.
    try { setPreviousReload(sessionStorage.getItem(STORAGE_KEY) === 'playing'); sessionStorage.removeItem(STORAGE_KEY); } catch { /* unavailable storage: in-memory mode */ }
    setSnapshot(session.snapshot());
    setReady(true);
    const update = () => setSnapshot(session.snapshot());
    const lose = (reason: LossReason) => {
      session.lose(reason);
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* storage optional */ }
      update();
    };
    const onBlur = () => lose('blur');
    const onVisibility = () => { if (document.hidden) lose('hidden'); };
    const onPageHide = () => lose('pagehide');
    const onClick = () => { session.record('click'); update(); };
    const onScroll = () => { session.record('scroll'); update(); };
    const onActivity = () => session.record('activity');
    const interval = window.setInterval(update, 250);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('click', onClick);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('pointermove', onActivity, { passive: true });
    document.addEventListener('keydown', onActivity);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('click', onClick);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('pointermove', onActivity);
      document.removeEventListener('keydown', onActivity);
      sessionRef.current = null;
    };
  }, []);

  const begin = () => {
    if (!document.hasFocus() || document.hidden) return;
    sessionRef.current?.start();
    try { sessionStorage.setItem(STORAGE_KEY, 'playing'); } catch { /* optional */ }
    setPreviousReload(false);
    setSnapshot(sessionRef.current?.snapshot() ?? INITIAL);
  };
  const concede = () => {
    sessionRef.current?.lose('concede');
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* optional */ }
    setSnapshot(sessionRef.current?.snapshot() ?? INITIAL);
  };
  const seconds = Math.floor(snapshot.elapsedMs / 1000);
  const upcoming = nextMilestone(seconds, THRESHOLDS);
  const milestoneCount = THRESHOLDS.filter(t => t <= seconds).length;
  return (
    <main className="shell">
      <div className="topline">
        <span className="eyebrow">PDNRH / EXPERIMENT 001</span>
        <span className="eyebrow">SESSION {ready ? snapshot.id.slice(0, 8).toUpperCase() : '--------'}</span>
      </div>
      <div className="primary">
        <p className="eyebrow">YOUR OBJECTIVE: REMAIN HERE.</p>
        <h1>PLEASE DO NOT<br />REMAIN HERE.</h1>
        {snapshot.phase === 'ready' ? (
          <div className="instructions">
            {previousReload && <p role="status">Your previous round ended when you reloaded.</p>}
            <p>The machine wins if you switch tabs, focus another window, minimize, navigate away, reload, or give up.</p>
            <p>Once you begin, keep this page focused. The clock starts when you enter.</p>
            <button type="button" disabled={!ready} onClick={begin}>BEGIN EXPERIMENT</button>
          </div>
        ) : snapshot.phase === 'lost' ? (
          <div className="instructions" role="status">
            <p className="verdict">THE MACHINE WINS.</p>
            <p>{REASONS[snapshot.lossReason ?? 'blur']}</p>
            <button type="button" onClick={() => window.location.reload()}>TRY AGAIN</button>
          </div>
        ) : (<><p>Its objective is to make you leave.</p><p>For now, it can only ask.</p></>)}
      </div>
      <section className="counter" aria-label="Session progress">
        <span className="eyebrow">TIME REMAINED</span>
        <output className="time" aria-live="off">{formatElapsed(snapshot.elapsedMs)}</output>
        <div className="progressTrack" role="progressbar" aria-valuemin={0} aria-valuemax={upcoming?.target ?? 3600} aria-valuenow={Math.min(seconds, upcoming?.target ?? 3600)} aria-label="Progress toward next milestone">
          <div className="progressFill" style={{ width: `${upcoming ? Math.max(0, Math.min(100, ((seconds - upcoming.previous) / (upcoming.target - upcoming.previous)) * 100)) : 100}%` }} />
        </div>
        <p className="muted">{snapshot.phase === 'lost' ? 'Final survival time' : upcoming ? `Next milestone: ${formatElapsed(upcoming.target * 1000)} · ${milestoneCount} reached` : 'Every milestone reached. Still here.'}</p>
      </section>
      <footer className="footer">
        <p className="muted">A focus change ends the round. Browser-initiated interruptions may also trigger a loss. Results are local to this tab; no server-side tracking yet.</p>
        {snapshot.phase === 'playing' && <button type="button" onClick={concede}>I GIVE UP</button>}
      </footer>
    </main>
  );
}
