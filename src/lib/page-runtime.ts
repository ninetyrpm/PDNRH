import {validateScene,type PageScene,type SceneBlock} from './scene';

/** Validated declarative patch language: no HTML, scripts, selectors, URLs or DOM access. */
export type PagePatchStep =
  | {op:'create';block:SceneBlock;beforeId?:string}
  | {op:'update';id:string;changes:Partial<Omit<SceneBlock,'id'>>}
  | {op:'delete';id:string}
  | {op:'move';id:string;beforeId?:string};
export type PagePatch={
  version:1;
  composition?:PageScene['composition'];
  accent?:PageScene['accent'];
  steps:PagePatchStep[];
};
const idPattern=/^[a-z][a-z0-9_-]{0,31}$/;
const mutable=['kind','text','detail','align','size','effect','action'];
function record(value:unknown):Record<string,unknown>|null{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
}
function validBlock(input:unknown):SceneBlock|null{
  const scene=validateScene({version:1,composition:'column',accent:'neutral',blocks:[input]});
  return scene?.blocks[0]??null;
}
export function validatePagePatch(value:unknown):PagePatch|null{
  const raw=record(value);
  if(!raw||raw.version!==1||!Array.isArray(raw.steps)||raw.steps.length<1||raw.steps.length>10)return null;
  const composition=raw.composition;
  if(composition!==undefined&&!['column','grid','scatter','poster','terminal','mosaic'].includes(String(composition)))return null;
  const accent=raw.accent;
  if(accent!==undefined&&!['neutral','ember','lime','ice'].includes(String(accent)))return null;
  const steps:PagePatchStep[]=[];
  for(const value of raw.steps){
    const step=record(value);
    if(!step)return null;
    const beforeId=step.beforeId;
    if(beforeId!==undefined&&(typeof beforeId!=='string'||!idPattern.test(beforeId)))return null;
    if(step.op==='create'){
      const block=validBlock(step.block);
      if(!block)return null;
      steps.push({op:'create',block,...(beforeId?{beforeId}: {})});
    }else if(step.op==='update'){
      if(typeof step.id!=='string'||!idPattern.test(step.id))return null;
      const changes=record(step.changes);
      if(!changes||!Object.keys(changes).length||Object.keys(changes).some(k=>!mutable.includes(k)))return null;
      steps.push({op:'update',id:step.id,changes:changes as Partial<Omit<SceneBlock,'id'>>});
    }else if(step.op==='delete'||step.op==='move'){
      if(typeof step.id!=='string'||!idPattern.test(step.id))return null;
      if(step.op==='delete')steps.push({op:'delete',id:step.id});
      else steps.push({op:'move',id:step.id,...(beforeId?{beforeId}: {})});
    }else return null;
  }
  return {version:1,...(composition?{composition:composition as PageScene['composition']}:{}),
    ...(accent?{accent:accent as PageScene['accent']}:{}),steps};
}
/** Atomic application. Any invalid reference or intermediate state rejects the full patch. */
export function applyPagePatch(base:PageScene|undefined,raw:unknown):{scene:PageScene;patch:PagePatch}|null{
  const patch=validatePagePatch(raw);
  if(!base||!patch)return null;
  let blocks=base.blocks.map(b=>({...b}));
  for(const step of patch.steps){
    if(step.op==='create'){
      if(blocks.some(b=>b.id===step.block.id)||blocks.length>=12)return null;
      const before=step.beforeId?blocks.findIndex(b=>b.id===step.beforeId):blocks.length;
      if(before<0)return null;
      blocks.splice(before,0,{...step.block});
    }else if(step.op==='update'){
      const i=blocks.findIndex(b=>b.id===step.id);
      if(i<0)return null;
      const merged=validBlock({...blocks[i],...step.changes,id:step.id});
      if(!merged)return null;
      blocks[i]=merged;
    }else if(step.op==='delete'){
      const i=blocks.findIndex(b=>b.id===step.id);
      if(i<0)return null;
      blocks.splice(i,1);
    }else {
      const i=blocks.findIndex(b=>b.id===step.id);
      if(i<0||step.beforeId===step.id)return null;
      const [block]=blocks.splice(i,1);
      const before=step.beforeId?blocks.findIndex(b=>b.id===step.beforeId):blocks.length;
      if(before<0)return null;
      blocks.splice(before,0,block);
    }
  }
  const scene=validateScene({version:1,composition:patch.composition??base.composition,
    accent:patch.accent??base.accent,blocks});
  return scene?{scene,patch}:null;
}
