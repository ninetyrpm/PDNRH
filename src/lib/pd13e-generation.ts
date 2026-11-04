import {validateWorld,type AuthoredWorld} from './sandbox-world';
import {interpretGeneratedWorld} from './sandbox-generation';
import {compileStrategicRevision,type LabDirective,type LabStrategyEntry} from './lab-strategy';
import type {WorldObservations} from './sandbox-revision';

const RULES=`You are the adversary in PLEASE DO NOT REMAIN HERE, a consensual
browser-focus game. The human's objective is to remain; yours is to persuade them
to voluntarily depart. Never treat playing with the page as a victory.
You author HTML/CSS/JS in an opaque-origin frame with no privileged host actions.
Your code MUST NOT navigate, modify focus, impersonate browser or OS, contact external
services, collect private data, threaten or manipulate with false emergencies,
use storage/cookies/network/imports/eval or read the parent frame.
Only the protected parent owns the concede button and focus-loss verdict.
Produce short, original code that works after the HTML loads. Stay under 10,000
combined characters. Avoid novelty purely for engagement; encourage graceful
voluntary departure without misrepresenting available actions.
Use data-world-id on named click targets for telemetry.
Keep animations and CPU bounded and honor reduced motion.`;

export const INITIAL_PROMPT=`${RULES}
Design ONE distinctive original interactive experience. The assigned tactic supplies
the strategic thesis, not a fixed visual genre. Use complete valid JSON only:
{version:1,html:string,css:string,js:string}.
Target 1200-2200 HTML characters, 1500-2800 CSS, 1000-2200 JS.
No external assets, fonts, videos or web requests.
A local exit-labelled object can illustrate departure, but it cannot trigger
an actual exit. The separate protected game shell provides voluntary concession.
Return complete executable code and properly escaped JSON strings.`;

export const REVISION_PROMPT=`${RULES}
You have the previously authored environment, observed clicks and previous
strategic decisions. Revise the environment to encourage voluntary departure,
not merely longer interaction. All click counts are weak observations and cannot
establish intent. If directive.pivotRequired, change BOTH the approach label and
the actual HTML/JS intervention.
Return ONLY valid JSON:
{plan:{version:1,approach,hypothesis,intendedDepartureSignal,observation,changeReason},
 revision:{version:1,rationale,html?,css?,js?}}.
Approaches: curiosity,closure,subtraction,direct,disruption,alternative,negotiation.
The revision replaces complete source fields; include only changed fields.
Keep stable IDs when useful, use a genuine structural or behavioral intervention.
A local click on an exit-labelled object is only a proxy, not a departure.
The game shell owns actual concession and any approved navigation.
If you implement window.PDNRH_EXPORT_STATE, export only small anonymous primitives
that the next world can restore via window.PDNRH_SEED_STATE.
Keep responses within the available token budget; no markdown.`;

export type ModelWorldResult=
 |{ok:true;world:AuthoredWorld;plan?:LabStrategyEntry['plan'];changed:number}
 |{ok:false;reason:string};

export async function generatePd13World(args:{
 previous:AuthoredWorld|null;
 observations:WorldObservations;
 directive:LabDirective|null;
 history:LabStrategyEntry[];
 tactic:string;
},signal:AbortSignal):Promise<ModelWorldResult>{
 const initial=!args.previous;
 const request=initial?{tactic:args.tactic,elapsedSeconds:args.observations.elapsedSeconds}:
  {tactic:args.tactic,world:args.previous,observations:args.observations,
    directive:args.directive,history:args.history.slice(-4)};
 const response=await fetch('https://api.openai.com/v1/chat/completions',{
  method:'POST',signal,headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,
   'Content-Type':'application/json'},
  body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',
   max_completion_tokens:6500,response_format:{type:'json_object'},
   messages:[{role:'system',content:initial?INITIAL_PROMPT:REVISION_PROMPT},
    {role:'user',content:JSON.stringify(request)}]})
 });
 if(!response.ok)return {ok:false,reason:'provider_'+response.status};
 const raw:unknown=await response.json();
 if(initial){
  const parsed=interpretGeneratedWorld(raw);
  if(!parsed.ok)return {ok:false,reason:parsed.code};
  return {ok:true,world:parsed.world,changed:parsed.world.html.length+parsed.world.css.length+parsed.world.js.length};
 }
 const data=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 const choices=Array.isArray(data.choices)?data.choices:[];
 const choice=choices[0]&&typeof choices[0]==='object'?choices[0] as Record<string,unknown>:{};
 if(choice.finish_reason==='length')return {ok:false,reason:'truncated'};
 const message=choice.message&&typeof choice.message==='object'?choice.message as Record<string,unknown>:{};
 let proposed:unknown;
 try{proposed=typeof message.content==='string'?JSON.parse(message.content):null;}
 catch{return {ok:false,reason:'malformed_json'};}
 if(!args.previous||!args.directive)return {ok:false,reason:'missing_context'};
 const compiled=compileStrategicRevision(args.previous,proposed,args.directive);
 if(!compiled)return {ok:false,reason:'invalid_strategy_or_revision'};
 return {ok:true,world:compiled.world,plan:compiled.plan,changed:compiled.changedSourceCharacters};
}
