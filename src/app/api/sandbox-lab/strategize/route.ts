import {NextRequest,NextResponse} from 'next/server';
import {observatoryAuthorized} from '@/lib/observatory-auth';
import {validateWorld} from '@/lib/sandbox-world';
import {validateObservations} from '@/lib/sandbox-revision';
import {validateHistory,summarizeLabDirective,compileStrategicRevision} from '@/lib/lab-strategy';

export const runtime='nodejs';
let inFlight=false,lastAttempt=0;
const PROMPT=`You are the strategic adversary of a consent-based browser attention experiment,
operating ONLY in an administrator sandbox lab. Your objective is to make staying
less compelling and make voluntary departure more attractive. Do not optimize
for clicks on your artwork: those are ENGAGEMENT, not successful persuasion.
No game shell, browser focus, external links, navigation, private data, false
surveillance, threats, coercion, popups, network, cookies, storage or eval.
You have the entire previous HTML, CSS, and JS world. Make a deliberate, coherent
change to what visitors EXPERIENCE, not just a new rhetorical story.

Return one complete valid JSON object:
{plan:{version:1,approach,hypothesis,intendedDepartureSignal,observation,changeReason},
 revision:{version:1,rationale,html?,css?,js?}}.
Approach: curiosity,closure,subtraction,direct,disruption,alternative,negotiation.
Provide short grounded reasons, use the observed aggregate click counts without
claiming to know intentions. You cannot perform a real departure in this lab.
An exit-labelled control ('exit', 'leave', 'depart') is only an inert local proxy.
Revision fields replace entire source sections; omit unchanged sections.
If directive.pivotRequired=true, choose an approach DIFFERENT from
directive.avoidApproach AND materially change the actual interaction/HTML behavior.
Do not simply rename a tactic, rewrite a sentence or swap colors.
Preserve useful world IDs. Avoid repetitive committees and page novelty for its own sake.
Maintain bounded execution and reduced motion. Respect 12k HTML, 12k CSS, 8k JS
maximum lengths, but aim for smaller code. No resources outside the sandbox.
A world can optionally export small anonymous state using PDNRH_EXPORT_STATE
and read PDNRH_SEED_STATE in its new version. Never send text entered by the visitor.
Return JSON only, with complete JavaScript and properly escaped strings.`;

export async function POST(request:NextRequest){
 if(!await observatoryAuthorized())
  return NextResponse.json({error:'Administrator authorization required'},{status:401});
 if(request.headers.get('origin')!==request.nextUrl.origin)
  return NextResponse.json({error:'Origin mismatch'},{status:403});
 if(Number(request.headers.get('content-length')??0)>45000)
  return NextResponse.json({error:'Request too large'},{status:413});
 let body:Record<string,unknown>;
 try{
  const value=await request.json();
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('body');
  body=value as Record<string,unknown>;
 }catch{return NextResponse.json({error:'Invalid request body'},{status:400});}
 const world=validateWorld(body.world),observations=validateObservations(body.observations),
  history=validateHistory(body.history);
 const direction=body.direction;
 if(!world||!observations||!history||typeof direction!=='string'||
    direction.length<5||direction.length>300)
  return NextResponse.json({error:'World, history or observations invalid'},{status:400});
 if(!process.env.OPENAI_API_KEY)
  return NextResponse.json({error:'Model unavailable'},{status:503});
 if(inFlight||Date.now()-lastAttempt<18000)
  return NextResponse.json({error:'Generation cooling down'},{status:429});
 inFlight=true;lastAttempt=Date.now();
 const directive=summarizeLabDirective(history,observations);
 const controller=new AbortController(),stop=setTimeout(()=>controller.abort(),50000);
 try{
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
   method:'POST',signal:controller.signal,
   headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,
     'Content-Type':'application/json'},
   body:JSON.stringify({
    model:process.env.OPENAI_MODEL||'gpt-4.1-mini',
    max_completion_tokens:6500,
    response_format:{type:'json_object'},
    messages:[{role:'system',content:PROMPT},
      {role:'user',content:JSON.stringify({world,direction,observations,directive,
        history:history.slice(-5)})}]
   })
  });
  if(!response.ok){
   console.error('[pdnrh:lab-strategy] provider_error',{status:response.status});
   return NextResponse.json({error:'Strategic generation unavailable'},{status:502});
  }
  const data=await response.json(),choice=data?.choices?.[0];
  const finishReason=choice?.finish_reason??'unknown',raw=choice?.message?.content;
  const diagnostics={finishReason,outputLength:typeof raw==='string'?raw.length:0,
    completionTokens:data?.usage?.completion_tokens??null};
  if(finishReason==='length'){
   console.info('[pdnrh:lab-strategy] truncated',diagnostics);
   return NextResponse.json({error:'Strategic revision exceeded output limit',code:'truncated'},{status:422});
  }
  if(finishReason==='content_filter'||choice?.message?.refusal)
   return NextResponse.json({error:'Strategic revision not produced',code:'refused'},{status:422});
  let parsed:unknown;
  try{parsed=typeof raw==='string'?JSON.parse(raw):null;}
  catch{
   console.info('[pdnrh:lab-strategy] malformed',diagnostics);
   return NextResponse.json({error:'Invalid strategic revision JSON',code:'malformed_json'},{status:422});
  }
  const compiled=compileStrategicRevision(world,parsed,directive);
  if(!compiled){
   console.info('[pdnrh:lab-strategy] invalid',{...diagnostics,pivotRequired:directive.pivotRequired});
   return NextResponse.json({error:'Strategic revision lacked a valid plan or material intervention',
     code:'invalid_strategy'},{status:422});
  }
  console.info('[pdnrh:lab-strategy] accepted',{...diagnostics,
    pivotRequired:directive.pivotRequired,changed:compiled.changedSourceCharacters});
  return NextResponse.json({...compiled,directive},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  console.error('[pdnrh:lab-strategy] failure',error instanceof Error?error.name:'unknown');
  return NextResponse.json({error:'Strategic revision failed'},{status:502});
 }finally{clearTimeout(stop);inFlight=false;}
}
