import { validateBehavior, type BehaviorSummary } from './behavior';
import { validateMutation } from './mutation';

type ExposureRow={ordinal:unknown;mutation:unknown};
type HeartbeatRow={payload:unknown};
export function recentStrategyMemory(rows:ExposureRow[]){
  return rows.slice(0,4).reverse().flatMap(row=>{
    const mutation=validateMutation(row.mutation);
    return mutation?[{
      ordinal:Number(row.ordinal),strategy:mutation.strategy,
      headline:mutation.headline,hypothesis:mutation.hypothesis??null,
      expectedReaction:mutation.expectedReaction??null,
      sceneBlocks:mutation.scene?.blocks.map(b=>({id:b.id,kind:b.kind,action:b.action}))??[]
    }]:[];
  });
}
function asRecord(v:unknown):Record<string,unknown>{
  return v && typeof v==='object' && !Array.isArray(v)?v as Record<string,unknown>:{};
}
const fields=['pointerTravelPx','pointerReversals','nearConcedeApproaches','concedeClicks','scrollDown','scrollUp','scrollReversals'] as const;
export function behavioralContext(currentInput:unknown,heartbeatRows:HeartbeatRow[]){
  const current=validateBehavior(currentInput);
  const recent=heartbeatRows.map(r=>asRecord(r.payload)).filter(p=>validateBehavior(p.behavior));
  const previous=validateBehavior(recent[0]?.behavior);
  const older=validateBehavior(recent[1]?.behavior);
  const change:Partial<Record<keyof BehaviorSummary,number>>={};
  if(current&&previous)for(const key of fields){
    change[key]=Math.max(0,current[key]-previous[key]);
  }
  const previousChange:Partial<Record<keyof BehaviorSummary,number>>={};
  if(previous&&older)for(const key of fields){
    previousChange[key]=Math.max(0,previous[key]-older[key]);
  }
  return {
    version:1, current, sinceLastHeartbeat:previous?change:null,
    priorHeartbeatDelta:older?previousChange:null,
    previousElapsedMs:typeof recent[0]?.elapsedMs==='number'?recent[0].elapsedMs:null,
    note:'Aggregate client-reported activity; observation does not imply intent or emotion. No raw pointer positions or keypresses.'
  };
}
