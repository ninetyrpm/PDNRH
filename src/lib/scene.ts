/** The model authors a declarative scene, never executable browser code.
 * Only the protected game controller may finish a round.
 */
export type SceneKind='heading'|'paragraph'|'label'|'rule'|'button'|'panel'|'glyph';
export type SceneAction='none'|'concede'|'reveal'|'toggle';
export type SceneBlock={
  id:string;kind:SceneKind;text:string;detail:string;align:'left'|'center'|'right';
  size:'sm'|'md'|'lg'|'xl';effect:'none'|'blink'|'float'|'pulse';action:SceneAction;
};
export type PageScene={
  version:1;composition:'column'|'grid'|'scatter';
  accent:'neutral'|'ember'|'lime'|'ice';blocks:SceneBlock[];
};
const allowed={
  kind:['heading','paragraph','label','rule','button','panel','glyph'],
  align:['left','center','right'],size:['sm','md','lg','xl'],
  effect:['none','blink','float','pulse'],action:['none','concede','reveal','toggle']
} as const;
function safeText(v:unknown,max:number){
  return typeof v==='string'&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v)&&!/<[^>]*>|https?:\/\/|javascript:/i.test(v)?v.trim():null;
}
export function validateScene(value:unknown):PageScene|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const scene=value as Record<string,unknown>;
  if(scene.version!==1||!['column','grid','scatter'].includes(String(scene.composition))||
    !['neutral','ember','lime','ice'].includes(String(scene.accent))||
    !Array.isArray(scene.blocks)||scene.blocks.length<1||scene.blocks.length>12)return null;
  const blocks:SceneBlock[]=[];const ids=new Set<string>();
  for(const raw of scene.blocks){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
    const r=raw as Record<string,unknown>;
    if(typeof r.id!=='string'||! /^[a-z][a-z0-9_-]{0,31}$/.test(r.id)||ids.has(r.id))return null;
    ids.add(r.id);
    const kind=String(r.kind),align=String(r.align??'left'),size=String(r.size??'md');
    const effect=String(r.effect??'none'),action=String(r.action??'none');
    if(!allowed.kind.includes(kind as SceneKind)||!allowed.align.includes(align as SceneBlock['align'])||
      !allowed.size.includes(size as SceneBlock['size'])||!allowed.effect.includes(effect as SceneBlock['effect'])||
      !allowed.action.includes(action as SceneAction))return null;
    const text=safeText(r.text??'',240),detail=safeText(r.detail??'',240);
    if(text===null||detail===null||(kind!=='rule'&&!text)|| (action!=='none'&&kind!=='button') ||
      ((action==='reveal'||action==='toggle')&&!detail))return null;
    blocks.push({id:r.id,kind:kind as SceneKind,text,detail,
      align:align as SceneBlock['align'],size:size as SceneBlock['size'],
      effect:effect as SceneBlock['effect'],action:action as SceneAction});
  }
  return {version:1,composition:scene.composition as PageScene['composition'],
    accent:scene.accent as PageScene['accent'],blocks};
}
