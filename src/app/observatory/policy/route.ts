import { NextRequest,NextResponse } from 'next/server';
import { observatoryAuthorized } from '@/lib/observatory-auth';
import { db } from '@/lib/db';

export const runtime='nodejs';
export async function POST(request:NextRequest){
  if(!await observatoryAuthorized())return NextResponse.json({error:'Unauthorized'},{status:401});
  if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Origin mismatch'},{status:403});
  let body:{mode?:unknown;reason?:unknown;revision?:unknown};
  try { if(Number(request.headers.get('content-length')??0)>1500)return NextResponse.json({error:'Too large'},{status:413});body=await request.json(); }
  catch {return NextResponse.json({error:'Bad request'},{status:400});}
  if(!['uniform','eligible_preference'].includes(String(body.mode)) ||
    typeof body.reason!=='string'||body.reason.trim().length<12||body.reason.length>500 ||
    !Number.isSafeInteger(body.revision)||Number(body.revision)<1)return NextResponse.json({error:'Invalid change'},{status:400});
  try {
    const sql=db();
    const changed=await sql`WITH prior AS (
        SELECT mode,revision FROM experiment_policy_control WHERE singleton=true
      ), updated AS (
        UPDATE experiment_policy_control SET mode=${String(body.mode)},revision=revision+1,
          reason=${body.reason.trim()},updated_at=now()
        WHERE singleton=true AND revision=${Number(body.revision)} AND mode<>${String(body.mode)}
        RETURNING revision,mode
      ), logged AS (
        INSERT INTO experiment_policy_audit(revision,previous_mode,new_mode,reason)
        SELECT updated.revision,prior.mode,updated.mode,${body.reason.trim()} FROM updated CROSS JOIN prior
        RETURNING revision
      )
      SELECT updated.revision,updated.mode FROM updated JOIN logged USING(revision)`;
    if(!changed.length)return NextResponse.json({error:'Stale revision or mode unchanged; refresh.'},{status:409});
    return NextResponse.json({revision:changed[0].revision,mode:changed[0].mode},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Change unavailable'},{status:503});}
}
