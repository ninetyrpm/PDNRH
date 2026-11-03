import type {SceneReflex} from './scene';

export type ReflexTrigger=SceneReflex['trigger'];
export type ReflexCounts=Record<string,number>;
/** Pure, bounded, one-shot rule interpreter. Call only on events inside the experiment. */
export function advanceReflexes(
  rules:readonly SceneReflex[],
  event:{trigger:ReflexTrigger;targetId?:string;idleSeconds?:number},
  counts:ReflexCounts,
  fired:ReadonlySet<string>
):{counts:ReflexCounts;activated:SceneReflex[]}{
  const next={...counts};
  const activated:SceneReflex[]=[];
  for(const rule of rules){
    if(fired.has(rule.id)||rule.trigger!==event.trigger)continue;
    if(event.trigger!=='idle'&&rule.targetId!==event.targetId)continue;
    if(event.trigger==='idle'){
      if((event.idleSeconds??0)<rule.threshold)continue;
    }else{
      next[rule.id]=Math.min(100, (next[rule.id]??0)+1);
      if(next[rule.id]<rule.threshold)continue;
    }
    activated.push(rule);
  }
  return {counts:next,activated};
}
