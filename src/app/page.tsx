'use client';
import { useEffect, useRef, useState } from 'react';
import { createSession, formatElapsed, nextMilestone, type SessionSnapshot, type LossReason } from '@/lib/session';
import { BASE_MUTATION, validateMutation, type PageMutation } from '@/lib/mutation';

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
  const sessionRef = useRef<ReturnType<typeof createSession>|null>(null);
  const mutationRef = useRef(BASE_MUTATION);
  const strategiesRef = useRef<string[]>([]);
  const stepRef = useRef(0);
  const nextAtRef = useRef<number|null>(null);
  const busyRef = useRef(false);
  useEffect(() => {
    const session = createSession();
    sessionRef.current = session;
    try {setPreviousReload(sessionStorage.getItem(STORAGE_KEY)==='playing');sessionStorage.removeItem(STORAGE_KEY);} catch {}
    setSnapshot(session.snapshot()); setReady(true);
    const update=()=>setSnapshot(session.snapshot());
    const lose=(reason:LossReason)=>{
      session.lose(reason);
      nextAtRef.current=null;
      try{sessionStorage.removeItem(STORAGE_KEY);}catch{}
      update();
    };
    const onBlur=()=>lose('blur');
    const onVisibility=()=>{if(document.hidden)lose('hidden');};
    const onPageHide=()=>lose('pagehide');
    const onClick=()=>{session.record('click');update();};
    const onScroll=()=>{session.record('scroll');update();};
    const onActivity=()=>session.record('activity');

    async function tick() {
      const s=session.snapshot(); setSnapshot(s);
      if(s.phase!=='playing'||document.hidden||!document.hasFocus()||busyRef.current||
          nextAtRef.current===null||s.elapsedMs<nextAtRef.current) return;
      busyRef.current=true;
      stepRef.current+=1;
      try {
        const response=await fetch('/api/mutate',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({elapsedSeconds:Math.floor(s.elapsedMs/1000),clicks:s.clicks,scrolls:s.scrolls,
          idleSeconds:Math.floor(s.idleMs/1000),step:stepRef.current,
          previousStrategies:strategiesRef.current.slice(-4),previousHeadline:mutationRef.current.headline})});
        if(!response.ok) throw new Error('Mutation request failed');
        const data=await response.json();
        const proposed=validateMutation(data.mutation);
        if(proposed&&session.snapshot().phase==='playing'&&document.hasFocus()&&!document.hidden) {
          mutationRef.current=proposed;setMutation(proposed);
          strategiesRef.current.push(proposed.strategy);
          if(strategiesRef.current.length>10) strategiesRef.current.shift();
          setSource(data.source==='model'?'model':'fallback');
          nextAtRef.current=session.snapshot().elapsedMs+proposed.nextDelaySeconds*1000;
        } else nextAtRef.current=session.snapshot().elapsedMs+30000;
      } catch {nextAtRef.current=session.snapshot().elapsedMs+30000;setSource('fallback');}
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
    if(!document.hasFocus()||document.hidden)return;
    sessionRef.current?.start();
    nextAtRef.current=5000;
    try{sessionStorage.setItem(STORAGE_KEY,'playing');}catch{}
    setPreviousReload(false);
    setSnapshot(sessionRef.current?.snapshot()??INITIAL);
  };
  const concede=()=>{
    sessionRef.current?.lose('concede');
    nextAtRef.current=null;
    try{sessionStorage.removeItem(STORAGE_KEY);}catch{}
    setSnapshot(sessionRef.current?.snapshot()??INITIAL);
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
      <p className="muted">{playing?`The page is adapting · ${source==='model'?'AI-generated':source==='fallback'?'scripted fallback':'first change pending'} · focus loss ends the round.`:'Focus loss ends a round. No results are stored on a server.'}</p>
      {playing&&<button type="button" onClick={concede}>{mutation.actionLabel}</button>}
    </footer>
  </main>;
}
