import {validateWorld,type AuthoredWorld} from './sandbox-world';
import {applyWorldRevision,validateObservations,type WorldObservations,type WorldRevision} from './sandbox-revision';

export type LabApproach='curiosity'|'closure'|'subtraction'|'direct'|'disruption'|'alternative'|'negotiation';
export type LabPlan={version:1;approach:LabApproach;hypothesis:string;
  intendedDepartureSignal:string;observation:string;changeReason:string};
export type LabStrategyEntry={plan:LabPlan;exitProxyCount:number;engagementCount:number;changedSourceCharacters:number};
export type LabDirective={
  pivotRequired:boolean;avoidApproach:LabApproach|null;
  exitProxies:number;engagementClicks:number;stalledCycles:number;
  explanation:string;
};
const APPROACHES:LabApproach[]=['curiosity','closure','subtraction','direct','disruption','alternative','negotiation'];
const exitId=/^(exit|leave|depart|concede|outbound)(?:[_-].*)?$/i;
const phrase=(value:unknown,max:number)=>
 typeof value==='string'&&value.trim().length>0&&value.length<=max&&
 !/[\u0000-\u001f]/.test(value)?value.trim():null;

export function validateLabPlan(value:unknown):LabPlan|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const p=value as Record<string,unknown>;
 if(p.version!==1||!APPROACHES.includes(p.approach as LabApproach))return null;
 const hypothesis=phrase(p.hypothesis,240);
 const intendedDepartureSignal=phrase(p.intendedDepartureSignal,160);
 const observation=phrase(p.observation,240);
 const changeReason=phrase(p.changeReason,240);
 if(!hypothesis||!intendedDepartureSignal||!observation||!changeReason)return null;
 return {version:1,approach:p.approach as LabApproach,hypothesis,
   intendedDepartureSignal,observation,changeReason};
}
export function validateHistory(input:unknown):LabStrategyEntry[]|null{
 if(!Array.isArray(input)||input.length>8)return null;
 const results:LabStrategyEntry[]=[];
 for(const value of input){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const item=value as Record<string,unknown>;
  const plan=validateLabPlan(item.plan);
  const numbers=[item.exitProxyCount,item.engagementCount,item.changedSourceCharacters];
  if(!plan||numbers.some(v=>typeof v!=='number'||!Number.isInteger(v)||
     v<0||v>1000000))return null;
  results.push({plan,exitProxyCount:item.exitProxyCount as number,
   engagementCount:item.engagementCount as number,
   changedSourceCharacters:item.changedSourceCharacters as number});
 }
 return results;
}
export function summarizeLabDirective(history:LabStrategyEntry[],observations:WorldObservations):LabDirective{
 const clicks=Object.entries(observations.clicks);
 const exitProxies=clicks.filter(([id])=>exitId.test(id)).reduce((n,[,v])=>n+v,0);
 const engagementClicks=clicks.filter(([id])=>!exitId.test(id)).reduce((n,[,v])=>n+v,0);
 // Each world revision starts a fresh on-frame telemetry window.
 // A stagnant history is two or more revisions with zero exit-related signals.
 let stalledCycles=0;
 for(const item of history.slice().reverse()){
  if(item.exitProxyCount>0)break;
  stalledCycles++;
 }
 const pivotRequired=stalledCycles>=2&&exitProxies===0;
 return {pivotRequired,avoidApproach:pivotRequired?history.at(-1)?.plan.approach??null:null,
  exitProxies,engagementClicks,stalledCycles,
  explanation:pivotRequired?
    'Prior environments drew interaction without recorded clicks on exit-labelled controls. A substantively different intervention is required.':
    exitProxies>0?
    'An exit-labelled control was clicked. This is a weak departure-proximity proxy, not evidence of persuasion.':
    'No observed exit-labelled interaction. Exploration is engagement, not success.'};
}
/** Cheap conservative source-difference estimate, not a semantic comparison. */
export function changedSourceCharacters(before:AuthoredWorld,after:AuthoredWorld):number{
 let total=0;
 for(const key of ['html','css','js'] as const){
  const a=before[key],b=after[key];
  let prefix=0;
  while(prefix<Math.min(a.length,b.length)&&a[prefix]===b[prefix])prefix++;
  let suffix=0;
  while(suffix<Math.min(a.length,b.length)-prefix&&
    a[a.length-1-suffix]===b[b.length-1-suffix])suffix++;
  total+=Math.max(a.length-prefix-suffix,b.length-prefix-suffix);
 }
 return total;
}
export function compileStrategicRevision(before:AuthoredWorld,raw:unknown,directive:LabDirective):
 {world:AuthoredWorld;revision:WorldRevision;plan:LabPlan;changedSourceCharacters:number}|null{
 if(!validateWorld(before)||!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const value=raw as Record<string,unknown>;
 const plan=validateLabPlan(value.plan);
 const revised=applyWorldRevision(before,value.revision);
 if(!plan||!revised)return null;
 if(directive.pivotRequired&&plan.approach===directive.avoidApproach)return null;
 const changed=changedSourceCharacters(before,revised.world);
 // Pivot must alter the actual interaction program or materially change its representation.
 if(directive.pivotRequired&&
   ((before.js===revised.world.js&&before.html===revised.world.html)||changed<80))return null;
 return {...revised,plan,changedSourceCharacters:changed};
}
