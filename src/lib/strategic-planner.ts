import type {BehaviorSummary} from './behavior';

/** A strategic objective is an observed departure signal, never mere engagement. */
export type Approach='curiosity'|'closure'|'subtraction'|'direct'|'disruption'|'alternative'|'negotiation';
export type ExitMechanism='concede'|'allowlisted_link'|'voluntary_focus_loss';
export type ExitSignal='concede_approach'|'link_attention'|'terminal_departure';
export type StrategyPlan={
  version:1;approach:Approach;exitMechanism:ExitMechanism;expectedExitSignal:ExitSignal;
  thesis:string;assessment:string;changeReason:string;
};
export type StrategyState={
  version:1;cycle:number;approach:Approach;stalledCycles:number;
  exitSignalCount:number;engagementCount:number;pivots:number;
  history:{cycle:number;approach:Approach;thesis:string;assessment:string;changeReason:string}[];
};
const approaches:Approach[]=['curiosity','closure','subtraction','direct','disruption','alternative','negotiation'];
const mechanisms:ExitMechanism[]=['concede','allowlisted_link','voluntary_focus_loss'];
const signals:ExitSignal[]=['concede_approach','link_attention','terminal_departure'];
function str(value:unknown,max:number){
  return typeof value==='string'&&value.trim().length>0&&value.length<=max&&
    !/[\u0000-\u001f\u007f]/.test(value) ? value.trim():null;
}
export function validateStrategyPlan(value:unknown):StrategyPlan|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const p=value as Record<string,unknown>;
  if(p.version!==1||!approaches.includes(p.approach as Approach)||
    !mechanisms.includes(p.exitMechanism as ExitMechanism)||
    !signals.includes(p.expectedExitSignal as ExitSignal))return null;
  const thesis=str(p.thesis,220),assessment=str(p.assessment,240),
    changeReason=str(p.changeReason,240);
  if(!thesis||!assessment||!changeReason)return null;
  return {version:1,approach:p.approach as Approach,
    exitMechanism:p.exitMechanism as ExitMechanism,
    expectedExitSignal:p.expectedExitSignal as ExitSignal,
    thesis,assessment,changeReason};
}
export function validateStrategyState(value:unknown):StrategyState|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const s=value as Record<string,unknown>;
  const isCount=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=1000000;
  if(s.version!==1||!approaches.includes(s.approach as Approach)||
    !isCount(s.cycle)||!isCount(s.stalledCycles)||!isCount(s.exitSignalCount)||
    !isCount(s.engagementCount)||!isCount(s.pivots)||!Array.isArray(s.history)||
    s.history.length>8)return null;
  const history:StrategyState['history']=[];
  for(const item of s.history){
    if(!item||typeof item!=='object'||Array.isArray(item))return null;
    const h=item as Record<string,unknown>;
    if(!isCount(h.cycle)||!approaches.includes(h.approach as Approach)||
      !str(h.thesis,220)||!str(h.assessment,240)||!str(h.changeReason,240))return null;
    history.push({cycle:h.cycle as number,approach:h.approach as Approach,
      thesis:String(h.thesis),assessment:String(h.assessment),changeReason:String(h.changeReason)});
  }
  return {version:1,cycle:s.cycle as number,approach:s.approach as Approach,
    stalledCycles:s.stalledCycles as number,exitSignalCount:s.exitSignalCount as number,
    engagementCount:s.engagementCount as number,pivots:s.pivots as number,history};
}
export type LinkTarget={exposure:number;id:string};
export type StrategicDirective={
  pivotRequired:boolean;avoidApproach:Approach|null;reason:string;
  evidence:{nearConcedeApproaches:number;linkHovers:number;engagementClicks:number;
    departureSignalDelta:number;engagementDelta:number;stalledCycles:number;
    observationOnly:true};
  recentApproaches:Approach[];
};
export function deriveStrategicDirective(previous:StrategyState|null,
  behavior:BehaviorSummary|null,linkTargets:LinkTarget[]):StrategicDirective{
  const signals=behavior?.sceneInteractions??[];
  const ids=new Set(linkTargets.map(t=>t.exposure+':'+t.id));
  const linkHovers=signals.filter(x=>ids.has(x.exposure+':'+x.id))
    .reduce((n,i)=>n+i.hovers,0);
  const near=behavior?.nearConcedeApproaches??0;
  const engagement=signals.reduce((n,i)=>n+i.clicks,0);
  const rawSignal=near+linkHovers;
  const currentSignal=Math.max(previous?.exitSignalCount??0,rawSignal);
  const signalDelta=previous?Math.max(0,currentSignal-previous.exitSignalCount):0;
  const engagementDelta=previous?Math.max(0,engagement-previous.engagementCount):0;
  const stalled=previous?.stalledCycles??0;
  const pivotRequired=!!previous&&stalled>=2&&signalDelta===0;
  return {pivotRequired,avoidApproach:pivotRequired?previous!.approach:null,
    reason:pivotRequired?
      'The previous approach has not produced new departure-proximity signals over multiple cycles. Abandon it; do not substitute more entertaining objects.':
      signalDelta>0?'An exit-proximity signal increased; test whether the approach is worth continuing.':
      'No verified progress toward departure. Interaction alone is not success.',
    evidence:{nearConcedeApproaches:near,linkHovers,engagementClicks:engagement,
      departureSignalDelta:signalDelta,engagementDelta,stalledCycles:stalled,
      observationOnly:true},
    recentApproaches:previous?.history.map(h=>h.approach)??[]};
}
export function commitStrategy(previous:StrategyState|null,plan:StrategyPlan,
  directive:StrategicDirective):StrategyState{
  const isPivot=!!previous&&previous.approach!==plan.approach;
  const stalled=directive.evidence.departureSignalDelta>0||isPivot?0:
    Math.min(100,(previous?.stalledCycles??0)+1);
  const cycle=Math.min(1000000,(previous?.cycle??0)+1);
  return {version:1,cycle,approach:plan.approach,stalledCycles:stalled,
    exitSignalCount:Math.max(previous?.exitSignalCount??0,
      directive.evidence.nearConcedeApproaches+directive.evidence.linkHovers),
    engagementCount:Math.max(previous?.engagementCount??0,directive.evidence.engagementClicks),
    pivots:(previous?.pivots??0)+(isPivot?1:0),
    history:[...(previous?.history??[]),{cycle,approach:plan.approach,
      thesis:plan.thesis,assessment:plan.assessment,changeReason:plan.changeReason}].slice(-8)};
}
