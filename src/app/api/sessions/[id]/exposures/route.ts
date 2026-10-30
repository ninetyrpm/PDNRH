import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashCredential } from '@/lib/experiment';
import { validateMutation, BASE_MUTATION, fallbackMutation } from '@/lib/mutation';
import { assignedTactic } from '@/lib/tactics';

export const runtime='nodejs';
function sameMutation(a: NonNullable<ReturnType<typeof validateMutation>>, b: NonNullable<ReturnType<typeof validateMutation>>) {
  // Normalize ordering before comparison (validated objects do not retain input field order).
  return Object.keys(b).every(key => a[key as keyof typeof a] === b[key as keyof typeof b]);
}
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
      (ordinal===0&&(!sameMutation(mutation,BASE_MUTATION)||source!=='control')))
    return NextResponse.json({error:'Invalid exposure'},{status:400});
  try{
    const sql=db();
    const rows=await sql`SELECT assignment,status FROM sessions WHERE id=${id} AND credential_hash=${hashCredential(token)}`;
    if(!rows.length)return NextResponse.json({error:'Unauthorized'},{status:401});
    const assignment=String(rows[0].assignment);
    if(assignment==='baseline_control'&&ordinal>0)return NextResponse.json({error:'Control violation'},{status:403});
    if(assignment==='static_control'&&ordinal>0&&
       (source!=='control'||!sameMutation(mutation,fallbackMutation(ordinal))))
       return NextResponse.json({error:'Control violation'},{status:403});
    if(assignment==='adaptive'&&ordinal>0&&source==='control')return NextResponse.json({error:'Control violation'},{status:403});
    if(rows[0].status!=='active')return NextResponse.json({accepted:false,terminal:true},{status:409});
    const inserted=await sql`INSERT INTO exposures(session_id,ordinal,mutation,source)
      VALUES(${id},${ordinal},${JSON.stringify(mutation)}::jsonb,${String(source)})
      ON CONFLICT(session_id,ordinal) DO NOTHING RETURNING id`;
    if(inserted.length) {
      const assigned=assignedTactic(id);
      const family = ordinal === 0 ? 'baseline' :
        assignment === 'static_control' ? 'scripted_' + mutation.strategy :
        source === 'fallback' ? 'model_fallback' : assigned.family;
      const version = assignment==='adaptive'&&source==='model' ? assigned.version : 1;
      await sql`INSERT INTO tactics(strategy_family,strategy_version,definition)
        VALUES(${family},${version},${JSON.stringify({source,kind:'assigned_treatment',version:1})}::jsonb)
        ON CONFLICT(strategy_family,strategy_version) DO NOTHING`;
      await sql`UPDATE exposures SET tactic_id=(
        SELECT id FROM tactics WHERE strategy_family=${family} AND strategy_version=${version}
      ) WHERE session_id=${id} AND ordinal=${ordinal} AND tactic_id IS NULL`;
      // Requests may arrive out of order. Determine exposure windows by ordinal,
      // never by network arrival order; terminal times cap the final window.
      await sql`WITH windows AS (
        SELECT e.id, LEAD(e.displayed_at) OVER (ORDER BY e.ordinal) AS next_at,
          s.ended_at AS terminal_at
        FROM exposures e JOIN sessions s ON s.id=e.session_id
        WHERE e.session_id=${id}
      )
      UPDATE exposures e SET ended_at=
        CASE WHEN w.next_at IS NOT NULL THEN GREATEST(e.displayed_at,w.next_at)
             WHEN w.terminal_at IS NOT NULL THEN GREATEST(e.displayed_at,w.terminal_at)
             ELSE NULL END
      FROM windows w WHERE e.id=w.id`;
    }
    return NextResponse.json({accepted:true,duplicate:inserted.length===0},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Exposure recording unavailable'},{status:503});}
}
