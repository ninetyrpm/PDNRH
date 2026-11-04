import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {hashCredential} from '@/lib/experiment';
import {validateObservations} from '@/lib/sandbox-revision';
import {summarizeLabDirective,validateHistory,type LabStrategyEntry} from '@/lib/lab-strategy';
import {validateWorld} from '@/lib/sandbox-world';
import {generatePd13World} from '@/lib/pd13e-generation';
import {TACTIC_LIBRARY} from '@/lib/tactics';

export const runtime='nodejs';
export const maxDuration=60;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenRule=/^[a-zA-Z0-9_-]{43}$/;
const noCache={'Cache-Control':'no-store'};

export async function POST(request:NextRequest){
 const origin=request.headers.get('origin');
 if(origin&&origin!==request.nextUrl.origin)
  return NextResponse.json({error:'Invalid origin'},{status:403});
 const id=request.headers.get('x-session-id')??'';
 const credential=request.headers.get('authorization')?.replace(/^Bearer /i,'')??'';
 if(!uuid.test(id)||!tokenRule.test(credential))
  return NextResponse.json({error:'Unauthorized'},{status:401});
 if(Number(request.headers.get('content-length')??0)>3500)
  return NextResponse.json({error:'Payload too large'},{status:413});
 let body:Record<string,unknown>;
 try{
  const received=await request.json();
  if(!received||typeof received!=='object'||Array.isArray(received))throw Error('body');
  body=received as Record<string,unknown>;
 }catch{return NextResponse.json({error:'Invalid request'},{status:400});}
 const ordinal=body.ordinal,observations=validateObservations(body.observations);
 if(typeof ordinal!=='number'||!Number.isInteger(ordinal)||ordinal<1||ordinal>100||
    !observations)return NextResponse.json({error:'Invalid revision request'},{status:400});
 const sql=db();
 let tacticInstruction='',previousWorld:null|NonNullable<ReturnType<typeof validateWorld>>=null;
 let history:LabStrategyEntry[]=[];
 try{
  const rows=await sql`SELECT assignment,status,engine_version,tactic_family
   FROM sessions WHERE id=${id} AND credential_hash=${hashCredential(credential)}`;
  if(!rows.length)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(rows[0].engine_version!=='pd13e-v1'||rows[0].assignment!=='adaptive')
   return NextResponse.json({error:'Engine mismatch'},{status:403});
  if(rows[0].status!=='active')return NextResponse.json({error:'Session ended'},{status:409});
  const existing=await sql`SELECT ordinal,world,plan,observations FROM pd13_world_exposures
   WHERE session_id=${id} ORDER BY ordinal DESC LIMIT 8`;
  const ascending=existing.slice().reverse();
  if(ascending.some(r=>Number(r.ordinal)===ordinal)){
   const match=ascending.find(r=>Number(r.ordinal)===ordinal)!;
   return NextResponse.json({world:match.world,plan:match.plan,ordinal,source:'model',
    cached:true,nextDelaySeconds:45},{headers:noCache});
  }
  const last=ascending.at(-1);
  if(ordinal!==(last?Number(last.ordinal)+1:1))
   return NextResponse.json({error:'Revision out of sequence'},{status:409});
  previousWorld=last?validateWorld(last.world):null;
  if(last&&!previousWorld)
   return NextResponse.json({error:'Previous world unavailable'},{status:503});
  history=ascending.filter(r=>r.plan).map(r=>{
   const plan=r.plan;
   const observed=validateObservations(r.observations);
   if(!observed)return null;
   const directive=summarizeLabDirective([],observed);
   return {plan,exitProxyCount:directive.exitProxies,
    engagementCount:directive.engagementClicks,changedSourceCharacters:0};
  }).filter(Boolean) as LabStrategyEntry[];
  if(!validateHistory(history))history=[];
  const tactic=TACTIC_LIBRARY.find(t=>t.family===rows[0].tactic_family);
  tacticInstruction=tactic?.instruction??'Encourage voluntary departure without coercion.';
 }catch(error){
  console.error('[pdnrh:pd13e] context_unavailable',error instanceof Error?error.name:'unknown');
  return NextResponse.json({error:'World history unavailable'},{status:503});
 }
 if(!process.env.OPENAI_API_KEY)
  return NextResponse.json({error:'Model unavailable'},{status:503});
 const directive=previousWorld?summarizeLabDirective(history,observations):null;
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),48000);
 try{
  const result=await generatePd13World({
   previous:previousWorld,observations,directive,history,tactic:tacticInstruction
  },controller.signal);
  if(!result.ok){
   console.error('[pdnrh:pd13e] generation_rejected',{ordinal,reason:result.reason});
   return NextResponse.json({error:'World generation failed',code:result.reason},{status:422});
  }
  // Never accept a newly generated artifact after the game has ended.
  const current=await sql`SELECT status FROM sessions WHERE id=${id} AND
     credential_hash=${hashCredential(credential)} AND engine_version='pd13e-v1'`;
  if(!current.length||current[0].status!=='active')
   return NextResponse.json({error:'Session ended'},{status:409});
  const persisted=await sql`INSERT INTO pd13_world_exposures
    (session_id,ordinal,world,plan,observations)
    SELECT ${id},${ordinal},${JSON.stringify(result.world)}::jsonb,
      ${JSON.stringify(result.plan??null)}::jsonb,
      ${JSON.stringify(observations)}::jsonb
    FROM sessions s WHERE s.id=${id} AND s.status='active'
      AND s.engine_version='pd13e-v1'
    ON CONFLICT (session_id,ordinal) DO NOTHING
    RETURNING ordinal`;
  if(!persisted.length){
   const duplicate=await sql`SELECT ordinal,world,plan FROM pd13_world_exposures
     WHERE session_id=${id} AND ordinal=${ordinal}`;
   if(!duplicate.length)return NextResponse.json({error:'Session no longer active'},{status:409});
   return NextResponse.json({...duplicate[0],source:'model',cached:true,
     nextDelaySeconds:45},{headers:noCache});
  }
  console.info('[pdnrh:pd13e] world_recorded',{
   ordinal,changedSourceCharacters:result.changed,approach:result.plan?.approach??'initial'
  });
  return NextResponse.json({world:result.world,plan:result.plan??null,
    ordinal,source:'model',nextDelaySeconds:45},{headers:noCache});
 }catch(error){
  console.error('[pdnrh:pd13e] generation_exception',
    error instanceof Error?error.name:'unknown');
  return NextResponse.json({error:'World generation unavailable'},{status:502});
 }finally{clearTimeout(timeout);}
}
