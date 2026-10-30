import { NextRequest,NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { observatoryCookie,validAdminToken,createObservatorySession,loginKey } from '@/lib/observatory-auth';

export const runtime='nodejs';
const maxFailures=5;
function reply(error:string,status:number){
  return NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:NextRequest){
  const origin=req.headers.get('origin');
  if(!origin || origin!==req.nextUrl.origin)return reply('Origin mismatch',403);
  const length=Number(req.headers.get('content-length')??'0');
  if(length>2048)return reply('Too large',413);
  let body:{token?:unknown};
  try{body=await req.json();}catch{return reply('Invalid request',400);}
  if(typeof body.token!=='string'||body.token.length>512)return reply('Invalid credentials',401);
  // A durable, shared 15-minute counter, rather than an in-memory serverless limiter.
  // Vercel supplies a canonical client IP; do not trust arbitrary X-Forwarded-For headers.
  const address=req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() || 'unknown';
  const key=loginKey(address);
  try{
    const sql=db();
    const blocked=await sql`SELECT attempts FROM observatory_login_attempts
      WHERE key_hash=${key} AND window_started_at>now()-interval '15 minutes'`;
    if(blocked.length && Number(blocked[0].attempts)>=maxFailures)return reply('Too many attempts. Try again later.',429);
    if(!validAdminToken(body.token)){
      await sql`INSERT INTO observatory_login_attempts(key_hash,window_started_at,attempts)
        VALUES(${key},now(),1) ON CONFLICT(key_hash) DO UPDATE SET
        attempts=CASE WHEN observatory_login_attempts.window_started_at<now()-interval '15 minutes'
          THEN 1 ELSE observatory_login_attempts.attempts+1 END,
        window_started_at=CASE WHEN observatory_login_attempts.window_started_at<now()-interval '15 minutes'
          THEN now() ELSE observatory_login_attempts.window_started_at END`;
      return reply('Invalid credentials',401);
    }
    await sql`DELETE FROM observatory_login_attempts WHERE key_hash=${key}`;
    const response=NextResponse.json({authorized:true},{headers:{'Cache-Control':'no-store'}});
    response.cookies.set(observatoryCookie,createObservatorySession(),{
      httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',
      path:'/observatory',maxAge:60*60*4
    });
    return response;
  }catch{
    return reply('Authentication temporarily unavailable',503);
  }
}
export async function DELETE(req:NextRequest){
  const origin=req.headers.get('origin');
  if(origin && origin!==req.nextUrl.origin)return reply('Origin mismatch',403);
  const response=NextResponse.json({authorized:false},{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(observatoryCookie,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/observatory',maxAge:0});
  return response;
}
