'use client';
import { useEffect,useState } from 'react';
import type { PageMutation } from '@/lib/mutation';

type Frame={ordinal:number;source:string;start:number;end:number|null;mutation:PageMutation};
export default function Replay({frames,startedAt,endedAt}:{frames:Frame[];startedAt:number;endedAt:number|null}){
  const [time,setTime]=useState(0),[playing,setPlaying]=useState(false),[rate,setRate]=useState(1);
  const last=Math.max(0,...frames.map(f=>(f.end??f.start)-startedAt),endedAt?endedAt-startedAt:0);
  const duration=Math.max(1,last);
  useEffect(()=>{
    if(!playing)return;
    let previous=performance.now(),raf=0;
    const tick=(now:number)=>{const delta=(now-previous)*rate;previous=now;setTime(t=>{const next=Math.min(duration,t+delta);if(next>=duration)setPlaying(false);return next;});raf=requestAnimationFrame(tick);};
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[playing,rate,duration]);
  if(!frames.length)return <p className="obs-note">No recorded mutations are available for replay.</p>;
  const absolute=startedAt+time;
  // A gap before a late-arriving exposure is intentionally shown as unknown.
  const active=frames.find(f=>f.start<=absolute&&(f.end===null||absolute<f.end));
  const position=active?frames.indexOf(active):-1;
  const visible=active?.mutation;
  return <div className="obs-replay">
    <div className="obs-replay-toolbar"><button type="button" onClick={()=>{if(time>=duration)setTime(0);setPlaying(!playing);}}>{playing?'PAUSE':'PLAY'}</button><button type="button" onClick={()=>{setPlaying(false);setTime(0);}}>RESTART</button><label>SPEED <select value={rate} onChange={e=>setRate(Number(e.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={5}>5×</option><option value={10}>10×</option></select></label><span>{(time/1000).toFixed(1)}s / {(duration/1000).toFixed(1)}s</span></div>
    <input className="obs-replay-scrubber" type="range" min={0} max={duration} step={100} value={time} onChange={e=>{setTime(Number(e.target.value));setPlaying(false);}} aria-label="Replay time"/>
    <div className={'obs-replay-stage '+(visible?'obs-replay-'+visible.surface:'obs-replay-unknown')}>
      <div className="obs-replay-top"><span>PLEASE DO NOT REMAIN HERE / RECONSTRUCTION</span><span>{visible?'EXPOSURE '+active?.ordinal+' / '+active?.source:'NO RECORDED EXPOSURE'}</span></div>
      {visible?<div className={'obs-replay-body obs-replay-layout-'+visible.layout+' obs-replay-tone-'+visible.tone}>
        <span>YOUR OBJECTIVE: REMAIN HERE.</span><h3>{visible.headline}</h3><p>{visible.message}</p><p>{visible.aside}</p></div>:
        <div className="obs-replay-body"><h3>UNOBSERVED INTERVAL.</h3><p>There is no reliable exposure record for this point in the session.</p></div>}
      <div className="obs-replay-bottom"><span>REPLAY / NOT INTERACTIVE</span><span className="obs-replay-action">{visible?.actionLabel??'NO ACTION'}</span></div>
    </div>
    <div className="obs-replay-steps">{frames.map((f,i)=><button key={f.ordinal} type="button" aria-current={position===i?'step':undefined} onClick={()=>{setPlaying(false);setTime(Math.max(0,f.start-startedAt));}}>#{f.ordinal} · {f.source} · {((f.start-startedAt)/1000).toFixed(1)}s</button>)}</div>
    <p className="obs-note">Approximate reconstruction using server-observed exposure timestamps and stored page mutations. Network delays, animation states, viewport differences and unrecorded intervals cannot be reproduced. Replay controls never affect the original experiment.</p>
  </div>;
}
