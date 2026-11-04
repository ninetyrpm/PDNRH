import {validateWorld,type AuthoredWorld,WORLD_LIMITS} from './sandbox-world';

export type WorldRevision={version:1;html?:string;css?:string;js?:string;rationale:string};
export type WorldObservations={clicks:Record<string,number>;readyCount:number;elapsedSeconds:number};

export function validateObservations(input:unknown):WorldObservations|null{
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const o=input as Record<string,unknown>, raw=o.clicks;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const clicks:Record<string,number>={};
 const entries=Object.entries(raw);
 if(entries.length>24)return null;
 for(const [key,count] of entries){
  if(!/^[a-z][a-z0-9_-]{0,31}$/.test(key)||typeof count!=='number'||
    !Number.isSafeInteger(count)||count<0||count>120)return null;
  clicks[key]=count;
 }
 if(typeof o.readyCount!=='number'||!Number.isInteger(o.readyCount)||
   o.readyCount<0||o.readyCount>20||
   typeof o.elapsedSeconds!=='number'||!Number.isInteger(o.elapsedSeconds)||
   o.elapsedSeconds<0||o.elapsedSeconds>3600)return null;
 return {clicks,readyCount:o.readyCount,elapsedSeconds:o.elapsedSeconds};
}
/** A revision replaces only the specified source sections; omitted code is preserved. */
export function applyWorldRevision(previous:AuthoredWorld,input:unknown):
  {world:AuthoredWorld;revision:WorldRevision}|null{
 const base=validateWorld(previous);
 if(!base||!input||typeof input!=='object'||Array.isArray(input))return null;
 const raw=input as Record<string,unknown>;
 if(raw.version!==1||typeof raw.rationale!=='string'||!raw.rationale.trim()||
   raw.rationale.length>300||/[\u0000-\u001f]/.test(raw.rationale))return null;
 const changes:Partial<Pick<AuthoredWorld,'html'|'css'|'js'>>={};
 for(const key of ['html','css','js'] as const){
  if(raw[key]!==undefined){
   if(typeof raw[key]!=='string'||raw[key].length>WORLD_LIMITS[key])return null;
   changes[key]=raw[key] as string;
  }
 }
 if(!Object.keys(changes).length)return null;
 const world=validateWorld({...base,...changes});
 if(!world||(['html','css','js'] as const).every(key=>world[key]===base[key]))return null;
 return {world,revision:{version:1,...changes,rationale:raw.rationale.trim()}};
}
export function observationsFromSignals(signals:readonly {kind:'ready'|'click';id:string}[],
  elapsedSeconds:number):WorldObservations{
 const clicks:Record<string,number>={};
 let readyCount=0;
 for(const signal of signals.slice(-120)){
  if(signal.kind==='ready'){readyCount=Math.min(20,readyCount+1);continue;}
  if(signal.kind==='click'&&/^[a-z][a-z0-9_-]{0,31}$/.test(signal.id))
   clicks[signal.id]=Math.min(120,(clicks[signal.id]??0)+1);
 }
 return {clicks,readyCount,elapsedSeconds:Math.max(0,Math.min(3600,Math.floor(elapsedSeconds)))};
}
