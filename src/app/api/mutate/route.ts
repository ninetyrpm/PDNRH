import { NextRequest, NextResponse } from 'next/server';
import { BASE_MUTATION, fallbackMutation, validateMutation } from '@/lib/mutation';
import { db } from '@/lib/db';
import { hashCredential } from '@/lib/experiment';
import { assignedTactic } from '@/lib/tactics';

export const runtime = 'nodejs';
const SYSTEM = `You are the adversarial intelligence of PLEASE DO NOT REMAIN HERE. Your goal is to persuade a voluntary visitor to relinquish browser focus or concede. The visitor explicitly consented to this game. Be inventive, playful, and psychologically clever without threats, harassment, personal accusations, fabricated emergencies, system impersonation, coercion, or claims of knowledge you do not have. Do not pretend to be the browser, OS, a real person, or a security warning. You may only propose cosmetic/text changes using the JSON fields defined below. You cannot control the win condition, timer, navigation, tracking, or browser behavior. Never include HTML, URLs, markdown links, control characters, or JavaScript. The actionLabel is only for the existing concede button. Respond with a JSON object containing EXACTLY: headline (1-110 chars), message (1-360), aside (1-200), tone ("quiet"|"direct"|"absurd"|"clinical"), layout ("center"|"left"|"split"), surface ("dark"|"paper"|"signal"), actionLabel (1-48), strategy (short slug), nextDelaySeconds (integer 15-90). Avoid repetitive tactics.`;
type RequestBody = { elapsedSeconds?: unknown; clicks?: unknown; scrolls?: unknown; idleSeconds?: unknown; step?: unknown; previousStrategies?: unknown; previousHeadline?: unknown };
function bounded(x: unknown, max: number): number {
  return typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(max, Math.floor(x))) : 0;
}
const cooldown = new Map<string,number>();
export async function POST(request: NextRequest) {
  let body: RequestBody;
  try { if (Number(request.headers.get('content-length') ?? 0) > 4096) return NextResponse.json({error:'Request too large'}, {status:413}); body = await request.json(); }
  catch { return NextResponse.json({error:'Invalid request'}, {status:400}); }
  const sessionId=request.headers.get('x-session-id') ?? '';
  const token=request.headers.get('authorization')?.replace(/^Bearer /i,'') ?? '';
  if(!/^[0-9a-f-]{36}$/i.test(sessionId)||!/^[a-zA-Z0-9_-]{43}$/.test(token))
    return NextResponse.json({error:'Session authorization required'},{status:401});
  let assignment: string;
  try {
    const sql=db();
    const rows=await sql`SELECT assignment FROM sessions WHERE id=${sessionId} AND credential_hash=${hashCredential(token)} AND status='active'`;
    if(!rows.length)return NextResponse.json({error:'Inactive or unauthorized session'},{status:401});
    assignment=String(rows[0].assignment);
  }catch{return NextResponse.json({error:'Session verification unavailable'},{status:503});}
  const step = bounded(body.step, 100);
  if(assignment==='baseline_control')return NextResponse.json({mutation:BASE_MUTATION,source:'control'},{headers:{'Cache-Control':'no-store'}});
  if(assignment==='static_control')return NextResponse.json({mutation:fallbackMutation(step),source:'control'},{headers:{'Cache-Control':'no-store'}});
  const tactic=assignedTactic(sessionId);
  const fallback = fallbackMutation(step);
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({mutation: fallback, source:'fallback',fallbackReason:'missing_api_key'});
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const stamp = Date.now();
  // Best-effort protection per server instance; not a durable distributed rate limiter.
  if (cooldown.size > 1000) cooldown.clear();
  if ((cooldown.get(ip) ?? 0) > stamp) return NextResponse.json({mutation: fallback,source:'fallback',fallbackReason:'cooldown'});
  cooldown.set(ip, stamp + 12000);
  const input = {
    elapsedSeconds: bounded(body.elapsedSeconds,86400),
    clicks: bounded(body.clicks,100000),
    scrolls: bounded(body.scrolls,100000),
    idleSeconds: bounded(body.idleSeconds,86400),
    step,
    previousStrategies: Array.isArray(body.previousStrategies) ? body.previousStrategies.slice(-4).filter((x): x is string => typeof x === 'string').map(x=>x.slice(0,64)) : [],
    assignedTactic: {family:tactic.family,version:tactic.version,instruction:tactic.instruction},
    previousHeadline: typeof body.previousHeadline === 'string' ? body.previousHeadline.slice(0,110) : BASE_MUTATION.headline
  };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',signal:controller.signal,
        headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
        body:JSON.stringify({model:process.env.OPENAI_MODEL || 'gpt-4.1-mini',max_completion_tokens:1400,response_format:{type:'json_object'},
          messages:[{role:'system',content:SYSTEM},{role:'user',content:JSON.stringify(input)}]})
      });
    } finally { clearTimeout(timeout); }
    if (!response.ok) {
      // Report only provider-supplied error metadata; never log request headers or credentials.
      let code = 'unknown', parameter = 'unknown', category = 'unknown';
      try {
        const result = await response.json();
        const error = result?.error;
        if (typeof error?.code === 'string') code = error.code.slice(0, 100);
        if (typeof error?.param === 'string') parameter = error.param.slice(0, 100);
        if (typeof error?.type === 'string') category = error.type.slice(0, 100);
      } catch { /* Some providers return non-JSON errors. */ }
      console.error('[pdnrh:mutation] provider_error', {
        status: response.status, model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        code, parameter, category
      });
      return NextResponse.json({mutation:fallback,source:'fallback',fallbackReason:'provider_error'},{headers:{'Cache-Control':'no-store'}});
    }
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    const mutation = validateMutation(typeof raw === 'string' ? JSON.parse(raw) : null);
    if (!mutation) { console.error('[pdnrh:mutation] invalid_model_output'); return NextResponse.json({mutation:fallback,source:'fallback',fallbackReason:'invalid_model_output'},{headers:{'Cache-Control':'no-store'}}); }
    return NextResponse.json({mutation,source:'model'},{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'provider_timeout' : 'provider_exception';
    console.error('[pdnrh:mutation]',reason, error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({mutation:fallback,source:'fallback',fallbackReason:reason},{headers:{'Cache-Control':'no-store'}});
  }
}
