import { db } from '@/lib/db';
import { observatoryAuthorized } from '@/lib/observatory-auth';
import Unlock from './unlock';
import Analysis from './analysis';
import './observatory.css';

export const dynamic='force-dynamic';
export const runtime='nodejs';
function formatTime(v:unknown){return v ? new Date(String(v)).toLocaleString('en-US',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})+' UTC' : '—';}
function seconds(v:unknown){return v==null?'—':(Number(v)/1000).toFixed(1)+'s';}
export default async function Observatory(){
  if(!await observatoryAuthorized())return <Unlock/>;
  const sql=db();
  try{
    const [cohorts,sessions,arms,quality]=await Promise.all([
      sql`SELECT assignment,sessions,confirmed_losses,uncertain_sessions,active_sessions,sessions_with_baseline,mean_confirmed_loss_ms FROM pdnrh_cohort_evidence ORDER BY assignment`,
      sql`SELECT s.id::text AS id,s.assignment,s.tactic_family,s.tactic_policy,s.status,s.loss_reason,s.elapsed_ms,s.started_at,
        count(e.id)::int AS exposures,count(e.id) FILTER (WHERE e.ordinal=0)::int AS baselines,
        count(e.id) FILTER (WHERE e.ended_at IS NULL)::int AS open_exposures
        FROM sessions s LEFT JOIN exposures e ON e.session_id=s.id
        GROUP BY s.id ORDER BY s.started_at DESC LIMIT 50`,
      sql`SELECT t.strategy_family,t.strategy_version,count(e.id)::int AS exposures,count(DISTINCT e.session_id)::int AS sessions
        FROM tactics t LEFT JOIN exposures e ON e.tactic_id=t.id
        GROUP BY t.id ORDER BY sessions DESC,t.strategy_family LIMIT 30`,
      sql`SELECT count(*)::int AS total,
        count(*) FILTER(WHERE status='uncertain')::int AS uncertain,
        count(*) FILTER(WHERE status='active' AND last_seen_at<now()-interval '3 minutes')::int AS stale
        FROM sessions`
    ]);
    return <main className="obs"><header className="obs-head"><span className="obs-kicker">PDNRH / INTERNAL OBSERVATORY</span><a href="/">RETURN TO EXPERIMENT</a></header>
      <p className="obs-kicker">EXPERIMENT 001 / READ ONLY</p><h1>THE OBSERVATORY.</h1>
      <p className="obs-note">Experimental observations, not causal claims. Reported departures may reflect ordinary navigation, and outcomes are not independent when visitors repeat sessions.</p>
      <div className="obs-metrics"><div><strong>{quality[0]?.total??0}</strong><span>Total sessions</span></div><div><strong>{quality[0]?.uncertain??0}</strong><span>Uncertain outcomes</span></div><div><strong>{quality[0]?.stale??0}</strong><span>Stale active sessions</span></div></div>
      <section><h2>COHORTS</h2><div className="obs-table-wrap"><table><thead><tr><th>Assignment</th><th>Sessions</th><th>Confirmed losses</th><th>Uncertain</th><th>Active</th><th>Baseline logged</th><th>Mean observed survival</th></tr></thead><tbody>{cohorts.map(x=><tr key={String(x.assignment)}><td>{String(x.assignment)}</td><td>{String(x.sessions)}</td><td>{String(x.confirmed_losses)}</td><td>{String(x.uncertain_sessions)}</td><td>{String(x.active_sessions)}</td><td>{String(x.sessions_with_baseline)}</td><td>{seconds(x.mean_confirmed_loss_ms)}</td></tr>)}</tbody></table></div><p className="obs-note">Mean survival includes only confirmed losses. Censored and ongoing sessions are excluded, creating potential selection bias.</p></section>
      <Analysis/>
      <section><h2>TACTIC FAMILIES</h2><div className="obs-table-wrap"><table><thead><tr><th>Family</th><th>Version</th><th>Exposures</th><th>Sessions</th></tr></thead><tbody>{arms.map(x=><tr key={String(x.strategy_family)+'-'+String(x.strategy_version)}><td>{String(x.strategy_family)}</td><td>{String(x.strategy_version)}</td><td>{String(x.exposures)}</td><td>{String(x.sessions)}</td></tr>)}</tbody></table></div></section>
      <section><h2>RECENT SESSIONS</h2><div className="obs-table-wrap"><table><thead><tr><th>Started</th><th>ID</th><th>Assignment</th><th>Tactic</th><th>Policy</th><th>Status / Reason</th><th>Survival</th><th>Exposures</th><th>Baseline</th><th>Open</th></tr></thead><tbody>{sessions.map(x=><tr key={String(x.id)}><td>{formatTime(x.started_at)}</td><td><code>{String(x.id).slice(0,8)}</code></td><td>{String(x.assignment)}</td><td>{String(x.tactic_family??'—')}</td><td>{String(x.tactic_policy??'legacy')}</td><td>{String(x.status)} / {String(x.loss_reason??'—')}</td><td>{seconds(x.elapsed_ms)}</td><td>{String(x.exposures)}</td><td>{String(x.baselines)}</td><td>{String(x.open_exposures)}</td></tr>)}</tbody></table></div></section>
      <footer className="obs-note">Latest 50 sessions · Server-rendered snapshot · Refresh to update. No credentials or raw IP data are displayed.</footer>
    </main>;
  }catch{
    return <main className="obs"><p className="obs-kicker">PDNRH / OBSERVATORY</p><h1>DATA UNAVAILABLE.</h1><p>Database queries failed. Check the server logs and migrations.</p></main>;
  }
}
