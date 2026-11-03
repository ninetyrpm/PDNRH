/** Privacy-minimizing, aggregate-only first-party interaction observations.
 * Pointer coordinates are transient and never serialized or sent to the model.
 * No key presses, text content, identity, or cross-page data are collected.
 */
export type SceneInteraction = { exposure:number; id:string; hovers:number; clicks:number };
export type BehaviorSummary = {
  version: 1;
  pointerTravelPx: number;
  pointerReversals: number;
  nearConcedeApproaches: number;
  concedeClicks: number;
  scrollDown: number;
  scrollUp: number;
  scrollReversals: number;
  viewport: 'small'|'medium'|'large';
  sceneInteractions?:SceneInteraction[];
};
function boundedNumber(value: unknown, max: number) {
  return typeof value==='number' && Number.isFinite(value) && Number.isInteger(value) &&
    value>=0 && value<=max ? value : null;
}
export function validateBehavior(input: unknown): BehaviorSummary|null {
  if (!input || typeof input!=='object'||Array.isArray(input)) return null;
  const b=input as Record<string,unknown>;
  const names=['pointerTravelPx','pointerReversals','nearConcedeApproaches','concedeClicks','scrollDown','scrollUp','scrollReversals'] as const;
  const values=names.map(n=>boundedNumber(b[n],1000000));
  if(b.version!==1||values.some(v=>v===null)||!['small','medium','large'].includes(String(b.viewport))) return null;
  if(b.sceneInteractions!==undefined && (!Array.isArray(b.sceneInteractions)||b.sceneInteractions.length>48))return null;
  const sceneInteractions:SceneInteraction[]=[];
  if(Array.isArray(b.sceneInteractions))for(const item of b.sceneInteractions){
    if(!item||typeof item!=='object')return null;
    const record=item as Record<string,unknown>;
    const exposure=boundedNumber(record.exposure,10000);
    const hovers=boundedNumber(record.hovers,10000);
    const clicks=boundedNumber(record.clicks,10000);
    if(exposure===null||hovers===null||clicks===null||typeof record.id!=='string'||
      !/^[a-z][a-z0-9_-]{0,31}$/.test(record.id))return null;
    sceneInteractions.push({exposure,id:record.id,hovers,clicks});
  }
  return {
    version:1,pointerTravelPx:values[0]!,pointerReversals:values[1]!,
    nearConcedeApproaches:values[2]!,concedeClicks:values[3]!,
    scrollDown:values[4]!,scrollUp:values[5]!,scrollReversals:values[6]!,
    viewport:b.viewport as BehaviorSummary['viewport'],
    ...(b.sceneInteractions!==undefined?{sceneInteractions}: {})
  };
}
export function makeBehaviorCollector(viewportWidth:number){
  let lastPointer:{x:number;y:number}|null=null,lastVector:{x:number;y:number}|null=null;
  let distance=0,reversals=0,approaches=0,inside=false,concedeClicks=0;
  let scrollY:number|null=null,scrollUp=0,scrollDown=0,scrollReversals=0,lastScrollDirection=0;
  const sceneInteractions=new Map<string,SceneInteraction>();
  const viewport:BehaviorSummary['viewport']=viewportWidth<640?'small':viewportWidth<1100?'medium':'large';
  return {
    pointer(x:number,y:number,buttonRect?:{left:number;right:number;top:number;bottom:number}){
      if(lastPointer){
        const dx=x-lastPointer.x,dy=y-lastPointer.y,len=Math.hypot(dx,dy);
        if(len>=2 && len<600){
          distance=Math.min(1000000,distance+len);
          if(lastVector && dx*lastVector.x+dy*lastVector.y < -0.5*len*Math.hypot(lastVector.x,lastVector.y)) reversals=Math.min(1000000,reversals+1);
          lastVector={x:dx,y:dy};
        }
      }
      lastPointer={x,y};
      const near=!!buttonRect && x>=buttonRect.left-65&&x<=buttonRect.right+65&&y>=buttonRect.top-65&&y<=buttonRect.bottom+65;
      if(near&&!inside) approaches=Math.min(1000000,approaches+1);
      inside=near;
    },
    scroll(y:number){
      if(scrollY!==null){
        const change=y-scrollY;
        if(Math.abs(change)>=3){
          const direction=Math.sign(change);
          if(direction>0)scrollDown=Math.min(1000000,scrollDown+1);
          else scrollUp=Math.min(1000000,scrollUp+1);
          if(lastScrollDirection && direction!==lastScrollDirection)scrollReversals=Math.min(1000000,scrollReversals+1);
          lastScrollDirection=direction;
        }
      }
      scrollY=y;
    },
    concedeClick(){concedeClicks=Math.min(1000000,concedeClicks+1);},
    sceneEvent(exposure:number,id:string,type:'hover'|'click'){
      if(!Number.isSafeInteger(exposure)||exposure<1||exposure>10000||
        !/^[a-z][a-z0-9_-]{0,31}$/.test(id))return;
      const key=exposure+':'+id;
      if(!sceneInteractions.has(key)){
        if(sceneInteractions.size>=48)return;
        sceneInteractions.set(key,{exposure,id,hovers:0,clicks:0});
      }
      const item=sceneInteractions.get(key)!;
      if(type==='hover')item.hovers=Math.min(10000,item.hovers+1);
      if(type==='click')item.clicks=Math.min(10000,item.clicks+1);
    },
    snapshot():BehaviorSummary{
      return {version:1,pointerTravelPx:Math.min(1000000,Math.round(distance)),
        pointerReversals:reversals,nearConcedeApproaches:approaches,
        concedeClicks,scrollDown,scrollUp,scrollReversals,viewport,
        sceneInteractions:[...sceneInteractions.values()].map(i=>({...i}))};
    }
  };
}
