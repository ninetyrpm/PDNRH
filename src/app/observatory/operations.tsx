import { db } from '@/lib/db';

const ARM_NAMES=['baseline_control','static_control','closure_frame','curiosity_reversal','absurdist_deflation'];
const TARGET=30;
function numeric(v:unknown){return Number(v??0);}
function fmt(n:number){return n.toLocaleString('en-US');}
export default async function Operations(){
 const sql=db();
 const [daily,assigned,integrity,versions]=await Promise.all([
   sql`SELECT date_trunc('day',started_at AT TIME ZONE 'UTC')::date::text AS day,
       count(*)::int AS sessions,
       count(*) FILTER(WHERE status='confirmed_loss')::int AS confirmed,
       count(*) FILTER(WHERE status='uncertain')::int AS uncertain
       FROM sessions WHERE started_at>=now()-interval '14 days'
       GROUP BY 1 ORDER BY 1 DESC`,
   sql`SELECT CASE WHEN assignment='adaptive' AND tactic_family IS NOT NULL THEN tactic_family ELSE assignment END AS arm,
     count(*)::int AS total,
     count(*) FILTER(WHERE status='confirmed_loss' AND elapsed_ms IS NOT NULL)::int AS completed,
     count(*) FILTER(WHERE status='uncertain')::int AS uncertain,
     count(*) FILTER(WHERE status='active')::int AS active
     FROM sessions GROUP BY 1`,
   sql`SELECT count(*) FILTER(WHERE s.status='confirmed_loss' AND (s.elapsed_ms IS NULL OR s.elapsed_ms<0))::int AS invalid_duration,
     count(*) FILTER(WHERE s.assignment='adaptive' AND s.tactic_family IS NULL)::int AS missing_tactic,
     count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM exposures e WHERE e.session_id=s.id AND e.ordinal=0))::int AS missing_baseline,
     count(*) FILTER(WHERE s.status<>'active' AND EXISTS(SELECT 1 FROM exposures e WHERE e.session_id=s.id AND e.ended_at IS NULL))::int AS open_terminal,
     count(*) FILTER(WHERE s.status='active' AND s.last_seen_at<now()-interval '3 minutes')::int AS stale
     FROM sessions s`,
   sql`SELECT tactic_policy,count(*)::int AS sessions,
       min(started_at) AS first_seen,max(started_at) AS last_seen
       FROM sessions GROUP BY tactic_policy ORDER BY last_seen DESC NULLS LAST`
 ]);
 const data=ARM_NAMES.map(name=>{const found=assigned.find(r=>String(r.arm)===name);return {name,total:numeric(found?.total),completed:numeric(found?.completed),uncertain:numeric(found?.uncertain),active:numeric(found?.active)};});
 const q=integrity[0]??{};
 const blockers=[
 {name:'Missing baseline exposure',value:numeric(q.missing_baseline),meaning:'Includes legacy sessions'},
 {name:'Terminal exposure still open',value:numeric(q.open_terminal),meaning:'Should be investigated'},
 {name:'Adaptive round without tactic',value:numeric(q.missing_tactic),meaning:'May predate assigned-family tracking'},
 {name:'Invalid confirmed duration',value:numeric(q.invalid_duration),meaning:'Cannot contribute to survival comparisons'},
 {name:'Stale active heartbeat',value:numeric(q.stale),meaning:'Requires outcome reconciliation'}
 ];
 const max=Math.max(1,...daily.map(r=>numeric(r.sessions)));
 return <section id="operations"><h2>PD09 / EXPERIMENT OPERATIONS</h2>
   <p className="obs-note">Read-only operating pulse. Daily counts use UTC calendar dates and include every recorded session, including legacy rounds. Collection thresholds reflect the PD05C selector gate, not statistical power.</p>
   <div className="obs-operations-grid">
     <div><h3>COLLECTION / CONFIRMED LOSSES</h3>{data.map(a=><div className="obs-progress" key={a.name}>
       <div><span>{a.name}</span><strong>{fmt(a.completed)} / {TARGET}</strong></div>
       <div className="obs-progress-track"><div style={{width:Math.min(100,a.completed/TARGET*100)+'%'}}/></div>
       <small>{fmt(a.total)} rounds · {fmt(a.uncertain)} uncertain · {fmt(a.active)} active</small>
     </div>)}
     <p className="obs-note">Static control is displayed for monitoring but is not part of the current selector threshold. Pre-PD05C baseline and tactic records may not form a comparable randomized cohort.</p></div>
     <div><h3>COLLECTION / LAST 14 DAYS</h3>{daily.length?daily.map(day=><div key={String(day.day)} className="obs-day">
       <span>{String(day.day)}</span><div className="obs-day-track"><div style={{width:(numeric(day.sessions)/max*100)+'%'}}/></div>
       <strong>{String(day.sessions)}</strong><small>{String(day.confirmed)} confirmed · {String(day.uncertain)} uncertain</small>
     </div>):<p className="obs-note">No sessions recorded in the last 14 days.</p>}</div>
   </div>
   <h3>INTEGRITY / ATTENTION REQUIRED</h3>
   <div className="obs-quality">{blockers.map(b=><div key={b.name}><strong>{b.value}</strong><span>{b.name}</span><small>{b.meaning}</small></div>)}</div>
   <h3>POLICY-VERSION INVENTORY</h3>
   <p className="obs-note">Each version is based on the policy label stored at session creation. Historical null labels are explicitly retained; governance revisions are embedded in newer adaptive policy labels.</p>
   <div className="obs-table-wrap"><table><thead><tr><th>Policy label</th><th>Rounds</th><th>First observed</th><th>Last observed</th></tr></thead><tbody>
     {versions.map(v=><tr key={String(v.tactic_policy??'legacy')}><td>{String(v.tactic_policy??'Legacy / unversioned')}</td><td>{String(v.sessions)}</td><td>{v.first_seen?new Date(String(v.first_seen)).toISOString().slice(0,16).replace('T',' ')+' UTC':'—'}</td><td>{v.last_seen?new Date(String(v.last_seen)).toISOString().slice(0,16).replace('T',' ')+' UTC':'—'}</td></tr>)}
   </tbody></table></div>
   <p className="obs-note">Readiness summary is intentionally advisory. No automatic launch, model switching, or governance transition happens here.</p>
 </section>;
}
