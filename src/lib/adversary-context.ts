import { validateBehavior, type BehaviorSummary } from './behavior';
import { validateMutation } from './mutation';

type ExposureRow=Record<string,unknown>;
type HeartbeatRow=Record<string,unknown>;
export function recentStrategyMemory(rows:ExposureRow[]){
  return rows.slice(0,4).reverse().flatMap(row=>{
    const mutation=validateMutation(row.mutation);
    return mutation?[{
      ordinal:Number(row.ordinal),strategy:mutation.strategy,
      headline:mutation.headline,hypothesis:mutation.hypothesis??null,
      composition:mutation.scene?.composition??null,
      expectedReaction:mutation.expectedReaction??null,
      experiment:mutation.experiment??null,
      plan:mutation.plan??null,
      sceneReflexes:mutation.scene?.reflexes?.map(r=>({id:r.id,targetId:r.targetId,trigger:r.trigger,effect:r.effect}))??[],
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
  const byKey=new Map((previous?.sceneInteractions??[]).map(i=>[i.exposure+':'+i.id,i]));
  const componentChanges=(current?.sceneInteractions??[]).map(i=>({
    exposure:i.exposure,id:i.id,
    newHovers:Math.max(0,i.hovers-(byKey.get(i.exposure+':'+i.id)?.hovers??0)),
    newClicks:Math.max(0,i.clicks-(byKey.get(i.exposure+':'+i.id)?.clicks??0))
  })).filter(i=>i.newHovers>0||i.newClicks>0).slice(-20);
  const previousReflexes=new Map((previous?.reflexEvents??[]).map(e=>[e.exposure+':'+e.id,e.count]));
  const reflexChanges=(current?.reflexEvents??[]).map(e=>({exposure:e.exposure,id:e.id,
    newActivations:Math.max(0,e.count-(previousReflexes.get(e.exposure+':'+e.id)??0))}))
    .filter(e=>e.newActivations>0).slice(-20);
  return {
    version:1, current, sinceLastHeartbeat:previous?change:null,
    reflexChangesSinceLastHeartbeat:previous?reflexChanges:null,
    componentChangesSinceLastHeartbeat:previous?componentChanges:null,
    priorHeartbeatDelta:older?previousChange:null,
    previousElapsedMs:typeof recent[0]?.elapsedMs==='number'?recent[0].elapsedMs:null,
    note:'Aggregate client-reported activity; observation does not imply intent or emotion. No raw pointer positions or keypresses.'
  };
}
