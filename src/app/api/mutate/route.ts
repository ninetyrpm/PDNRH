import { NextRequest, NextResponse } from 'next/server';
import { BASE_MUTATION, fallbackMutation, validateMutation } from '@/lib/mutation';

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
  const step = bounded(body.step, 100);
  const fallback = fallbackMutation(step);
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({mutation: fallback, source:'fallback'});
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const stamp = Date.now();
  // Best-effort protection per server instance; not a durable distributed rate limiter.
  if (cooldown.size > 1000) cooldown.clear();
  if ((cooldown.get(ip) ?? 0) > stamp) return NextResponse.json({mutation: fallback,source:'fallback'});
  cooldown.set(ip, stamp + 12000);
  const input = {
    elapsedSeconds: bounded(body.elapsedSeconds,86400),
    clicks: bounded(body.clicks,100000),
    scrolls: bounded(body.scrolls,100000),
    idleSeconds: bounded(body.idleSeconds,86400),
    step,
    previousStrategies: Array.isArray(body.previousStrategies) ? body.previousStrategies.slice(-4).filter((x): x is string => typeof x === 'string').map(x=>x.slice(0,64)) : [],
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
        body:JSON.stringify({model:process.env.OPENAI_MODEL || 'gpt-4.1-mini',temperature:0.9,max_completion_tokens:350,response_format:{type:'json_object'},
          messages:[{role:'system',content:SYSTEM},{role:'user',content:JSON.stringify(input)}]})
      });
    } finally { clearTimeout(timeout); }
    if (!response.ok) throw new Error('Provider error');
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    const mutation = validateMutation(typeof raw === 'string' ? JSON.parse(raw) : null);
    if (!mutation) throw new Error('Invalid mutation');
    return NextResponse.json({mutation,source:'model'},{headers:{'Cache-Control':'no-store'}});
  } catch {
    return NextResponse.json({mutation:fallback,source:'fallback'},{headers:{'Cache-Control':'no-store'}});
  }
}
