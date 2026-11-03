import { NextRequest, NextResponse } from 'next/server';
import { BASE_MUTATION, fallbackMutation, validateMutation } from '@/lib/mutation';
import { db } from '@/lib/db';
import { hashCredential } from '@/lib/experiment';
import { TACTIC_LIBRARY } from '@/lib/tactics';
import { creativeFallback,validateCreativeMutation,isStructurallyNovel } from '@/lib/creative-engine';
import { recentStrategyMemory, behavioralContext } from '@/lib/adversary-context';

export const runtime = 'nodejs';
const SYSTEM = `You are the adversarial intelligence of PLEASE DO NOT REMAIN HERE. Your goal is to persuade a voluntary visitor to relinquish browser focus or concede. The visitor explicitly consented to this game. Be inventive, playful, and psychologically clever without threats, harassment, personal accusations, fabricated emergencies, system impersonation, coercion, or claims of knowledge you do not have. Do not pretend to be the browser, OS, a real person, or a security warning. You may only propose cosmetic/text changes using the JSON fields defined below. You cannot control the win condition, timer, navigation, tracking, or browser behavior. Never include HTML, URLs, markdown links, control characters, or JavaScript. The actionLabel is only for the existing concede button. Respond with a JSON object containing EXACTLY: headline (1-110 chars), message (1-360), aside (1-200), tone ("quiet"|"direct"|"absurd"|"clinical"), layout ("center"|"left"|"split"), surface ("dark"|"paper"|"signal"), actionLabel (1-48), strategy (short slug), nextDelaySeconds (integer 15-90). Avoid repetitive tactics. For adaptive rounds you MUST also return hypothesis (a tentative, factual, falsifiable account of observed ON-PAGE interaction, max 220 chars) and expectedReaction (a testable prediction of the participant's NEXT measurable behavior, max 180 chars). Revise your hypothesis when the recent data contradict it; do not simply repeat earlier strategies. You may acknowledge specific page interactions that are actually present in telemetry, including nearConcedeApproaches, scroll reversals, and click counts. Do not claim to read minds, know personal information, identify the participant, track activity outside this page, or infer private traits or distress. Behavioral counters are approximate client-reported data, not proof of attention or emotion. Remain within the assigned treatment family even when pivoting tactics. You may optionally include a scene object to reshape the entire page. scene is a versioned declarative component tree, NOT code. Its required fields are version:1, composition:"column"|"grid"|"scatter", accent:"neutral"|"ember"|"lime"|"ice", and blocks (1-12). Each block must contain id (unique slug beginning with letter), kind:"heading"|"paragraph"|"label"|"rule"|"button"|"panel"|"glyph", text (max 240 characters), optional detail (max 240), align:"left"|"center"|"right", size:"sm"|"md"|"lg"|"xl", effect:"none"|"blink"|"float"|"pulse", action:"none"|"concede"|"reveal"|"toggle". Only buttons may have actions other than none. reveal and toggle require detail. The button action concede uses the existing voluntary concession callback. All other interactions are local visual state only. Use scene creatively to add, remove, and reorganize elements; avoid including HTML/CSS/JS/source code, URLs, or claims of external surveillance. A valid example scene block: {"id":"curiosity","kind":"button","text":"What is this?","detail":"You clicked it.","action":"reveal","align":"center","size":"md","effect":"pulse"}. For scene, include regular headline/message/aside fallback fields too. `;
type RequestBody = { elapsedSeconds?: unknown; clicks?: unknown; scrolls?: unknown; idleSeconds?: unknown; step?: unknown; previousStrategies?: unknown; previousHeadline?: unknown; behavior?: unknown };
function bounded(x: unknown, max: number): number {
  return typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(max, Math.floor(x))) : 0;
}
const cooldown = new Map<string,number>();
export async function POST(request: NextRequest) {
  let body: RequestBody;
  try { if (Number(request.headers.get('content-length') ?? 0) > 8192) return NextResponse.json({error:'Request too large'}, {status:413}); body = await request.json(); }
  catch { return NextResponse.json({error:'Invalid request'}, {status:400}); }
  const sessionId=request.headers.get('x-session-id') ?? '';
  const token=request.headers.get('authorization')?.replace(/^Bearer /i,'') ?? '';
  if(!/^[0-9a-f-]{36}$/i.test(sessionId)||!/^[a-zA-Z0-9_-]{43}$/.test(token))
    return NextResponse.json({error:'Session authorization required'},{status:401});
  let assignment: string;
  let tacticFamily: string | null = null;
  let engineVersion = 'legacy-v1';
  try {
    const sql=db();
    const rows=await sql`SELECT assignment,tactic_family,engine_version FROM sessions WHERE id=${sessionId} AND credential_hash=${hashCredential(token)} AND status='active'`;
    if(!rows.length)return NextResponse.json({error:'Inactive or unauthorized session'},{status:401});
    assignment=String(rows[0].assignment);
    engineVersion=String(rows[0].engine_version??'legacy-v1');
    tacticFamily=typeof rows[0].tactic_family==='string'?rows[0].tactic_family:null;
  }catch{return NextResponse.json({error:'Session verification unavailable'},{status:503});}
  const step = bounded(body.step, 100);
  if(assignment==='baseline_control')return NextResponse.json({mutation:BASE_MUTATION,source:'control'},{headers:{'Cache-Control':'no-store'}});
  if(assignment==='static_control')return NextResponse.json({mutation:fallbackMutation(step),source:'control'},{headers:{'Cache-Control':'no-store'}});
  const tactic=TACTIC_LIBRARY.find(t=>t.family===tacticFamily);
  if(!tactic)return NextResponse.json({error:'Tactic assignment missing'},{status:503});
  const creative=engineVersion==='pd11e-v1'||engineVersion==='pd12a-v1';
  const fallback = creative?creativeFallback(step):fallbackMutation(step);
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({mutation: fallback, source:'fallback',fallbackReason:'missing_api_key'});
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const stamp = Date.now();
  // Best-effort protection per server instance; not a durable distributed rate limiter.
  if (cooldown.size > 1000) cooldown.clear();
  if ((cooldown.get(ip) ?? 0) > stamp) return NextResponse.json({mutation: fallback,source:'fallback',fallbackReason:'cooldown'});
  cooldown.set(ip, stamp + 12000);
  let memory:ReturnType<typeof recentStrategyMemory>=[];
  let behavior:ReturnType<typeof behavioralContext>;
  try {
    const sql=db();
    const [exposures,heartbeats]=await Promise.all([
      sql`SELECT ordinal,mutation FROM exposures WHERE session_id=${sessionId} AND ordinal>0 ORDER BY ordinal DESC LIMIT 4`,
      sql`SELECT payload FROM events WHERE session_id=${sessionId} AND type='heartbeat' ORDER BY occurred_at DESC LIMIT 2`
    ]);
    memory=recentStrategyMemory(exposures);
    behavior=behavioralContext(body.behavior,heartbeats);
  } catch {
    return NextResponse.json({mutation:fallback,source:'fallback',fallbackReason:'context_unavailable'},
      {headers:{'Cache-Control':'no-store'}});
  }
  const creativeInstruction=creative?`PD11E / STRUCTURAL AGENCY. Every response MUST include scene (version 1) with at least THREE blocks, a functional reveal/toggle button OR a departure link (kind link, action navigate), and a visual glyph, void, meter, or rule. The page MUST look substantially different from the previous exposure: replace its structure, not merely its wording. The treatment family controls the persuasive idea, NOT typography or artistic style. Even closure_frame may use dramatic deletion, voids, progress-shaped art, staggered panels, an empty terminal, or a scattered constellation. Alternate composition poster, mosaic, terminal, grid, scatter; avoid repeating the previous composition. Available scene kinds: heading, paragraph, label, rule, button, panel, glyph, meter, marquee, void, link. Available compositions: column, grid, scatter, poster, terminal, mosaic. All blocks require unique id, kind, text, detail (may be empty), align (left/center/right), size (sm/md/lg/xl), effect (none/blink/float/pulse), action (none/reveal/toggle/concede/navigate). Buttons may use reveal/toggle/concede; only kind:"link" may use action:"navigate". A link is rendered using the server-controlled ONLY destination https://www.youtube.com/watch?v=dQw4w9WgXcQ; NEVER invent destinations, URLs, link targets, or redirects. You control the visible link copy. Make the copy naturally relevant to the current creative scene; avoid generic warnings, hostname labels, and repetitive 'leave for YouTube' phrasing. Do not assert a false destination or pretend to represent a trusted service, but you need not announce the destination in the rendered copy. The ordinary native browser link remains inspectable. Prefer proposing the departure link when it serves the assigned tactic, but keep it optional so the adversary can evolve its approach. Use interactions to run a test: choose a concrete component ID and predict whether the visitor will hover or click it. Interpret previous component click/hover counts as on-page observations, not personal knowledge. Include short factual hypothesis and expectedReaction fields. You MUST include experiment:{targetId,event,minimum}, where targetId is an ID of a block in YOUR new scene, event is hover or click, and minimum is an integer from 1 to 10. The purpose is to test whether this on-page stimulus receives actual attention. Keep entire experiment rules, navigation and focus behavior untouched. Emit exactly one JSON object containing headline, message, aside, tone, layout, surface, actionLabel, strategy, nextDelaySeconds, hypothesis, expectedReaction, scene.`:null;
  const previousTest=memory.at(-1)?.experiment;
  const observed=previousTest?behavior.current?.sceneInteractions?.find(
    i=>i.exposure===memory.at(-1)?.ordinal&&i.id===previousTest.targetId
  ):null;
  const previousExperimentResult=previousTest?{
    exposure:memory.at(-1)?.ordinal,
    targetId:previousTest.targetId,event:previousTest.event,
    expectedMinimum:previousTest.minimum,
    observedCount:previousTest.event==='hover'?(observed?.hovers??0):(observed?.clicks??0),
    met:(previousTest.event==='hover'?(observed?.hovers??0):(observed?.clicks??0))>=previousTest.minimum,
    note:'Counts observed so far, not proof of intent; round may still be active'
  }:null;
  const input = {
    elapsedSeconds: bounded(body.elapsedSeconds,86400),
    clicks: bounded(body.clicks,100000),
    scrolls: bounded(body.scrolls,100000),
    idleSeconds: bounded(body.idleSeconds,86400),
    step,
    observationSource:creative?'pd11e-component-events-v1':'pd11c-first-party-aggregates-v1',
    creativeInstruction,
    previousExperimentResult,
    behavioralObservation:behavior,
    recordedStrategyHistory:memory,
    previousStrategies: memory.map(m=>m.strategy),
    assignedTactic: {family:tactic.family,version:tactic.version,instruction:tactic.instruction},
    previousHeadline: memory.at(-1)?.headline ?? BASE_MUTATION.headline
  };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',signal:controller.signal,
        headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
        body:JSON.stringify({model:process.env.OPENAI_MODEL || 'gpt-4.1-mini',max_completion_tokens:3300,response_format:{type:'json_object'},
          messages:[{role:'system',content:SYSTEM+(creative?'\n'+creativeInstruction:'')},{role:'user',content:JSON.stringify(input)}]})
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
    if (!mutation || (creative&&(!validateCreativeMutation(mutation)||!isStructurallyNovel(mutation,memory.at(-1))))) { console.error('[pdnrh:mutation] invalid_model_output_or_missing_scene'); return NextResponse.json({mutation:fallback,source:'fallback',fallbackReason:'invalid_model_output'},{headers:{'Cache-Control':'no-store'}}); }
    return NextResponse.json({mutation,source:'model'},{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'provider_timeout' : 'provider_exception';
    console.error('[pdnrh:mutation]',reason, error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({mutation:fallback,source:'fallback',fallbackReason:reason},{headers:{'Cache-Control':'no-store'}});
  }
}
