import { db } from '@/lib/db';

function pct(n:number,d:number){return d ? (100*n/d).toFixed(0)+'%' : '—';}
function secs(ms:unknown){return ms==null?'—':(Number(ms)/1000).toFixed(1)+'s';}
const BUCKETS=['< 15s','15–30s','30–60s','1–2m','2–5m','5–10m','10m+'];
export default async function Analysis(){
  const sql=db();
  const [distribution,comparisons,issues]=await Promise.all([
    sql`SELECT assignment,
      CASE WHEN elapsed_ms<15000 THEN 0 WHEN elapsed_ms<30000 THEN 1
      WHEN elapsed_ms<60000 THEN 2 WHEN elapsed_ms<120000 THEN 3
      WHEN elapsed_ms<300000 THEN 4 WHEN elapsed_ms<600000 THEN 5 ELSE 6 END AS bucket,
      count(*)::int AS n FROM sessions
      WHERE status='confirmed_loss' AND elapsed_ms IS NOT NULL
      GROUP BY 1,2 ORDER BY 1,2`,
    sql`SELECT tactic_family,
      count(*)::int AS sessions,
      count(*) FILTER(WHERE status='confirmed_loss')::int AS completed,
      count(*) FILTER(WHERE status='uncertain')::int AS uncertain,
      count(*) FILTER(WHERE status='active')::int AS active,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY elapsed_ms)
        FILTER(WHERE status='confirmed_loss' AND elapsed_ms IS NOT NULL) AS median_ms,
      avg(elapsed_ms) FILTER(WHERE status='confirmed_loss' AND elapsed_ms IS NOT NULL)::float8 AS mean_ms
      FROM sessions WHERE assignment='adaptive' AND tactic_family IS NOT NULL
      GROUP BY tactic_family ORDER BY tactic_family`,
    sql`SELECT
      count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM exposures e WHERE e.session_id=s.id AND e.ordinal=0))::int AS missing_baseline,
      count(*) FILTER(WHERE s.status<>'active' AND EXISTS(SELECT 1 FROM exposures e WHERE e.session_id=s.id AND e.ended_at IS NULL))::int AS terminal_open,
      count(*) FILTER(WHERE s.assignment='adaptive' AND s.tactic_family IS NULL)::int AS unassigned_adaptive,
      count(*) FILTER(WHERE s.status='active' AND s.last_seen_at<now()-interval '3 minutes')::int AS stale_active,
      count(*) FILTER(WHERE s.status='uncertain')::int AS uncertain,
      count(*)::int AS total
      FROM sessions s`
  ]);
  const cohorts=[...new Set(distribution.map(r=>String(r.assignment)))];
  const counts=cohorts.map(name=>({
    name,values:BUCKETS.map((_,i)=>Number(distribution.find(r=>r.assignment===name && Number(r.bucket)===i)?.n??0))
  }));
  const max=Math.max(1,...counts.flatMap(c=>c.values));
  const q=issues[0]??{};
  const flags=[
    {label:'Sessions missing baseline',count:Number(q.missing_baseline??0),detail:'Includes historical records predating PD04D'},
    {label:'Completed sessions with open exposures',count:Number(q.terminal_open??0),detail:'Exposure windows should close on terminal outcome'},
    {label:'Adaptive sessions lacking assigned tactic',count:Number(q.unassigned_adaptive??0),detail:'Includes rounds created before PD05C'},
    {label:'Active sessions beyond heartbeat threshold',count:Number(q.stale_active??0),detail:'Check manual reconciliation before interpreting'},
    {label:'Uncertain outcomes',count:Number(q.uncertain??0),detail:'Not counted as confirmed defeats'}
  ];
  return <>
    <section><h2>SURVIVAL DISTRIBUTION</h2>
      <p className="obs-note">Confirmed-loss sessions by survival-time band. Each bar is an observed count, not a survival probability; uncertain and active sessions are excluded.</p>
      <div className="obs-distribution">
        {BUCKETS.map((bucket,i)=><div className="obs-band" key={bucket}><span>{bucket}</span><div className="obs-bars">
          {counts.map(c=><div className="obs-bar-row" key={c.name}><span title={c.name}>{c.name}</span><div className="obs-bar-track"><div className="obs-bar" style={{width:(c.values[i]/max*100)+'%'}}/></div><strong>{c.values[i]}</strong></div>)}
        </div></div>)}
      </div><p className="obs-note">Bar scales share a common maximum across all cohorts and bands.</p>
    </section>
    <section><h2>ASSIGNED TACTIC COMPARISON</h2>
      <p className="obs-note">Session-level treatment assignment. Includes only sessions with stored PD05C tactic families; older exploratory rounds remain separate. Means and medians are conditional on a confirmed loss and are not causal estimates.</p>
      <div className="obs-table-wrap"><table><thead><tr><th>Assigned tactic</th><th>Sessions</th><th>Confirmed</th><th>Uncertain</th><th>Active</th><th>Mean survival</th><th>Median survival</th><th>Minimum sample progress</th></tr></thead><tbody>
        {comparisons.map(t=><tr key={String(t.tactic_family)}><td>{String(t.tactic_family)}</td><td>{String(t.sessions)}</td><td>{String(t.completed)}</td><td>{String(t.uncertain)}</td><td>{String(t.active)}</td><td>{secs(t.mean_ms)}</td><td>{secs(t.median_ms)}</td><td>{pct(Number(t.completed),30)} of 30</td></tr>)}
      </tbody></table></div>
    </section>
    <section><h2>DATA QUALITY</h2><div className="obs-quality">{flags.map(f=><div key={f.label}><strong>{f.count}</strong><span>{f.label}</span><small>{f.detail}</small></div>)}</div>
      <p className="obs-note">Quality counts cover all {String(q.total??0)} sessions, including legacy experiments. A nonzero count does not necessarily imply a current defect.</p>
    </section>
  </>;
}
