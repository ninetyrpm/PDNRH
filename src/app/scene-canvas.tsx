'use client';
import {useEffect,useRef,useState} from 'react';
import type {PageScene,SceneBlock,SceneReflex} from '@/lib/scene';
import {advanceReflexes,type ReflexCounts,type ReflexTrigger} from '@/lib/reflex';
import {DEPARTURE_URL} from '@/lib/departure';

type Reaction={effect:SceneReflex['effect'];replacement?:string};
export default function SceneCanvas({scene,onConcede,onNavigate,readOnly=false,onInteraction,onReflex,exposure=0}:{
  scene:PageScene;onConcede?:()=>void;onNavigate?:()=>void;readOnly?:boolean;exposure?:number;
  onInteraction?:(id:string,type:'hover'|'click')=>void;
  onReflex?:(ruleId:string)=>void;
}){
  const [revealed,setRevealed]=useState<Record<string,boolean>>({});
  const [reactions,setReactions]=useState<Record<string,Reaction>>({});
  const [reflexText,setReflexText]=useState<Record<string,string>>({});
  const counters=useRef<ReflexCounts>({});
  const fired=useRef<Set<string>>(new Set());
  const near=useRef<Set<string>>(new Set());
  const lastActivity=useRef(0);

  useEffect(()=>{
    counters.current={};fired.current=new Set();near.current=new Set();
    lastActivity.current=Date.now();setReactions({});setReflexText({});
  },[exposure]);

  function reactTo(trigger:ReflexTrigger,targetId?:string,idleSeconds?:number){
    if(readOnly||!scene.reflexes?.length)return;
    const outcome=advanceReflexes(scene.reflexes,{trigger,targetId,idleSeconds},
      counters.current,fired.current);
    counters.current=outcome.counts;
    for(const rule of outcome.activated){
      fired.current.add(rule.id);
      if(rule.effect==='reveal'){
        setRevealed(prev=>({...prev,[rule.targetId]:true}));
        if(rule.text)setReflexText(prev=>({...prev,[rule.targetId]:rule.text}));
      }else{
        setReactions(prev=>({...prev,[rule.targetId]:{
          effect:rule.effect,...(rule.effect==='replace'?{replacement:rule.text}:{})
        }}));
      }
      onReflex?.(rule.id);
    }
  }

  useEffect(()=>{
    if(readOnly||!scene.reflexes?.some(r=>r.trigger==='idle'))return;
    const activity=()=>{lastActivity.current=Date.now();};
    document.addEventListener('pointermove',activity,{passive:true});
    document.addEventListener('scroll',activity,{passive:true});
    document.addEventListener('keydown',activity);
    const timer=window.setInterval(()=>{
      if(!document.hidden&&document.hasFocus())
        reactTo('idle',undefined,(Date.now()-lastActivity.current)/1000);
    },500);
    return()=>{
      window.clearInterval(timer);
      document.removeEventListener('pointermove',activity);
      document.removeEventListener('scroll',activity);
      document.removeEventListener('keydown',activity);
    };
  // Reactive rules are immutable within a scene; exposure resets their counters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[readOnly,exposure,scene.reflexes]);

  function onMove(e:React.PointerEvent<HTMLDivElement>){
    if(readOnly||!scene.reflexes)return;
    const x=e.clientX,y=e.clientY;
    for(const rule of scene.reflexes){
      if(rule.trigger!=='near'||fired.current.has(rule.id))continue;
      const element=e.currentTarget.querySelector('[data-scene-block="'+rule.targetId+'"]');
      if(!element)continue;
      const rect=element.getBoundingClientRect();
      const distance=Math.hypot(Math.max(rect.left-x,0,x-rect.right),
        Math.max(rect.top-y,0,y-rect.bottom));
      const inside=distance<=72;
      if(inside&&!near.current.has(rule.id))reactTo('near',rule.targetId);
      if(inside)near.current.add(rule.id);
      else near.current.delete(rule.id);
    }
  }

  function activate(block:SceneBlock){
    if(readOnly)return;
    if(block.action==='concede'){onConcede?.();return;}
    if(block.action==='reveal'||block.action==='toggle')
      setRevealed(prev=>({...prev,[block.id]:block.action==='reveal'?true:!prev[block.id]}));
  }

  return <div className={['pd-scene','pd-scene-'+scene.composition,'pd-accent-'+scene.accent].join(' ')}
    aria-label="Adversary-authored page" onPointerMove={onMove}>
    {scene.blocks.map(block=>{
      const reaction=reactions[block.id];
      const text=reaction?.effect==='replace'?reaction.replacement??block.text:block.text;
      const classes=['pd-block','pd-kind-'+block.kind,'pd-size-'+block.size,
        'pd-align-'+block.align,'pd-effect-'+block.effect,
        reaction?'pd-reflex-'+reaction.effect:''].join(' ');
      return <div key={block.id} data-scene-block={block.id}
        onPointerEnter={()=>{if(!readOnly){onInteraction?.(block.id,'hover');reactTo('hover',block.id);}}}
        onClick={()=>{if(!readOnly&&block.kind!=='link'){onInteraction?.(block.id,'click');reactTo('click',block.id);}}}
        className={classes}>
        {block.kind==='rule'?<hr/>:
         block.kind==='void'?<div className="pd-void" aria-label={text}><span>{text}</span></div>:
         block.kind==='meter'?<div className="pd-meter"><span>{text}</span><div className="pd-meter-track"><div/></div></div>:
         block.kind==='marquee'?<div className="pd-marquee"><span>{text}</span></div>:
         block.kind==='link'?<div className="pd-outbound">
           {readOnly?<span className="pd-outbound-inactive">{text}</span>:
           <a href={DEPARTURE_URL} className="pd-outbound-link" onClick={event=>{
             if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){
               onInteraction?.(block.id,'click');reactTo('click',block.id);onNavigate?.();
             }
           }}>{text}</a>}
         </div>:
         block.kind==='button'?<button type="button" disabled={readOnly&&block.action!=='none'}
           data-pdnrh-concede={block.action==='concede'?'true':undefined}
           onClick={()=>activate(block)}>{text}</button>:
         block.kind==='heading'?<h2>{text}</h2>:
         block.kind==='panel'?<div className="pd-panel">{text}</div>:
         block.kind==='paragraph'?<p>{text}</p>:
         block.kind==='glyph'?<div className="pd-glyph" aria-label={text}>{text}</div>:
         <span>{text}</span>}
        {revealed[block.id]&&(block.detail||reflexText[block.id])&&
          <p className="pd-revealed">{reflexText[block.id]||block.detail}</p>}
      </div>;
    })}
  </div>;
}
