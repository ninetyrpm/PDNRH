'use client';
import { useState } from 'react';
import type { PageScene, SceneBlock } from '@/lib/scene';

export default function SceneCanvas({scene,onConcede,readOnly=false}:{
  scene:PageScene;onConcede?:()=>void;readOnly?:boolean
}){
  const [revealed,setRevealed]=useState<Record<string,boolean>>({});
  function activate(block:SceneBlock){
    if(readOnly)return;
    if(block.action==='concede'){onConcede?.();return;}
    if(block.action==='reveal'||block.action==='toggle')
      setRevealed(prev=>({...prev,[block.id]:block.action==='reveal'?true:!prev[block.id]}));
  }
  return <div className={['pd-scene','pd-scene-'+scene.composition,'pd-accent-'+scene.accent].join(' ')}
    aria-label="Adversary-authored page">
    {scene.blocks.map(block=><div key={block.id} data-scene-block={block.id}
      className={['pd-block','pd-kind-'+block.kind,'pd-size-'+block.size,'pd-align-'+block.align,'pd-effect-'+block.effect].join(' ')}>
      {block.kind==='rule'?<hr/>:
       block.kind==='button'?<button type="button" disabled={readOnly&&block.action!=='none'}
         data-pdnrh-concede={block.action==='concede'?'true':undefined}
         onClick={()=>activate(block)}>{block.text}</button>:
       block.kind==='heading'?<h2>{block.text}</h2>:
       block.kind==='panel'?<div className="pd-panel">{block.text}</div>:
       block.kind==='paragraph'?<p>{block.text}</p>:
       block.kind==='glyph'?<div className="pd-glyph" aria-label={block.text}>{block.text}</div>:
       <span>{block.text}</span>}
      {revealed[block.id]&&block.detail&&<p className="pd-revealed">{block.detail}</p>}
    </div>)}
  </div>;
}
