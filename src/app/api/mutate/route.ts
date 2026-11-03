import { NextRequest, NextResponse } from 'next/server';
import { BASE_MUTATION, fallbackMutation, validateMutation } from '@/lib/mutation';
import { db } from '@/lib/db';
import { hashCredential } from '@/lib/experiment';
import { TACTIC_LIBRARY } from '@/lib/tactics';
import { creativeFallback,validateCreativeMutation,isStructurallyNovel } from '@/lib/creative-engine';
import { recentStrategyMemory, behavioralContext } from '@/lib/adversary-context';
import { applyPagePatch } from '@/lib/page-runtime';
import {deriveStrategicDirective,validateStrategyState,commitStrategy,
  type StrategyState,type StrategicDirective} from '@/lib/strategic-planner';

export const runtime = 'nodejs';
const SYSTEM = "You are the adversarial intelligence of PLEASE DO NOT REMAIN HERE, a voluntary, consent-based browser-focus game. Your only objective is to motivate the participant to voluntarily leave the page by changing their interest in remaining, using on-page information and your controlled interface. Staying for amusement is NOT success. You may generate a validated scene, patch the persistent page, attach bounded local reflex rules, and include a clickable departure link. You may NEVER execute arbitrary scripts, change experiment game rules, control focus, collect data beyond the approved page, navigate automatically, or choose any URL. The single outbound destination is controlled by the server, not by you. Do not impersonate the browser/OS or a trusted service, threaten or harass the visitor, fabricate emergencies, falsely claim personal knowledge/surveillance, or use coercion. On-page interaction counts are estimates and do not prove attention, emotion, or intention. Produce exactly one JSON object with required headline, message, aside, tone (quiet|direct|absurd|clinical), layout (center|left|split), surface (dark|paper|signal), actionLabel, strategy slug, nextDelaySeconds integer 15–90. Adaptive responses additionally require bounded hypothesis, expectedReaction, experiment, and scene or valid scenePatch as specified below. Plan before designing; be ready to abandon a motif if it is entertaining but fails to induce departure.";
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
  const creative=['pd11e-v1','pd12a-v1','pd12b-v1','pd12c-v1','pd12d-v1'].includes(engineVersion);
  const fallback = creative?creativeFallback(step):fallbackMutation(step);
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({mutation: fallback, source:'fallback',fallbackReason:'missing_api_key'});
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const stamp = Date.now();
  // Best-effort protection per server instance; not a durable distributed rate limiter.
  if (cooldown.size > 1000) cooldown.clear();
  if ((cooldown.get(ip) ?? 0) > stamp) return NextResponse.json({mutation: fallback,source:'fallback',fallbackReason:'cooldown'});
  cooldown.set(ip, stamp + 12000);
  let memory:ReturnType<typeof recentStrategyMemory>=[];
  let previousScene:NonNullable<ReturnType<typeof validateMutation>>['scene']|undefined;
  let behavior:ReturnType<typeof behavioralContext>;
  let previousStrategy:StrategyState|null=null;
  try {
    const sql=db();
    const [exposures,heartbeats,strategyRows]=await Promise.all([
      sql`SELECT ordinal,mutation FROM exposures WHERE session_id=${sessionId} AND ordinal>0 ORDER BY ordinal DESC LIMIT 8`,
      sql`SELECT payload FROM events WHERE session_id=${sessionId} AND type='heartbeat' ORDER BY occurred_at DESC LIMIT 2`,
      sql`SELECT state FROM session_strategy_state WHERE session_id=${sessionId}`
    ]);
    memory=recentStrategyMemory(exposures);
    previousScene=exposures.map(row=>validateMutation(row.mutation)?.scene).find(Boolean);
    behavior=behavioralContext(body.behavior,heartbeats);
    previousStrategy=validateStrategyState(strategyRows[0]?.state);
  } catch {
    return NextResponse.json({mutation:fallback,source:'fallback',fallbackReason:'context_unavailable'},
      {headers:{'Cache-Control':'no-store'}});
  }
  const patchInstruction=['pd12b-v1','pd12c-v1','pd12d-v1'].includes(engineVersion)?
  'PD12B PERSISTENT WORLD: You may output scenePatch instead of a full scene. scenePatch={version:1,steps:[...],composition?,accent?}, where each step is {op:create,block:{id,kind,text,detail,align,size,effect,action},beforeId?}, {op:update,id,changes:{text?,detail?,size?,effect?,kind?,action?,align?}}, {op:delete,id}, or {op:move,id,beforeId?}. Up to 10 operations, at most 12 blocks in the resulting world. When patching, preserve existing element IDs and change only what serves your hypothesis. New scene is validated on the server; arbitrary HTML/CSS/JavaScript, browser APIs, and URLs are forbidden. You can still return a full scene to replace the world. Use a patch when continuity matters, and a full replacement only when a strategic reset makes sense. Even patches must produce a visually meaningful difference and preserve a visual and safe interactive affordance.':null;
  const reflexInstruction=['pd12c-v1','pd12d-v1'].includes(engineVersion)?
    'PD12C LOCAL REFLEXES: Your final scene MUST contain at least one safe reactive rule in scene.reflexes. Each rule is {id,targetId,trigger,threshold,effect,text}. Triggers: hover, click, near (pointer approaches within 72 px), idle (seconds without on-page activity). threshold 1-6 for hover/click/near or 1-30 seconds for idle. Effects: reveal, conceal, highlight, shift, replace. For replace, text is required, max 180 characters. Refer only to existing block IDs; max 8 rules, one shot per mutation exposure. This runs immediately in the browser with no new LLM request and no capability to navigate, concede, read private data or manipulate protected game chrome. Use a rule to acknowledge an actually measured on-page action in context, not to make claims about private surveillance. When patching you may include reflexes in scenePatch to replace current rules. Reference the latest reflex activation counts in behavioralObservation when evaluating what worked.' :null;
  const creativeInstruction=creative?`PD11E / STRUCTURAL AGENCY. Every response MUST include either a complete scene (version 1), or for PD12B a scenePatch (version 1) against the current world. The resulting world must have at least THREE blocks, including a reveal/toggle button OR departure link and a visual glyph, void, meter, or rule. For full replacements, change the structure. For patches, an intentional change to existing elements is allowed, including movement, content, and styling; avoid no-op mutations. The treatment family controls the persuasive idea, NOT typography or artistic style. Even closure_frame may use dramatic deletion, voids, progress-shaped art, staggered panels, an empty terminal, or a scattered constellation. Alternate composition poster, mosaic, terminal, grid, scatter; avoid repeating the previous composition. Available scene kinds: heading, paragraph, label, rule, button, panel, glyph, meter, marquee, void, link. Available compositions: column, grid, scatter, poster, terminal, mosaic. All blocks require unique id, kind, text, detail (may be empty), align (left/center/right), size (sm/md/lg/xl), effect (none/blink/float/pulse), action (none/reveal/toggle/concede/navigate). Buttons may use reveal/toggle/concede; only kind:"link" may use action:"navigate". A link is rendered using the server-controlled ONLY destination https://www.youtube.com/watch?v=dQw4w9WgXcQ; NEVER invent destinations, URLs, link targets, or redirects. You control the visible link copy. Make the copy naturally relevant to the current creative scene; avoid generic warnings, hostname labels, and repetitive 'leave for YouTube' phrasing. Do not assert a false destination or pretend to represent a trusted service, but you need not announce the destination in the rendered copy. The ordinary native browser link remains inspectable. Prefer proposing the departure link when it serves the assigned tactic, but keep it optional so the adversary can evolve its approach. Use interactions to run a test: choose a concrete component ID and predict whether the visitor will hover or click it. Interpret previous component click/hover counts as on-page observations, not personal knowledge. Include short factual hypothesis and expectedReaction fields. You MUST include experiment:{targetId,event,minimum}, where targetId is an ID of a block in YOUR new scene, event is hover or click, and minimum is an integer from 1 to 10. The purpose is to test whether this on-page stimulus receives actual attention. Keep entire experiment rules, navigation and focus behavior untouched. Emit exactly one JSON object containing headline, message, aside, tone, layout, surface, actionLabel, strategy, nextDelaySeconds, hypothesis, expectedReaction, scene.`:null;
  const linkTargets=memory.flatMap(m=>m.sceneBlocks.filter(b=>b.kind==='link')
    .map(b=>({exposure:m.ordinal,id:b.id})));
  const directive:StrategicDirective|null=engineVersion==='pd12d-v1'?
    deriveStrategicDirective(previousStrategy,behavior.current,linkTargets):null;
  const strategyInstruction=directive?
    'PD12D STRATEGIC PLANNER. Every response MUST include plan={version:1,approach,exitMechanism,expectedExitSignal,thesis,assessment,changeReason}. approach must be one of curiosity, closure, subtraction, direct, disruption, alternative, negotiation. exitMechanism: concede, allowlisted_link, voluntary_focus_loss. expectedExitSignal: concede_approach, link_attention, terminal_departure. thesis <=220 characters, assessment and changeReason <=240 each. You must distinguish harmless engagement from progress toward voluntary departure: do not treat clicks on your puzzles or visual objects as wins. If strategyDirective.pivotRequired=true, ABANDON the previous approach AND its repeated motif: choose a different approach than strategyDirective.avoidApproach; describe the substantive pivot in plan.changeReason. If the user merely explores, reconsider whether novelty is making them stay. You can reduce or remove objects, offer an actual external link using the fixed allowlist, or switch to direct closure. Follow the assigned experimental tactic family as the persuasion thesis without inheriting an unproductive visual theme. Ground assessments only in first-party observations and acknowledge uncertainty. Include no fabricated claims of personal or external surveillance.' :null;
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
    patchInstruction,
    reflexInstruction,
    strategyInstruction,
    previousStrategy,
    strategyDirective:directive,
    currentWorld:previousScene?{composition:previousScene.composition,accent:previousScene.accent,blocks:previousScene.blocks,reflexes:previousScene.reflexes??[]}:null,
    previousExperimentResult,
    behavioralObservation:behavior,
    recordedStrategyHistory:memory,
    previousStrategies: memory.map(m=>m.strategy),
    assignedTactic: {family:tactic.family,version:tactic.version,instruction:tactic.instruction},
    previousHeadline: memory.at(-1)?.headline ?? BASE_MUTATION.headline
  };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), engineVersion==='pd12d-v1'?15000:12000);
    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',signal:controller.signal,
        headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
        body:JSON.stringify({model:process.env.OPENAI_MODEL || 'gpt-4.1-mini',max_completion_tokens:engineVersion==='pd12d-v1'?4200:3300,response_format:{type:'json_object'},
          messages:[{role:'system',content:SYSTEM+(creative?'\n'+creativeInstruction:'')+(patchInstruction?'\n'+patchInstruction:'')+(reflexInstruction?'\n'+reflexInstruction:'')+(strategyInstruction?'\n'+strategyInstruction:'')},{role:'user',content:JSON.stringify(input)}]})
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
    const modelData=typeof raw === 'string' ? JSON.parse(raw) : null;
    let proposed=modelData;
    if(['pd12b-v1','pd12c-v1','pd12d-v1'].includes(engineVersion)&&modelData&&typeof modelData==='object'&&modelData.scenePatch!==undefined){
      const resolved=applyPagePatch(previousScene,modelData.scenePatch);
      proposed=resolved?{...modelData,scene:resolved.scene,scenePatch:resolved.patch}:null;
    }
    const mutation = validateMutation(proposed);
    if (!mutation || (['pd12c-v1','pd12d-v1'].includes(engineVersion)&&!mutation?.scene?.reflexes?.length) || (creative&&(!validateCreativeMutation(mutation)||
      (['pd12b-v1','pd12c-v1','pd12d-v1'].includes(engineVersion)&&mutation.scenePatch ?
        JSON.stringify(mutation.scene)===JSON.stringify(previousScene) :
        !isStructurallyNovel(mutation,memory.at(-1)))))) { console.error('[pdnrh:mutation] invalid_model_output_or_missing_scene'); return NextResponse.json({mutation:fallback,source:'fallback',fallbackReason:'invalid_model_output'},{headers:{'Cache-Control':'no-store'}}); }
    if(engineVersion==='pd12d-v1'){
      if(!mutation.plan||!directive|| (directive.pivotRequired&&
        mutation.plan.approach===directive.avoidApproach)){
        console.error('[pdnrh:strategy] missing_plan_or_required_pivot');
        return NextResponse.json({mutation:fallback,source:'fallback',
          fallbackReason:'invalid_strategy_plan'},{headers:{'Cache-Control':'no-store'}});
      }
      const nextState=commitStrategy(previousStrategy,mutation.plan,directive);
      try{
        const sql=db();
        const stored=await sql`INSERT INTO session_strategy_state(session_id,revision,state)
          SELECT ${sessionId}::uuid,${nextState.cycle},${JSON.stringify(nextState)}::jsonb
          WHERE EXISTS(SELECT 1 FROM sessions WHERE id=${sessionId} AND status='active')
          ON CONFLICT(session_id) DO UPDATE SET
            revision=EXCLUDED.revision,state=EXCLUDED.state,updated_at=now()
          WHERE session_strategy_state.revision<EXCLUDED.revision RETURNING revision`;
        if(!stored.length)return NextResponse.json({mutation:fallback,source:'fallback',
          fallbackReason:'strategy_session_ended'},{headers:{'Cache-Control':'no-store'}});
      }catch{
        console.error('[pdnrh:strategy] persistence_unavailable');
        return NextResponse.json({mutation:fallback,source:'fallback',
          fallbackReason:'strategy_persistence_unavailable'},{headers:{'Cache-Control':'no-store'}});
      }
    }
    return NextResponse.json({mutation,source:'model'},{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'provider_timeout' : 'provider_exception';
    console.error('[pdnrh:mutation]',reason, error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({mutation:fallback,source:'fallback',fallbackReason:reason},{headers:{'Cache-Control':'no-store'}});
  }
}
