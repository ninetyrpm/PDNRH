import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashCredential } from '@/lib/experiment';
import { validateMutation, BASE_MUTATION, fallbackMutation } from '@/lib/mutation';

export const runtime='nodejs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(req:NextRequest,ctx:{params:Promise<{id:string}>}) {
  const {id}=await ctx.params;
  const token=req.headers.get('authorization')?.replace(/^Bearer /i,'')??'';
  if(!uuid.test(id)||!/^[a-zA-Z0-9_-]{43}$/.test(token))return NextResponse.json({error:'Unauthorized'},{status:401});
  let body:Record<string,unknown>;
  try{if(Number(req.headers.get('content-length')||0)>2048)return NextResponse.json({error:'Too large'},{status:413});body=await req.json();}
  catch{return NextResponse.json({error:'Invalid JSON'},{status:400});}
  const ordinal=body.ordinal;
  const mutation=validateMutation(body.mutation);
  const source=body.source;
  if(typeof ordinal!=='number'||!Number.isSafeInteger(ordinal)||ordinal<0||ordinal>10000||!mutation||
      !['model','fallback','control'].includes(String(source))||
      (ordinal===0&&(JSON.stringify(mutation)!==JSON.stringify(BASE_MUTATION)||source!=='control')))
    return NextResponse.json({error:'Invalid exposure'},{status:400});
  try{
    const sql=db();
    const rows=await sql`SELECT assignment,status FROM sessions WHERE id=${id} AND credential_hash=${hashCredential(token)}`;
    if(!rows.length)return NextResponse.json({error:'Unauthorized'},{status:401});
    const assignment=String(rows[0].assignment);
    if(assignment==='baseline_control'&&ordinal>0)return NextResponse.json({error:'Control violation'},{status:403});
    if(assignment==='static_control'&&ordinal>0&&
       (source!=='control'||JSON.stringify(mutation)!==JSON.stringify(fallbackMutation(ordinal))))
       return NextResponse.json({error:'Control violation'},{status:403});
    if(assignment==='adaptive'&&ordinal>0&&source==='control')return NextResponse.json({error:'Control violation'},{status:403});
    if(rows[0].status!=='active'&&ordinal!==0)return NextResponse.json({accepted:false,terminal:true},{status:409});
    const inserted=await sql`INSERT INTO exposures(session_id,ordinal,mutation,source)
      VALUES(${id},${ordinal},${JSON.stringify(mutation)}::jsonb,${String(source)})
      ON CONFLICT(session_id,ordinal) DO NOTHING RETURNING id`;
    if(inserted.length&&ordinal>0)await sql`UPDATE exposures SET ended_at=now() WHERE session_id=${id} AND ordinal=${ordinal-1} AND ended_at IS NULL`;
    return NextResponse.json({accepted:true,duplicate:inserted.length===0},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Exposure recording unavailable'},{status:503});}
}
