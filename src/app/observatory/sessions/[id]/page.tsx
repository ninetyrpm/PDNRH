import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { observatoryAuthorized } from '@/lib/observatory-auth';
import Unlock from '../../unlock';
import '../../observatory.css';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function stamp(v:unknown){return v?new Date(String(v)).toISOString().replace('T',' ').slice(0,23)+' UTC':'—';}
function text(v:unknown){return v==null?'—':String(v);}
function secs(v:unknown){return v==null?'—':(Number(v)/1000).toFixed(1)+'s';}
type Mutation={headline?:unknown;message?:unknown;aside?:unknown;tone?:unknown;layout?:unknown;surface?:unknown;actionLabel?:unknown;strategy?:unknown};
export default async function SessionInspector({params}:{params:Promise<{id:string}>}){
  if(!await observatoryAuthorized())return <Unlock/>;
  const {id}=await params;
  if(!uuid.test(id))notFound();
  const sql=db();
  const [sessions,exposures,events,outcomes]=await Promise.all([
    sql`SELECT id::text,assignment,tactic_family,tactic_policy,status,loss_reason,elapsed_ms,started_at,ended_at,last_seen_at FROM sessions WHERE id=${id}`,
    sql`SELECT e.ordinal,e.source,e.displayed_at,e.ended_at,e.mutation,t.strategy_family,t.strategy_version
      FROM exposures e LEFT JOIN tactics t ON t.id=e.tactic_id
      WHERE e.session_id=${id} ORDER BY e.ordinal LIMIT 1000`,
    sql`SELECT event_key,type,occurred_at,payload FROM events WHERE session_id=${id} ORDER BY occurred_at,event_key LIMIT 1000`,
    sql`SELECT classification,observed_reason,evidence FROM outcomes WHERE session_id=${id} LIMIT 1`
  ]);
  if(!sessions.length)notFound();
  const s=sessions[0];
  return <main className="obs"><header className="obs-head"><span className="obs-kicker">PDNRH / SESSION INSPECTOR</span><a href="/observatory">BACK TO OBSERVATORY</a></header>
    <p className="obs-kicker">EXP 001 / READ ONLY</p><h1>SESSION.</h1><p className="obs-session-id">{id}</p>
    <div className="obs-detail-summary">
      <div><span>ASSIGNMENT</span><strong>{text(s.assignment)}</strong></div><div><span>TACTIC / POLICY</span><strong>{text(s.tactic_family)} / {text(s.tactic_policy)}</strong></div>
      <div><span>STATUS</span><strong>{text(s.status)} / {text(s.loss_reason)}</strong></div><div><span>SURVIVAL</span><strong>{secs(s.elapsed_ms)}</strong></div>
      <div><span>STARTED</span><strong>{stamp(s.started_at)}</strong></div><div><span>ENDED</span><strong>{stamp(s.ended_at)}</strong></div>
    </div>
    <section><h2>EXPOSURE TIMELINE / {exposures.length} RECORDS</h2>
      <p className="obs-note">Times are server-observed; they are not precise proof of when pixels appeared in the browser. Each card contains the exact recorded mutation payload.</p>
      {exposures.map(e=>{const m=(e.mutation??{}) as Mutation;const duration=e.ended_at&&e.displayed_at?Math.max(0,(new Date(String(e.ended_at)).getTime()-new Date(String(e.displayed_at)).getTime())/1000).toFixed(1)+'s':'OPEN';
        return <article className="obs-exposure" key={String(e.ordinal)}><div className="obs-exposure-meta"><strong>#{text(e.ordinal)} / {text(e.source)}</strong><span>{text(e.strategy_family)} v{text(e.strategy_version)}</span><span>{duration}</span></div>
          <p className="obs-note">{stamp(e.displayed_at)} → {stamp(e.ended_at)}</p>
          <h3>{text(m.headline)}</h3><p>{text(m.message)}</p><p className="obs-aside">{text(m.aside)}</p>
          <div className="obs-tags"><span>TONE {text(m.tone)}</span><span>LAYOUT {text(m.layout)}</span><span>SURFACE {text(m.surface)}</span><span>STRATEGY {text(m.strategy)}</span><span>BUTTON {text(m.actionLabel)}</span></div>
        </article>;})}
      {!exposures.length&&<p className="obs-note">No exposures were recorded.</p>}
    </section>
    <section><h2>ACTIVITY & HEARTBEATS / {events.length} EVENTS</h2><div className="obs-table-wrap"><table><thead><tr><th>Time</th><th>Type</th><th>Key</th><th>Elapsed</th><th>Clicks</th><th>Scrolls</th><th>Idle</th><th>Reported reason</th></tr></thead><tbody>{events.map(e=>{const p=(e.payload??{}) as Record<string,unknown>;return <tr key={text(e.event_key)}><td>{stamp(e.occurred_at)}</td><td>{text(e.type)}</td><td><code>{text(e.event_key)}</code></td><td>{secs(p.elapsedMs)}</td><td>{text(p.clicks)}</td><td>{text(p.scrolls)}</td><td>{secs(p.idleMs)}</td><td>{text(p.reason)}</td></tr>;})}</tbody></table></div>
    <p className="obs-note">Activity metrics are aggregate client-reported snapshots; no mouse paths or raw keystrokes are stored. Only the first 1,000 events are shown.</p></section>
    <section><h2>RECORDED OUTCOME</h2>{outcomes.length?<div className="obs-exposure"><strong>{text(outcomes[0].classification)}</strong><p>Observed reason: {text(outcomes[0].observed_reason)}</p><pre className="obs-evidence">{JSON.stringify(outcomes[0].evidence??{},null,2)}</pre></div>:<p className="obs-note">No terminal outcome has been recorded.</p>}</section>
    <footer className="obs-note">Restricted access · Read-only inspection · Historical missing observations are not reconstructed.</footer>
  </main>;
}
