import {NextRequest,NextResponse} from 'next/server';
import {openExperimentSession} from '@/lib/experiment';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 const origin=request.headers.get('origin');
 if(origin&&origin!==request.nextUrl.origin)
  return NextResponse.json({error:'Invalid origin'},{status:403});
 let engine:'pd12d-v1'|'pd13e-v1'='pd12d-v1';
 try{
  if(Number(request.headers.get('content-length')??0)>200)
   return NextResponse.json({error:'Too large'},{status:413});
  const body:unknown=await request.json();
  if(body&&typeof body==='object'&&!Array.isArray(body)){
   const requested=(body as Record<string,unknown>).engine;
   if(requested==='pd13e-v1')engine='pd13e-v1';
   else if(requested!==undefined&&requested!=='pd12d-v1')
    return NextResponse.json({error:'Unsupported engine'},{status:400});
  }
 }catch{
  // Legacy PD12D sends a bodyless POST.
 }
 try{
  const session=await openExperimentSession(engine);
  return NextResponse.json(session,{status:201,headers:{'Cache-Control':'no-store'}});
 }catch{
  return NextResponse.json({error:'Session service temporarily unavailable'},
    {status:503,headers:{'Cache-Control':'no-store'}});
 }
}
