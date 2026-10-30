import { db } from '@/lib/db';

const MIN=30;
const ARMS=['closure_frame','curiosity_reversal','absurdist_deflation'];
const WINDOW_MS=120000;
function label(value:number,target:number){return value>=target?'Threshold met':'Collecting evidence';}
export default async function Evaluation(){
  const sql=db();
  const [cohorts,arms,quality]=await Promise.all([
    sql`SELECT assignment,COUNT(*)::int AS n,
      COUNT(*) FILTER (WHERE status='confirmed_loss')::int AS confirmed,
      COUNT(*) FILTER (WHERE status='uncertain')::int AS uncertain,
      COUNT(*) FILTER (WHERE status='active')::int AS active,
      COUNT(*) FILTER (WHERE status='confirmed_loss' AND elapsed_ms<=120000)::int AS events_2m,
      COUNT(*) FILTER (WHERE status='confirmed_loss' AND elapsed_ms>120000)::int AS known_survivors_2m
      FROM sessions GROUP BY assignment ORDER BY assignment`,
    sql`SELECT tactic_family,COUNT(*)::int AS n,
      COUNT(*) FILTER (WHERE status='confirmed_loss')::int AS confirmed,
      COUNT(*) FILTER (WHERE status='uncertain')::int AS uncertain,
      COUNT(*) FILTER (WHERE status='active')::int AS active,
      COUNT(*) FILTER (WHERE status='confirmed_loss' AND elapsed_ms<=120000)::int AS events_2m,
      COUNT(*) FILTER (WHERE status='confirmed_loss' AND elapsed_ms>120000)::int AS known_survivors_2m
      FROM sessions WHERE assignment='adaptive' AND tactic_family IS NOT NULL
      GROUP BY tactic_family`,
    sql`SELECT COUNT(*) FILTER(WHERE s.tactic_policy='bounded-v1')::int AS selected,
      COUNT(*) FILTER(WHERE s.tactic_policy IS NULL)::int AS legacy,
      COUNT(*) FILTER(WHERE s.status='uncertain')::int AS uncertain,
      COUNT(*) FILTER(WHERE s.status='active')::int AS active,
      COUNT(*) FILTER(WHERE s.status='confirmed_loss' AND (s.elapsed_ms IS NULL OR s.elapsed_ms<0))::int AS invalid_times,
      COUNT(*) FILTER(WHERE s.started_at IS NOT NULL AND s.status='confirmed_loss' AND NOT EXISTS(SELECT 1 FROM exposures e WHERE e.session_id=s.id AND e.ordinal=0))::int AS missing_baseline
      FROM sessions s`
  ]);
  const control=cohorts.find(r=>r.assignment==='baseline_control');
  const controlN=Number(control?.confirmed??0);
  const readiness=ARMS.map(f=>({name:f,confirmed:Number(arms.find(x=>x.tactic_family===f)?.confirmed??0)}));
  const enough=controlN>=MIN&&readiness.every(a=>a.confirmed>=MIN);
  const q=quality[0]??{};
  const uncertain=Number(q.uncertain??0),active=Number(q.active??0),legacy=Number(q.legacy??0);
  return <section><h2>PD07 / EVALUATION READINESS</h2>
    <p className="obs-note">Predeclared descriptive endpoint: client-reported loss within 120 seconds. Counts are grouped by original session assignment, not by the model's self-described strategy. An uncertain or active round is <em>not</em> a known survivor.</p>
    <div className="obs-quality">
      <div><strong>{enough?'MET':'NOT MET'}</strong><span>PD05C sample gate</span><small>At least 30 confirmed losses in baseline and in each assigned tactic family. This is a selector eligibility rule, not statistical significance.</small></div>
      <div><strong>{uncertain+active}</strong><span>Not fully observed</span><small>{uncertain} uncertain; {active} active. Must be handled as censored or unresolved, never counted as successes.</small></div>
      <div><strong>{legacy}</strong><span>Legacy sessions</span><small>Created without a recorded tactic selection policy; exclude from tactic-level randomized comparisons.</small></div>
      <div><strong>{String(q.selected??0)}</strong><span>Preference-policy sessions</span><small>Once selection preferences activate, estimates must account for changing assignment probabilities.</small></div>
    </div>
    <div className="obs-table-wrap"><table><thead><tr><th>Experimental arm</th><th>Sessions</th><th>Confirmed</th><th>Uncertain</th><th>Active</th><th>Reported loss ≤2m</th><th>Known survival beyond 2m</th><th>Selector gate</th></tr></thead><tbody>
      {cohorts.map(r=><tr key={String(r.assignment)}><td>{String(r.assignment)}</td><td>{String(r.n)}</td><td>{String(r.confirmed)}</td><td>{String(r.uncertain)}</td><td>{String(r.active)}</td><td>{String(r.events_2m)}</td><td>{String(r.known_survivors_2m)}</td><td>{r.assignment==='baseline_control'?label(Number(r.confirmed),MIN):'Separate cohort'}</td></tr>)}
      {ARMS.map(f=>{const a=arms.find(x=>x.tactic_family===f);return <tr key={f}><td>↳ {f}</td><td>{String(a?.n??0)}</td><td>{String(a?.confirmed??0)}</td><td>{String(a?.uncertain??0)}</td><td>{String(a?.active??0)}</td><td>{String(a?.events_2m??0)}</td><td>{String(a?.known_survivors_2m??0)}</td><td>{label(Number(a?.confirmed??0),MIN)}</td></tr>;})}
    </tbody></table></div>
    <p className="obs-note">Analysis limitations: outcomes depend on client-reported focus loss; repeated visitors are not identified for clustered inference; administrative censoring and unknown departures cannot be treated as independent; the first five minutes of exposure do not guarantee identical stimuli. Descriptive counts do not establish treatment superiority. Formal inference requires a prespecified estimand, fixed observation horizon, independent-unit assumptions, and a plan for missing outcomes.</p>
  </section>;
}
