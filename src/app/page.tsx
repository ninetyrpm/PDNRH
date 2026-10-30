'use client';
import { useEffect, useRef, useState } from 'react';
import { createSession, formatElapsed, nextMilestone, type SessionSnapshot, type LossReason } from '@/lib/session';
import { BASE_MUTATION, validateMutation, type PageMutation } from '@/lib/mutation';
import { validRemoteSession, telemetryPayload, type RemoteSession } from '@/lib/telemetry';

const THRESHOLDS = [60,180,600,1800,3600];
const STORAGE_KEY = 'pdnrh-active-round';
const INITIAL: SessionSnapshot = {id:'',elapsedMs:0,clicks:0,scrolls:0,idleMs:0,phase:'ready',lossReason:null,completed:false,concession:false};
const REASONS: Record<LossReason,string> = {
  blur:'You focused another window. The machine wins.',
  hidden:'You hid this page. The machine wins.',
  pagehide:'You navigated away or reloaded. The machine wins.',
  reload:'You reloaded an active round. The machine wins.',
  concede:'You conceded. The machine wins.'
};
export default function Home() {
  const [snapshot,setSnapshot] = useState<SessionSnapshot>(INITIAL);
  const [ready,setReady] = useState(false);
  const [previousReload,setPreviousReload] = useState(false);
  const [mutation,setMutation] = useState<PageMutation>(BASE_MUTATION);
  const [source,setSource] = useState<'waiting'|'model'|'fallback'>('waiting');
  const [assignment,setAssignment] = useState<string>('pending');
  const exposureOrdinalRef = useRef(0);
  const [telemetryStatus,setTelemetryStatus] = useState<'pending'|'connected'|'offline'>('pending');
  const sessionRef = useRef<ReturnType<typeof createSession>|null>(null);
  const remoteRef = useRef<RemoteSession|null>(null);
  const startedRef = useRef(false);
  const sequenceRef = useRef(0);
  const lastHeartbeatRef = useRef(0);
  const pendingLossRef = useRef<LossReason|null>(null);
  const mutationRef = useRef(BASE_MUTATION);
  const strategiesRef = useRef<string[]>([]);
  const stepRef = useRef(0);
  const nextAtRef = useRef<number|null>(null);
  const busyRef = useRef(false);
  const exposeRef = useRef<(ordinal:number, value:PageMutation, source:string)=>void>(()=>{});
  const sendRef = useRef<(s:SessionSnapshot, reason?:LossReason)=>void>(()=>{});
  const startRemoteRef = useRef<()=>void>(()=>{});

  useEffect(() => {
    const session = createSession();
    sessionRef.current = session;
    try {setPreviousReload(sessionStorage.getItem(STORAGE_KEY)==='playing');sessionStorage.removeItem(STORAGE_KEY);} catch {}
    setSnapshot(session.snapshot()); setReady(true);
    const update=()=>setSnapshot(session.snapshot());
    const send=(s:SessionSnapshot, reason?:LossReason)=>{
      const remote=remoteRef.current;
      if(!remote)return;
      const payload=JSON.stringify(telemetryPayload(s,++sequenceRef.current,reason));
      // keepalive allows terminal delivery during blur, navigation, or pagehide.
      void fetch(`/api/sessions/${remote.id}/events`,{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${remote.credential}`},
        body:payload,keepalive:!!reason,cache:'no-store'
      }).catch(()=>{if(!reason)setTelemetryStatus('offline');});
    };
    sendRef.current=send;
    const expose=(ordinal:number,value:PageMutation,source:string)=>{
      const remote=remoteRef.current;
      if(!remote)return;
      void fetch(`/api/sessions/${remote.id}/exposures`,{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${remote.credential}`},
        body:JSON.stringify({ordinal,mutation:value,source}),keepalive:true,cache:'no-store'
      }).catch(()=>setTelemetryStatus('offline'));
    };
    exposeRef.current=expose;
    startRemoteRef.current=()=>{
      startedRef.current=true;
      void fetch('/api/sessions',{method:'POST',cache:'no-store'}).then(async response=>{
        if(!response.ok)throw new Error('Session start failed');
        const data:unknown=await response.json();
        if(!validRemoteSession(data))throw new Error('Unexpected session response');
        remoteRef.current=data;
        setAssignment(data.assignment);
        setTelemetryStatus('connected');
        // Baseline was visible immediately at entry; record even for zero-mutation controls.
        expose(0,BASE_MUTATION,'control');
        if(data.assignment==='baseline_control')nextAtRef.current=null;
        // If the player lost before the session was created, immediately report that outcome.
        const loss=pendingLossRef.current;
        if(loss)send(session.snapshot(),loss);
      }).catch(()=>setTelemetryStatus('offline'));
    };
    const lose=(reason:LossReason)=>{
      if(session.snapshot().phase!=='playing')return;
      session.lose(reason);
      pendingLossRef.current=reason;
      nextAtRef.current=null;
      try{sessionStorage.removeItem(STORAGE_KEY);}catch{}
      update();
      send(session.snapshot(),reason);
    };
    const onBlur=()=>lose('blur');
    const onVisibility=()=>{if(document.hidden)lose('hidden');};
    const onPageHide=()=>lose('pagehide');
    const onClick=()=>{session.record('click');update();};
    const onScroll=()=>{session.record('scroll');update();};
    const onActivity=()=>session.record('activity');

    async function tick() {
      const s=session.snapshot();setSnapshot(s);
      if(s.phase==='playing' && remoteRef.current && s.elapsedMs-lastHeartbeatRef.current>=15000) {
        lastHeartbeatRef.current=s.elapsedMs;
        send(s);
      }
      if(s.phase!=='playing'||!remoteRef.current||document.hidden||!document.hasFocus()||busyRef.current||
          nextAtRef.current===null||s.elapsedMs<nextAtRef.current)return;
      busyRef.current=true;stepRef.current+=1;
      try {
        const remote=remoteRef.current;
        if(!remote)throw new Error('No session');
        const response=await fetch('/api/mutate',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${remote.credential}`,'X-Session-ID':remote.id},
          body:JSON.stringify({elapsedSeconds:Math.floor(s.elapsedMs/1000),clicks:s.clicks,scrolls:s.scrolls,
          idleSeconds:Math.floor(s.idleMs/1000),step:stepRef.current,
          previousStrategies:strategiesRef.current.slice(-4),previousHeadline:mutationRef.current.headline})});
        if(!response.ok)throw new Error('Mutation request failed');
        const data=await response.json();
        const proposed=validateMutation(data.mutation);
        if(proposed&&session.snapshot().phase==='playing'&&document.hasFocus()&&!document.hidden){
          mutationRef.current=proposed;setMutation(proposed);
          expose(++exposureOrdinalRef.current,proposed,data.source==='model'?'model':data.source==='control'?'control':'fallback');
          strategiesRef.current.push(proposed.strategy);
          if(strategiesRef.current.length>10)strategiesRef.current.shift();
          setSource(data.source==='model'?'model':'fallback');
          nextAtRef.current=remoteRef.current?.assignment==='baseline_control'?null:session.snapshot().elapsedMs+proposed.nextDelaySeconds*1000;
        }else nextAtRef.current=session.snapshot().elapsedMs+30000;
      }catch{nextAtRef.current=session.snapshot().elapsedMs+30000;setSource('fallback');}
      finally{busyRef.current=false;}
    }
    const interval=window.setInterval(tick,250);
    window.addEventListener('blur',onBlur);
    document.addEventListener('visibilitychange',onVisibility);
    window.addEventListener('pagehide',onPageHide);
    document.addEventListener('click',onClick);
    window.addEventListener('scroll',onScroll,{passive:true});
    document.addEventListener('pointermove',onActivity,{passive:true});
    document.addEventListener('keydown',onActivity);
    return ()=>{
      clearInterval(interval);
      window.removeEventListener('blur',onBlur);
      document.removeEventListener('visibilitychange',onVisibility);
      window.removeEventListener('pagehide',onPageHide);
      document.removeEventListener('click',onClick);
      window.removeEventListener('scroll',onScroll);
      document.removeEventListener('pointermove',onActivity);
      document.removeEventListener('keydown',onActivity);
      sessionRef.current=null;
    };
  },[]);
  const begin=()=>{
    if(!document.hasFocus()||document.hidden||startedRef.current)return;
    sessionRef.current?.start();
    nextAtRef.current=5000;
    try{sessionStorage.setItem(STORAGE_KEY,'playing');}catch{}
    setPreviousReload(false);
    setSnapshot(sessionRef.current?.snapshot()??INITIAL);
    startRemoteRef.current();
  };
  const concede=()=>{
    if(sessionRef.current?.snapshot().phase!=='playing')return;
    sessionRef.current.lose('concede');
    pendingLossRef.current='concede';
    nextAtRef.current=null;
    try{sessionStorage.removeItem(STORAGE_KEY);}catch{}
    const s=sessionRef.current.snapshot();
    setSnapshot(s);
    sendRef.current(s,'concede');
  };
  const seconds=Math.floor(snapshot.elapsedMs/1000);
  const upcoming=nextMilestone(seconds,THRESHOLDS);
  const milestoneCount=THRESHOLDS.filter(t=>t<=seconds).length;
  const playing=snapshot.phase==='playing';
  return <main className={`shell surface-${playing?mutation.surface:'dark'}`}>
    <div className="topline"><span className="eyebrow">PDNRH / EXPERIMENT 001</span>
      <span className="eyebrow">SESSION {ready?snapshot.id.slice(0,8).toUpperCase():'--------'}</span></div>
    <div className={`primary ${playing?`composition-${mutation.layout} tone-${mutation.tone}`:''}`}>
      <p className="eyebrow">YOUR OBJECTIVE: REMAIN HERE.</p>
      <h1>{playing?mutation.headline:<>PLEASE DO NOT<br/>REMAIN HERE.</>}</h1>
      {snapshot.phase==='ready'?<div className="instructions">
        {previousReload&&<p role="status">Your previous round ended when you reloaded.</p>}
        <p>The machine wins if you switch tabs, focus another window, minimize, navigate away, reload, or give up.</p>
        <p>Once you begin, keep this page focused. The clock starts when you enter.</p>
        <button type="button" disabled={!ready} onClick={begin}>BEGIN EXPERIMENT</button>
      </div>:snapshot.phase==='lost'?<div className="instructions" role="status">
        <p className="verdict">THE MACHINE WINS.</p><p>{REASONS[snapshot.lossReason??'blur']}</p>
        <button type="button" onClick={()=>window.location.reload()}>TRY AGAIN</button>
      </div>:<div className="mutable-copy" aria-live="polite"><p>{mutation.message}</p><p>{mutation.aside}</p></div>}
    </div>
    <section className="counter" aria-label="Session progress">
      <span className="eyebrow">TIME REMAINED</span>
      <output className="time" aria-live="off">{formatElapsed(snapshot.elapsedMs)}</output>
      <div className="progressTrack" role="progressbar" aria-valuemin={0} aria-valuemax={upcoming?.target??3600} aria-valuenow={Math.min(seconds,upcoming?.target??3600)} aria-label="Progress toward next milestone">
        <div className="progressFill" style={{width:`${upcoming?Math.max(0,Math.min(100,((seconds-upcoming.previous)/(upcoming.target-upcoming.previous))*100)):100}%`}}/>
      </div>
      <p className="muted">{snapshot.phase==='lost'?'Final survival time':upcoming?`Next milestone: ${formatElapsed(upcoming.target*1000)} · ${milestoneCount} reached`:'Every milestone reached. Still here.'}</p>
    </section>
    <footer className="footer">
      <p className="muted">{playing?`Assignment ${assignment} · ${source==='model'?'AI-generated':source==='fallback'?'scripted fallback':'first change pending'} · telemetry ${telemetryStatus} · focus loss ends the round.`:'Focus loss ends a round. Session outcomes are recorded anonymously when telemetry is available.'}</p>
      {playing&&<button type="button" onClick={concede}>{mutation.actionLabel}</button>}
    </footer>
  </main>;
}
