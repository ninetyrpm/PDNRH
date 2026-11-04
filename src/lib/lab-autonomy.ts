/** Autonomous generation remains an explicit, bounded administrator laboratory feature. */
export const AUTO_REVISION_DELAY_MS=45000;
export const AUTO_MAX_REVISIONS=4;
export const AUTO_MIN_OBSERVATION_SECONDS=35;

export function canAutonomouslyRevise(input:{
 running:boolean;visible:boolean;now:number;nextAt:number;
 completed:number;busy:boolean;worldReady:boolean;observedSeconds:number;
}):boolean{
 const {running,visible,now,nextAt,completed,busy,worldReady,observedSeconds}=input;
 return running&&visible&&!busy&&worldReady&&
  Number.isFinite(nextAt)&&now>=nextAt&&
  observedSeconds>=AUTO_MIN_OBSERVATION_SECONDS&&
  completed<AUTO_MAX_REVISIONS;
}

export function nextAutoRevisionAt(now:number):number{
 return now+AUTO_REVISION_DELAY_MS;
}
