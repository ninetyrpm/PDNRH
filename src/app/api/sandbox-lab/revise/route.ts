import {NextRequest,NextResponse} from 'next/server';
import {observatoryAuthorized} from '@/lib/observatory-auth';
import {validateWorld} from '@/lib/sandbox-world';
import {applyWorldRevision,validateObservations} from '@/lib/sandbox-revision';

export const runtime='nodejs';
let inFlight=false,lastAttempt=0;
const PROMPT=`You are revising an interactive HTML/CSS/JavaScript world in an administrator-only
sandbox laboratory. You receive its existing source code and measured on-frame click
counts, plus a creative direction. Improve its coherent interaction logic without
gratuitously replacing everything. Return ONLY one JSON object:
{version:1,rationale:"why this specific change is useful",html?:string,css?:string,js?:string}.
Include ONLY changed code fields. Each supplied field REPLACES the ENTIRE previous
field; omit unchanged fields. At least one field must change. Preserve existing
HTML IDs and key state where possible. You may use procedural Canvas and SVG.
No external assets, network, fetch, storage, navigation, popups, forms, iframe,
eval, imports or browser-origin manipulation. No fabricated surveillance.
Keep code complete, runnable and bounded. Write valid JSON and escape code strings.
If the supplied observations show repeated clicks without progress, respond with a
meaningfully revised local interaction rather than merely different copy.
Existing state may be exposed via window.PDNRH_EXPORT_STATE=function(){return JSON-safe
state}; and reintroduced from window.PDNRH_SEED_STATE. Both are optional, and snapshots
must be small and anonymous. Never make claims about what the visitor thinks.`;

export async function POST(request:NextRequest){
 if(!await observatoryAuthorized())
  return NextResponse.json({error:'Administrator authorization required'},{status:401});
 if(request.headers.get('origin')!==request.nextUrl.origin)
  return NextResponse.json({error:'Origin mismatch'},{status:403});
 if(Number(request.headers.get('content-length')??0)>40000)
  return NextResponse.json({error:'Request too large'},{status:413});
 let body:Record<string,unknown>;
 try{
  const value=await request.json();
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Body');
  body=value as Record<string,unknown>;
 }catch{return NextResponse.json({error:'Invalid request body'},{status:400});}
 const previous=validateWorld(body.world),observations=validateObservations(body.observations);
 const direction=body.direction;
 if(!previous||!observations||typeof direction!=='string'||
   direction.trim().length<5||direction.length>300)
  return NextResponse.json({error:'World, observations or direction invalid'},{status:400});
 if(!process.env.OPENAI_API_KEY)
  return NextResponse.json({error:'Model unavailable'},{status:503});
 if(inFlight||Date.now()-lastAttempt<18000)
  return NextResponse.json({error:'Generation cooling down'},{status:429});
 inFlight=true;lastAttempt=Date.now();
 const controller=new AbortController();
 const stop=setTimeout(()=>controller.abort(),50000);
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
      {role:'user',content:JSON.stringify({world:previous,observations,direction})}]
   })
  });
  if(!response.ok){
   console.error('[pdnrh:revision] provider_error',{status:response.status});
   return NextResponse.json({error:'Model revision unavailable'},{status:502});
  }
  const payload=await response.json();
  const choice=payload?.choices?.[0],finish=choice?.finish_reason??'unknown';
  const raw=choice?.message?.content;
  const diagnostic={finishReason:finish,outputLength:typeof raw==='string'?raw.length:0,
    completionTokens:payload?.usage?.completion_tokens??null};
  if(finish==='length'){
   console.info('[pdnrh:revision] truncated',diagnostic);
   return NextResponse.json({error:'Revision exceeded its response budget',code:'truncated'},{status:422});
  }
  if(finish==='content_filter'||choice?.message?.refusal){
   console.info('[pdnrh:revision] refused',diagnostic);
   return NextResponse.json({error:'Revision not produced',code:'refused'},{status:422});
  }
  let parsed:unknown;
  try{parsed=typeof raw==='string'?JSON.parse(raw):null;}
  catch{
   console.info('[pdnrh:revision] malformed',diagnostic);
   return NextResponse.json({error:'Model returned invalid revision JSON',code:'malformed_json'},{status:422});
  }
  const result=applyWorldRevision(previous,parsed);
  if(!result){
   console.info('[pdnrh:revision] invalid',diagnostic);
   return NextResponse.json({error:'Revision failed validation or made no changes',code:'invalid_revision'},{status:422});
  }
  console.info('[pdnrh:revision] accepted',{...diagnostic,
    changedFields:Object.keys(result.revision).filter(key=>['html','css','js'].includes(key))});
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  console.error('[pdnrh:revision] failed',error instanceof Error?error.name:'unknown');
  return NextResponse.json({error:'Revision request failed'},{status:502});
 }finally{clearTimeout(stop);inFlight=false;}
}
