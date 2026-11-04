'use client';
import {useRef,useState} from 'react';
import SandboxWorld from '../sandbox-world';
import styles from './lab.module.css';
import {validateWorld,type AuthoredWorld,type WorldState} from '@/lib/sandbox-world';
import {observationsFromSignals} from '@/lib/sandbox-revision';
import {validateLabPlan,type LabStrategyEntry,type LabDirective} from '@/lib/lab-strategy';

const example:AuthoredWorld={
 version:1,
 html:`<main id="room">
   <h1 data-world-id="headline">THE ROOM IS ALMOST EMPTY</h1>
   <p>Move your pointer through the room. The objects have noticed.</p>
   <div class="field">
     <div id="orb" class="orb" data-world-id="orb" tabindex="0" role="button" aria-label="Move the orb">◯</div>
     <span id="witness">I AM STILL HERE.</span>
   </div>
   <button data-world-id="reset" id="reset">RESET THE ROOM</button>
 </main>`,
 css:`body{overflow:hidden;background:radial-gradient(ellipse at 50% 30%,#243144,#080a0f 65%);color:#f5f4ed;font-family:monospace}
 #room{min-height:500px;padding:clamp(16px,6vw,50px);position:relative}
 h1{font-size:clamp(28px,6vw,70px);letter-spacing:-.065em;line-height:.93;max-width:700px}
 p{opacity:.6;font-size:13px;margin-top:25px}
 .field{height:270px;position:relative;overflow:hidden;border:1px dashed #566579;margin-top:40px}
 .orb{position:absolute;top:80px;left:40%;font-size:86px;color:#9deefc;cursor:pointer;transition:transform .35s ease;user-select:none;will-change:transform}
 #witness{position:absolute;bottom:10px;left:14px;opacity:.5;font-size:11px}
 button{margin-top:20px;color:inherit;background:transparent;border:1px solid currentColor;padding:13px;font:inherit;cursor:pointer}
 @media(prefers-reduced-motion:reduce){.orb{transition:none}}`,
 js:`const orb=document.getElementById('orb');
 let approaches=0,dx=0;
 orb.addEventListener('pointerenter',()=>{
   approaches++;
   dx=(approaches%2?1:-1)*Math.min(140,approaches*28);
   orb.style.transform='translateX('+dx+'px)';
   document.getElementById('witness').textContent=
     approaches>2?'YOU KEEP COMING BACK.':'I SAW THAT.';
 });
 orb.addEventListener('click',()=>{orb.style.transform='rotate(180deg) scale(.55)';});
 document.getElementById('reset').addEventListener('click',()=>{
   approaches=0;orb.style.transform='';document.getElementById('witness').textContent='I AM STILL HERE.';
 });`
};
export default function SandboxLab(){
 const [signals,setSignals]=useState<string[]>([]);
 const [world,setWorld]=useState<AuthoredWorld>(example);
 const [concept,setConcept]=useState('Invent a visually striking interactive environment that notices repeated visitor approaches and gradually changes its behavior.');
 const [generating,setGenerating]=useState(false);
 const [generationError,setGenerationError]=useState('');
 const [generationCount,setGenerationCount]=useState(0);
 const [seedState,setSeedState]=useState<WorldState>({});
 const snapshotRef=useRef<WorldState>({});
 const eventsRef=useRef<{kind:'ready'|'click';id:string}[]>([]);
 const worldStartedRef=useRef(Date.now());
 const [versions,setVersions]=useState<{world:AuthoredWorld;rationale:string;seed:WorldState}[]>([
  {world:example,rationale:'Fixture',seed:{}}
 ]);
 const [selected,setSelected]=useState(0);
 const [revising,setRevising]=useState(false);
 const [revisionError,setRevisionError]=useState('');
 const [strategizing,setStrategizing]=useState(false);
 const [strategyError,setStrategyError]=useState('');
 const [strategyHistory,setStrategyHistory]=useState<LabStrategyEntry[]>([]);
 const [lastDirective,setLastDirective]=useState<LabDirective|null>(null);
 async function strategize(){
  if(strategizing||revising||generating)return;
  setStrategizing(true);setStrategyError('');
  try{
   const observations=observationsFromSignals(eventsRef.current,
     (Date.now()-worldStartedRef.current)/1000);
   const response=await fetch('/api/sandbox-lab/strategize',{
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({world,observations,history:strategyHistory,direction:concept.slice(0,300)})
   });
   const payload:unknown=await response.json();
   const record=payload&&typeof payload==='object'&&!Array.isArray(payload)?
    payload as Record<string,unknown>:{};
   const next=validateWorld(record.world);
   const plan=validateLabPlan(record.plan);
   const directive=record.directive as LabDirective|undefined;
   const changed=record.changedSourceCharacters;
   if(!response.ok||!next||!plan||!directive||
      typeof changed!=='number'||!Number.isInteger(changed))
    throw Error(typeof record.error==='string'?record.error:'Invalid strategic world');
   const revision=record.revision&&typeof record.revision==='object'?
    record.revision as Record<string,unknown>:{};
   const rationale=typeof revision.rationale==='string'?revision.rationale:plan.changeReason;
   const seed={...snapshotRef.current};
   const nextVersions=[...versions.slice(0,selected+1),{world:next,rationale,seed}].slice(-8);
   setVersions(nextVersions);setSelected(nextVersions.length-1);
   setStrategyHistory(previous=>[...previous,{plan,exitProxyCount:directive.exitProxies,
     engagementCount:directive.engagementClicks,changedSourceCharacters:changed}].slice(-8));
   setLastDirective(directive);
   setSeedState(seed);setWorld(next);resetObservations();
  }catch(error){
   setStrategyError(error instanceof Error?error.message:'Strategic revision failed');
  }finally{setStrategizing(false);}
 }
 function resetObservations(){
  eventsRef.current=[];snapshotRef.current={};worldStartedRef.current=Date.now();
  setSignals([]);
 }
 async function revise(){
  if(revising||generating)return;
  setRevising(true);setRevisionError('');
  try{
   const observations=observationsFromSignals(eventsRef.current,
    (Date.now()-worldStartedRef.current)/1000);
   const response=await fetch('/api/sandbox-lab/revise',{
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({world,observations,direction:concept.slice(0,300)})
   });
   const data:unknown=await response.json();
   const record=data&&typeof data==='object'&&!Array.isArray(data)?
    data as Record<string,unknown>:{};
   const next=validateWorld(record.world);
   if(!response.ok||!next)throw Error(typeof record.error==='string'?
    record.error:'Revision was invalid');
   const revision=record.revision&&typeof record.revision==='object'?
    record.revision as Record<string,unknown>:{};
   const rationale=typeof revision.rationale==='string'?revision.rationale:'Model revision';
   const seed={...snapshotRef.current};
   const nextVersions=[...versions.slice(0,selected+1),{world:next,rationale,seed}].slice(-8);
   setVersions(nextVersions);setSelected(nextVersions.length-1);
   setSeedState(seed);setWorld(next);resetObservations();
   setStrategyHistory([]);setLastDirective(null);
  }catch(error){
   setRevisionError(error instanceof Error?error.message:'Revision failed');
  }finally{setRevising(false);}
 }
 function restoreVersion(index:number){
  if(index<0||index>=versions.length||revising||generating)return;
  setSelected(index);setWorld(versions[index].world);
  setSeedState(versions[index].seed);resetObservations();
  setStrategyHistory([]);setLastDirective(null);
 }
 async function generate(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(generating)return;
  setGenerating(true);setGenerationError('');
  try{
   const response=await fetch('/api/sandbox-lab/generate',{
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({concept})
   });
   const payload:unknown=await response.json();
   const record=payload&&typeof payload==='object'&&!Array.isArray(payload)?
      payload as Record<string,unknown>:{};
   const generated=validateWorld(record.world);
   if(!response.ok||!generated)throw Error(typeof record.error==='string'?
     record.error:'Model returned an invalid authored environment');
   setWorld(generated);setGenerationCount(value=>value+1);
   setVersions([{world:generated,rationale:'Generated world',seed:{}}]);
   setSelected(0);setSeedState({});resetObservations();
   setStrategyHistory([]);setLastDirective(null);
  }catch(error){
   setGenerationError(error instanceof Error?error.message:'Generation failed');
  }finally{setGenerating(false);}
 }
 return <main className={styles.pdLab}>
  <header><span>PDNRH / PD13D</span><span>ISOLATED STRATEGY LABORATORY</span></header>
  <h1>MODEL-AUTHORED ENVIRONMENT</h1>
  <p>Generate an original interactive artwork using the connected model, or explore the built-in fixture.
    Authored HTML, CSS and JavaScript run in an opaque-origin frame without network access.
    This lab is not connected to a live experiment.</p>
  <form onSubmit={generate} style={{maxWidth:850,marginBottom:25,display:'grid',gap:12}}>
    <label htmlFor="concept">Creative direction</label>
    <textarea id="concept" value={concept} maxLength={500} rows={3}
      onChange={event=>setConcept(event.target.value)}
      style={{background:'#171b21',color:'#eee',border:'1px solid #65707c',padding:12,font:'inherit'}}/>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
      <button type="submit" disabled={generating||concept.trim().length<5}>
        {generating?'GENERATING…':'GENERATE A WORLD'}
      </button>
      <button type="button" disabled={generating} onClick={()=>{
        setWorld(example);setGenerationError('');setGenerationCount(0);
        setVersions([{world:example,rationale:'Fixture',seed:{}}]);setSelected(0);
        setSeedState({});resetObservations();
        setStrategyHistory([]);setLastDirective(null);
      }}>RESTORE FIXTURE</button>
    </div>
    {generationError&&<p role="alert">{generationError}</p>}
    <small>{generationCount>0?'Model-authored world · ':'Local fixture · '}
      Generated code is untrusted and should not be used in a live round.</small>
  </form>
  <section style={{display:'grid',gap:12,marginBottom:20}}>
   <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
    <button type="button" disabled={generating||revising||strategizing||concept.trim().length<5}
      onClick={()=>void revise()}>
      {revising?'REVISING…':'REVISE CURRENT WORLD'}
    </button>
    <button type="button" disabled={generating||revising||strategizing||concept.trim().length<5}
      onClick={()=>void strategize()}>{strategizing?'STRATEGIZING…':'STRATEGIC REVISION'}</button>
    <span>Version {selected+1} / {versions.length}</span>
   </div>
   {revisionError&&<p role="alert">{revisionError}</p>}
   {strategyError&&<p role="alert">{strategyError}</p>}
   <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
    {versions.map((revision,index)=><button key={index} type="button"
      disabled={generating||revising||strategizing} aria-current={index===selected?'step':undefined}
      onClick={()=>restoreVersion(index)}>v{index+1}: {revision.rationale.slice(0,48)}</button>)}
   </div>
  </section>
  <section aria-label="Strategic revision history" style={{marginBottom:20}}>
   <h2>Strategic decisions</h2>
   <p>Observed clicks indicate engagement, not a persuasive victory.
     Exit-labelled controls in this lab are inert proxies.</p>
   {lastDirective&&<p>Prior observation: {lastDirective.explanation}</p>}
   {strategyHistory.length===0?<p>No strategic revisions yet.</p>:
    <ol>{strategyHistory.map((entry,index)=><li key={index}>
     <strong>{entry.plan.approach}</strong> · {entry.plan.hypothesis}
     <p>Observation: {entry.plan.observation}</p>
     <p>Intervention: {entry.plan.changeReason}</p>
     <small>Engagement clicks: {entry.engagementCount};
       exit-labelled clicks: {entry.exitProxyCount};
       source characters changed: {entry.changedSourceCharacters}</small>
    </li>)}</ol>}
  </section>
  <SandboxWorld world={world} seedState={seedState} onSnapshot={value=>{
    snapshotRef.current=value;
  }} onSignal={signal=>{
    eventsRef.current=[...eventsRef.current,signal].slice(-120);
    setSignals(previous=>[signal.kind+':'+signal.id,...previous].slice(0,12));
  }}/>
  <details style={{marginTop:20}}>
    <summary>Inspect current world source</summary>
    <p>HTML ({world.html.length} chars)</p>
    <pre style={{maxHeight:240,overflow:'auto'}}>{world.html}</pre>
    <p>CSS ({world.css.length} chars)</p>
    <pre style={{maxHeight:240,overflow:'auto'}}>{world.css}</pre>
    <p>JavaScript ({world.js.length} chars)</p>
    <pre style={{maxHeight:240,overflow:'auto'}}>{world.js}</pre>
  </details>
  <section><h2>Observed sandbox signals</h2>
   <p>Read-only interaction summaries; no privileged game actions are exposed.</p>
   <pre>{signals.join('\n')||'No sandbox activity recorded.'}</pre>
  </section>
  <footer>Experimental development surface. No live adversarial rounds use this runtime.</footer>
 </main>;
}
