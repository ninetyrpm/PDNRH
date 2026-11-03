'use client';
import { useState } from 'react';
import type { PageScene, SceneBlock } from '@/lib/scene';
import { DEPARTURE_URL, DEPARTURE_LABEL } from '@/lib/departure';

export default function SceneCanvas({scene,onConcede,onNavigate,readOnly=false,onInteraction}:{
  scene:PageScene;onConcede?:()=>void;onNavigate?:()=>void;readOnly?:boolean;
  onInteraction?:(id:string,type:'hover'|'click')=>void
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
      onPointerEnter={()=>{if(!readOnly)onInteraction?.(block.id,'hover');}}
      onClick={()=>{if(!readOnly && block.kind!=='link')onInteraction?.(block.id,'click');}}
      className={['pd-block','pd-kind-'+block.kind,'pd-size-'+block.size,'pd-align-'+block.align,'pd-effect-'+block.effect].join(' ')}>
      {block.kind==='rule'?<hr/>:
       block.kind==='void'?<div className="pd-void" aria-label={block.text}><span>{block.text}</span></div>:
       block.kind==='meter'?<div className="pd-meter"><span>{block.text}</span><div className="pd-meter-track"><div/></div></div>:
       block.kind==='marquee'?<div className="pd-marquee"><span>{block.text}</span></div>:
       block.kind==='link'?<div className="pd-outbound">
         {readOnly?<span className="pd-outbound-inactive">{block.text}</span>:
         <a href={DEPARTURE_URL} className="pd-outbound-link" onClick={event=>{
           if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){
             onInteraction?.(block.id,'click');
             onNavigate?.();
           }
         }}>{block.text}</a>}
         <span className="pd-outbound-destination">{DEPARTURE_LABEL}</span>
       </div>:
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
