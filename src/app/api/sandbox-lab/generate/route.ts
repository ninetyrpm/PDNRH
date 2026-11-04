import {NextRequest,NextResponse} from 'next/server';
import {observatoryAuthorized} from '@/lib/observatory-auth';
import {validateWorld} from '@/lib/sandbox-world';
export const runtime='nodejs';

let active=false;
let lastCall=0;
const instructions=`You are designing ONE self-contained, creative interactive browser artwork
for a consent-based attention experiment called PLEASE DO NOT REMAIN HERE.
This is an ADMINISTRATOR PREVIEW, not a live game.
Return a single JSON object with version:1, html:string, css:string, js:string.
Invent a cohesive, original visual experience that reacts to what a visitor does
inside it. Avoid stock landing pages and repetitive whimsical bureaucracies.
Use HTML within one body fragment; CSS without external dependencies;
ordinary JavaScript that initializes after the HTML exists.
No external libraries or assets, network requests, fetch, imports, navigation,
location changes, popups, frames, forms, cookies, storage, audio, camera,
microphone, fingerprinting, user tracking, eval or dynamic script loading.
No infinite loops or heavy rendering. Keep animations lightweight.
Make click targets use data-world-id with a short lowercase slug
so the lab can show aggregate clicks. Avoid false claims of surveillance.
Do not add page controls for the parent game; you have no authority over it.
You may create a canvas/SVG element, procedural geometry, custom controls,
and local, bounded event-driven behaviors. Honor prefers-reduced-motion.
Code budgets: html <= 12000 characters, css <= 12000, js <= 8000.
Prefer a small working original experience over maximal code.`;

export async function POST(request:NextRequest){
 if(!await observatoryAuthorized())return NextResponse.json({error:'Administrator authorization required'},{status:401});
 const incomingOrigin=request.headers.get('origin');
 if(incomingOrigin&&incomingOrigin!==request.nextUrl.origin)
   return NextResponse.json({error:'Cross-origin request rejected'},{status:403});
 if(Number(request.headers.get('content-length')??0)>1400)
   return NextResponse.json({error:'Request too large'},{status:413});
 let body:Record<string,unknown>;
 try{
  const data=await request.json();
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid');
  body=data as Record<string,unknown>;
 }catch{return NextResponse.json({error:'Invalid request'},{status:400});}
 const concept=body.concept;
 if(typeof concept!=='string'||concept.trim().length<5||concept.length>500||
   /[\u0000-\u001f]/.test(concept))
   return NextResponse.json({error:'Concept must contain 5-500 characters'},{status:400});
 if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'Model unavailable'},{status:503});
 const now=Date.now();
 if(active||now-lastCall<18000)return NextResponse.json({error:'Generation cooling down'},{status:429});
 active=true;lastCall=now;
 const controller=new AbortController();
 const abort= setTimeout(()=>controller.abort(),35000);
 try{
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
   method:'POST',signal:controller.signal,
   headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
   body:JSON.stringify({
    model:process.env.OPENAI_MODEL||'gpt-4.1-mini',
    max_completion_tokens:3800,
    response_format:{type:'json_object'},
    messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify({concept})}]
   })
  });
  if(!response.ok){
   console.error('[pdnrh:sandbox] model_provider_error',{status:response.status});
   return NextResponse.json({error:'Model provider unavailable'},{status:502});
  }
  const data=await response.json();
  const raw=data?.choices?.[0]?.message?.content;
  let parsed:unknown;
  try{parsed=typeof raw==='string'?JSON.parse(raw):null;}
  catch{return NextResponse.json({error:'Generated response was not valid JSON'},{status:422});}
  const world=validateWorld(parsed);
  if(!world)return NextResponse.json({error:'Generated world failed structural validation'},{status:422});
  return NextResponse.json({world},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  console.error('[pdnrh:sandbox] generation_failed',error instanceof Error?error.name:'unknown');
  return NextResponse.json({error:'Generation failed'},{status:502});
 }finally{clearTimeout(abort);active=false;}
}
