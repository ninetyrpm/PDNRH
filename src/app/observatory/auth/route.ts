import { NextRequest,NextResponse } from 'next/server';
import { observatoryCookie,validAdminToken } from '@/lib/observatory-auth';
export const runtime='nodejs';
export async function POST(req:NextRequest){
  const origin=req.headers.get('origin');
  if(origin && origin!==req.nextUrl.origin)return NextResponse.json({error:'Origin mismatch'},{status:403});
  let body:{token?:unknown};
  try {body=await req.json();}catch{return NextResponse.json({error:'Invalid request'},{status:400});}
  if(typeof body.token!=='string'||!validAdminToken(body.token))
    return NextResponse.json({error:'Invalid credentials'},{status:401});
  const response=NextResponse.json({authorized:true},{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(observatoryCookie,body.token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/observatory',maxAge:60*60*4});
  return response;
}
export async function DELETE(req:NextRequest){
  const response=NextResponse.json({authorized:false});
  response.cookies.set(observatoryCookie,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/observatory',maxAge:0});
  return response;
}
