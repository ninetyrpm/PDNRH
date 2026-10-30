'use client';

import { useEffect, useRef, useState } from 'react';
import { createSession, formatElapsed, nextMilestone, type SessionSnapshot } from '@/lib/session';

const THRESHOLDS = [60, 180, 600, 1800, 3600];
const INITIAL: SessionSnapshot = { id: '', elapsedMs: 0, clicks: 0, scrolls: 0, idleMs: 0, completed: false, concession: false };

export default function Home() {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(INITIAL);
  const [ready, setReady] = useState(false);
  const sessionRef = useRef<ReturnType<typeof createSession> | null>(null);

  useEffect(() => {
    const session = createSession();
    sessionRef.current = session;
    setSnapshot(session.snapshot());
    setReady(true);
    const onClick = () => { session.record('click'); setSnapshot(session.snapshot()); };
    const onScroll = () => { session.record('scroll'); setSnapshot(session.snapshot()); };
    const onActivity = () => session.record('activity');
    const onVisibility = () => { session.setVisible(!document.hidden); setSnapshot(session.snapshot()); };
    const onPageHide = () => { session.setVisible(false); };
    const interval = window.setInterval(() => setSnapshot(session.snapshot()), 250);
    document.addEventListener('click', onClick);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('pointermove', onActivity, { passive: true });
    document.addEventListener('keydown', onActivity);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('click', onClick);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('pointermove', onActivity);
      document.removeEventListener('keydown', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      sessionRef.current = null;
    };
  }, []);

  const seconds = Math.floor(snapshot.elapsedMs / 1000);
  const upcoming = nextMilestone(seconds, THRESHOLDS);
  const milestoneCount = THRESHOLDS.filter(t => t <= seconds).length;
  const concede = () => { sessionRef.current?.concede(); setSnapshot(sessionRef.current?.snapshot() ?? INITIAL); };

  return (
    <main className="shell">
      <div className="topline">
        <span className="eyebrow">PDNRH / EXPERIMENT 001</span>
        <span className="eyebrow">SESSION {ready ? snapshot.id.slice(0, 8).toUpperCase() : '--------'}</span>
      </div>
      <div className="primary">
        <p className="eyebrow">YOUR OBJECTIVE: REMAIN HERE.</p>
        <h1>PLEASE DO NOT<br />REMAIN HERE.</h1>
        <p>Its objective is to make you leave.</p>
        <p>For now, it can only ask.</p>
      </div>
      <section className="counter" aria-label="Session progress">
        <span className="eyebrow">TIME REMAINED</span>
        <output className="time" aria-live="off">{formatElapsed(snapshot.elapsedMs)}</output>
        <div className="progressTrack" role="progressbar" aria-valuemin={0} aria-valuemax={upcoming?.target ?? 3600} aria-valuenow={Math.min(seconds, upcoming?.target ?? 3600)} aria-label="Progress toward next milestone">
          <div className="progressFill" style={{ width: `${upcoming ? Math.max(0, Math.min(100, ((seconds - upcoming.previous) / (upcoming.target - upcoming.previous)) * 100)) : 100}%` }} />
        </div>
        <p className="muted">{snapshot.concession ? 'You conceded. The experiment is over.' : upcoming ? `Next milestone: ${formatElapsed(upcoming.target * 1000)} · ${milestoneCount} reached` : 'Every milestone reached. Still here.'}</p>
      </section>
      <footer className="footer">
        <p className="muted">No account. No leaderboard. No server-side tracking yet. Time counts only while this tab is visible.</p>
        <button type="button" disabled={!ready || snapshot.completed} onClick={concede}>{snapshot.concession ? 'YOU LEFT THE GAME' : 'I GIVE UP'}</button>
      </footer>
    </main>
  );
}
