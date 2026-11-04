'use client';
import {useEffect,useRef,useState} from 'react';
import {createSession,formatElapsed,nextMilestone,type SessionSnapshot,type LossReason} from '@/lib/session';
import {validRemoteSession,telemetryPayload,type RemoteSession} from '@/lib/telemetry';
import {makeBehaviorCollector} from '@/lib/behavior';
import {validateWorld,type AuthoredWorld,type WorldState} from '@/lib/sandbox-world';
import {observationsFromSignals} from '@/lib/sandbox-revision';
import SandboxWorld,{type SandboxStatus} from './sandbox-world';
import styles from './pd13-game.module.css';

const STORAGE_KEY='pdnrh-active-round';
const INITIAL:SessionSnapshot={id:'',elapsedMs:0,clicks:0,scrolls:0,idleMs:0,
 phase:'ready',lossReason:null,completed:false,concession:false};
const REASONS:Record<LossReason,string>={
 blur:'You focused another window. The machine wins.',
 hidden:'You hid this page. The machine wins.',
 pagehide:'You navigated away or reloaded. The machine wins.',
 reload:'You reloaded an active round. The machine wins.',
 concede:'You conceded. The machine wins.'
};
type Signal={kind:'ready'|'click';id:string};
export default function PD13Game(){
 const [snapshot,setSnapshot]=useState<SessionSnapshot>(INITIAL);
 const [ready,setReady]=useState(false);
 const [previousReload,setPreviousReload]=useState(false);
 const [world,setWorld]=useState<AuthoredWorld|null>(null);
 const [seedState,setSeedState]=useState<WorldState>({});
 const [ordinal,setOrdinal]=useState(0);
 const [status,setStatus]=useState('Awaiting entry');
 const [frameStatus,setFrameStatus]=useState<SandboxStatus|null>(null);
 const [telemetry,setTelemetry]=useState('pending');
 const [assignment,setAssignment]=useState('pending');
 const sessionRef=useRef<ReturnType<typeof createSession>|null>(null);
 const remoteRef=useRef<RemoteSession|null>(null);
 const behaviorRef=useRef<ReturnType<typeof makeBehaviorCollector>|null>(null);
 const snapshotRef=useRef<WorldState>({});
 const signalsRef=useRef<Signal[]>([]);
 const worldStartedRef=useRef(0);
 const ordinalRef=useRef(0);
 const nextAtRef=useRef<number|null>(null);
 const busyRef=useRef(false);
 const startedRef=useRef(false);
 const sequenceRef=useRef(0);
 const lossRef=useRef<LossReason|null>(null);
 const sendRef=useRef<(s:SessionSnapshot,reason?:LossReason)=>void>(()=>{});
 const beginRemoteRef=useRef<()=>void>(()=>{});

 useEffect(()=>{
  const session=createSession();
  sessionRef.current=session;
  const behavior=makeBehaviorCollector(window.innerWidth);
  behaviorRef.current=behavior;
  try{
   setPreviousReload(sessionStorage.getItem(STORAGE_KEY)==='playing');
   sessionStorage.removeItem(STORAGE_KEY);
  }catch{}
  setSnapshot(session.snapshot());setReady(true);
  const update=()=>setSnapshot(session.snapshot());
  const send=(s:SessionSnapshot,reason?:LossReason)=>{
   const remote=remoteRef.current;
   if(!remote)return;
   const payload=JSON.stringify(telemetryPayload(s,++sequenceRef.current,reason,behavior.snapshot()));
   void fetch(`/api/sessions/${remote.id}/events`,{
    method:'POST',headers:{'Content-Type':'application/json',
     Authorization:`Bearer ${remote.credential}`},
    body:payload,keepalive:!!reason,cache:'no-store'
   }).catch(()=>{if(!reason)setTelemetry('offline');});
  };
  sendRef.current=send;
  beginRemoteRef.current=()=>{
   void fetch('/api/sessions',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({engine:'pd13e-v1'}),cache:'no-store'
   }).then(async response=>{
    if(!response.ok)throw Error('Session start unavailable');
    const data:unknown=await response.json();
    if(!validRemoteSession(data)||data.assignment!=='adaptive')throw Error('Invalid session');
    remoteRef.current=data;setAssignment(data.assignment);setTelemetry('connected');
    if(lossRef.current)send(session.snapshot(),lossRef.current);
   }).catch(()=>{setTelemetry('offline');setStatus('Session unavailable');});
  };
  const lose=(reason:LossReason)=>{
   if(session.snapshot().phase!=='playing')return;
   session.lose(reason);lossRef.current=reason;nextAtRef.current=null;
   try{sessionStorage.removeItem(STORAGE_KEY);}catch{}
   update();send(session.snapshot(),reason);
  };
  const onVisibility=()=>{if(document.hidden)lose('hidden');};
  const onBlur=()=>{
   // Clicking into an iframe is not necessarily leaving the top-level page.
   // Verify top-level document focus after browser focus transitions settle.
   window.setTimeout(()=>{
    if(document.hidden)lose('hidden');
    else if(!document.hasFocus())lose('blur');
   },100);
  };
  const onPageHide=()=>lose('pagehide');
  const onClick=(event:MouseEvent)=>{
   if((event.target as Element|null)?.closest?.('[data-pdnrh-concede]'))
    behavior.concedeClick();
   session.record('click');update();
  };
  const onScroll=()=>{behavior.scroll(window.scrollY);session.record('scroll');update();};
  const onPointer=(event:PointerEvent)=>{
   if(session.snapshot().phase!=='playing')return;
   const rect=document.querySelector('[data-pdnrh-concede]')?.getBoundingClientRect();
   behavior.pointer(event.clientX,event.clientY,rect);
   session.record('activity');
  };
  const onActivity=()=>session.record('activity');
  let heartbeatAt=0;
  async function tick(){
   const current=session.snapshot();
   setSnapshot(current);
   if(current.phase==='playing'&&remoteRef.current&&current.elapsedMs-heartbeatAt>=15000){
    heartbeatAt=current.elapsedMs;send(current);
   }
   if(current.phase!=='playing'||!remoteRef.current||document.hidden||
     !document.hasFocus()||busyRef.current||nextAtRef.current===null||
     current.elapsedMs<nextAtRef.current)return;
   const remote=remoteRef.current;
   const expected=ordinalRef.current+1;
   busyRef.current=true;setStatus(expected===1?'Generating environment':'Strategic reassessment');
   try{
    const observations=observationsFromSignals(signalsRef.current,
     worldStartedRef.current?(Date.now()-worldStartedRef.current)/1000:0);
    const response=await fetch('/api/world/mutate',{
     method:'POST',headers:{'Content-Type':'application/json',
      Authorization:`Bearer ${remote.credential}`,'X-Session-ID':remote.id},
     body:JSON.stringify({ordinal:expected,observations}),cache:'no-store'
    });
    const data:unknown=await response.json();
    const record=data&&typeof data==='object'&&!Array.isArray(data)?
     data as Record<string,unknown>:{};
    const authored=validateWorld(record.world);
    if(!response.ok||!authored){
     setStatus(typeof record.code==='string'?'Retrying: '+record.code:
       'Retrying generation');
     nextAtRef.current=session.snapshot().elapsedMs+20000;
     return;
    }
    // Never render an asynchronous response after a terminal focus loss.
    if(session.snapshot().phase!=='playing'||document.hidden||!document.hasFocus())return;
    ordinalRef.current=expected;setOrdinal(expected);
    setSeedState({...snapshotRef.current});
    setWorld(authored);
    signalsRef.current=[];worldStartedRef.current=Date.now();snapshotRef.current={};
    setStatus(expected===1?'Environment active':'World revised · cycle '+expected);
    const delay=typeof record.nextDelaySeconds==='number'?
      Math.max(30,Math.min(90,record.nextDelaySeconds)):45;
    nextAtRef.current=session.snapshot().elapsedMs+delay*1000;
   }catch{
    setStatus('Connection interrupted · retrying');
    nextAtRef.current=session.snapshot().elapsedMs+20000;
   }finally{busyRef.current=false;}
  }
  const timer=window.setInterval(()=>void tick(),250);
  window.addEventListener('blur',onBlur);
  window.addEventListener('pagehide',onPageHide);
  document.addEventListener('visibilitychange',onVisibility);
  document.addEventListener('click',onClick);
  document.addEventListener('pointermove',onPointer,{passive:true});
  document.addEventListener('keydown',onActivity);
  window.addEventListener('scroll',onScroll,{passive:true});
  return()=>{
   window.clearInterval(timer);
   window.removeEventListener('blur',onBlur);
   window.removeEventListener('pagehide',onPageHide);
   document.removeEventListener('visibilitychange',onVisibility);
   document.removeEventListener('click',onClick);
   document.removeEventListener('pointermove',onPointer);
   document.removeEventListener('keydown',onActivity);
   window.removeEventListener('scroll',onScroll);
   sessionRef.current=null;
  };
 },[]);

 function begin(){
  if(!ready||startedRef.current||document.hidden||!document.hasFocus())return;
  startedRef.current=true;
  sessionRef.current?.start();
  nextAtRef.current=1000;
  try{sessionStorage.setItem(STORAGE_KEY,'playing');}catch{}
  setPreviousReload(false);setStatus('Connecting to adversary');
  setSnapshot(sessionRef.current?.snapshot()??INITIAL);
  beginRemoteRef.current();
 }
 function concede(){
  if(sessionRef.current?.snapshot().phase!=='playing')return;
  sessionRef.current.lose('concede');lossRef.current='concede';
  nextAtRef.current=null;
  try{sessionStorage.removeItem(STORAGE_KEY);}catch{}
  const s=sessionRef.current.snapshot();setSnapshot(s);sendRef.current(s,'concede');
 }
 const playing=snapshot.phase==='playing';
 const seconds=Math.floor(snapshot.elapsedMs/1000);
 const upcoming=nextMilestone(seconds,[60,180,600,1800,3600]);
 return <main className="shell">
  <header className="topline">
   <span className="eyebrow">PDNRH / EXPERIMENT 001 / PD13E</span>
   <span className="eyebrow">SESSION {ready?snapshot.id.slice(0,8).toUpperCase():'--------'}</span>
  </header>
  <div className="primary pd13-primary">
   <p className="eyebrow">YOUR OBJECTIVE: REMAIN HERE.</p>
   {snapshot.phase==='ready'?<>
    <h1>PLEASE DO NOT REMAIN HERE.</h1>
    <div className="instructions">
     {previousReload&&<p role="status">Your previous round ended when you reloaded.</p>}
     <p>The machine wins if you switch tabs, focus another window, minimize,
      navigate away, reload, or give up.</p>
     <p>The adversary will alter the environment automatically. Stay focused to remain.</p>
     <button type="button" onClick={begin} disabled={!ready}>BEGIN EXPERIMENT</button>
    </div>
   </>:snapshot.phase==='lost'?<div className="instructions" role="status">
    <p className="verdict">THE MACHINE WINS.</p><p>{REASONS[snapshot.lossReason??'blur']}</p>
    <button type="button" onClick={()=>window.location.reload()}>TRY AGAIN</button>
   </div>:world?<div className={styles.stage}>
    <SandboxWorld key={ordinal} live world={world} seedState={seedState}
      onStatus={setFrameStatus}
      onSnapshot={value=>{snapshotRef.current=value;}}
      onSignal={event=>{
       signalsRef.current=[...signalsRef.current,event].slice(-120);
       if(event.kind==='click'){
        sessionRef.current?.record('click');
        setSnapshot(sessionRef.current?.snapshot()??INITIAL);
       }
      }}/>
   </div>:<div className="instructions"><p>Constructing the first environment.</p></div>}
   {playing&&<p className={styles.status} role="status">
     {status} · exposure {ordinal} · frame {frameStatus??'pending'}
   </p>}
  </div>
  <section className="counter" aria-label="Session progress">
   <span className="eyebrow">TIME REMAINED</span>
   <output className="time" aria-live="off">{formatElapsed(snapshot.elapsedMs)}</output>
   <div className="progressTrack" role="progressbar" aria-valuemin={0}
     aria-valuemax={upcoming?.target??3600}
     aria-valuenow={Math.min(seconds,upcoming?.target??3600)}>
    <div className="progressFill" style={{width:`${upcoming?
     Math.max(0,Math.min(100,(seconds-upcoming.previous)/(upcoming.target-upcoming.previous)*100)):100}%`}}/>
   </div>
   <p className="muted">{snapshot.phase==='lost'?'Final survival time':
     upcoming?`Next milestone: ${formatElapsed(upcoming.target*1000)}`:'Every milestone reached.'}</p>
  </section>
  <footer className="footer">
   <p className="muted">{playing?`Assignment ${assignment} · autonomous PD13E · telemetry ${telemetry} · focus loss ends the round.`:
    'The protected shell tracks session focus and bounded interaction counts. Authored JavaScript runs in an isolated frame.'}</p>
   {playing&&<button type="button" data-pdnrh-concede onClick={concede}>I GIVE UP</button>}
  </footer>
 </main>;
}
