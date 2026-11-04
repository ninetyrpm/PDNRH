import {observatoryAuthorized} from '@/lib/observatory-auth';
import {db} from '@/lib/db';
import Unlock from '../../unlock';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Exposure={ordinal:number;world:unknown;plan:unknown;observations:unknown;created_at:unknown};
export default async function AuthoredWorldAudit({params}:{params:Promise<{id:string}>}){
 if(!await observatoryAuthorized())return <Unlock/>;
 const {id}=await params;
 if(!uuid.test(id))return <main className="obs"><p>Invalid session ID.</p></main>;
 let rows:Exposure[]=[],sessionStatus='';
 try{
  const sql=db();
  const [sessions,worlds]=await Promise.all([
   sql`SELECT status,engine_version,started_at FROM sessions WHERE id=${id}`,
   sql`SELECT ordinal,world,plan,observations,created_at
     FROM pd13_world_exposures WHERE session_id=${id} ORDER BY ordinal`
  ]);
  if(!sessions.length)return <main className="obs"><p>Session not found.</p></main>;
  sessionStatus=String(sessions[0].status)+' · '+String(sessions[0].engine_version);
  rows=worlds as Exposure[];
 }catch{
  return <main className="obs"><p>World audit data unavailable.</p></main>;
 }
 return <main className="obs">
  <header className="obs-head"><span className="obs-kicker">PD13E / AUTHORED WORLD AUDIT</span>
   <a href="/observatory">RETURN TO OBSERVATORY</a></header>
  <h1>WORLD HISTORY.</h1>
  <p className="obs-note">Session {id} · {sessionStatus} · {rows.length} recorded worlds</p>
  <p className="obs-note">Read-only source inspection. Stored executable code is never run in this page.
    Observed interactions are not evidence of successful persuasion.</p>
  {rows.map(row=>{
   const world=row.world&&typeof row.world==='object'?row.world as Record<string,unknown>:{};
   const plan=row.plan&&typeof row.plan==='object'?row.plan as Record<string,unknown>:{};
   return <section key={row.ordinal} style={{margin:'38px 0',borderTop:'1px solid #555',paddingTop:18}}>
    <h2>WORLD {row.ordinal}</h2>
    <p className="obs-note">Recorded: {new Date(String(row.created_at)).toISOString()}
      {typeof plan.approach==='string'?' · Approach: '+plan.approach:' · Initial generation'}</p>
    {typeof plan.hypothesis==='string'&&<p>Hypothesis: {plan.hypothesis}</p>}
    {typeof plan.observation==='string'&&<p>Observation: {plan.observation}</p>}
    {typeof plan.changeReason==='string'&&<p>Intervention: {plan.changeReason}</p>}
    <details><summary>Measured observations</summary>
     <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(row.observations,null,2)}</pre>
    </details>
    {(['html','css','js'] as const).map(key=><details key={key}>
     <summary>{key.toUpperCase()} ({typeof world[key]==='string'?world[key].length:0} chars)</summary>
     <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:380,overflow:'auto'}}>
      {typeof world[key]==='string'?world[key]:'Not recorded'}
     </pre></details>)}
   </section>;
  })}
 </main>;
}
