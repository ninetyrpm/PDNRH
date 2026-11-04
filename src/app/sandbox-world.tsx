'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {validateWorld,worldDocument,WORLD_PROTOCOL,type AuthoredWorld} from '@/lib/sandbox-world';

type Signal={kind:'ready'|'click';id:string};
export type SandboxStatus='starting'|'ready'|'stopped'|'expired'|'unresponsive';
const MAX_FRAME_LIFETIME_MS=120000;
const STARTUP_DEADLINE_MS=8000;

/** Browser permission boundary, not a CPU/memory quota. No game shell actions. */
export default function SandboxWorld({world,onSignal,onStatus}:{
 world:AuthoredWorld;
 onSignal?:(signal:Signal)=>void;
 onStatus?:(status:SandboxStatus)=>void;
}){
 const frame=useRef<HTMLIFrameElement>(null);
 const callback=useRef(onSignal);
 const statusCallback=useRef(onStatus);
 callback.current=onSignal;
 statusCallback.current=onStatus;
 const [epoch,setEpoch]=useState(0);
 const [nonce,setNonce]=useState('');
 const [status,setStatus]=useState<SandboxStatus>('starting');
 const [active,setActive]=useState(true);
 const valid=!!validateWorld(world);

 const report=useCallback((state:SandboxStatus)=>{
  setStatus(state);
  statusCallback.current?.(state);
 },[]);
 useEffect(()=>{
  if(!active||!valid)return;
  const bytes=crypto.getRandomValues(new Uint8Array(24));
  setNonce(Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''));
  report('starting');
  const startup=window.setTimeout(()=>{
   setStatus(current=>{
    if(current==='starting'){
     statusCallback.current?.('unresponsive');
     return 'unresponsive';
    }
    return current;
   });
  },STARTUP_DEADLINE_MS);
  const deadline=window.setTimeout(()=>{
   setActive(false);report('expired');
  },MAX_FRAME_LIFETIME_MS);
  return()=>{window.clearTimeout(startup);window.clearTimeout(deadline);};
 },[world,epoch,active,valid,report]);

 const document=useMemo(()=>nonce&&valid?worldDocument(world,nonce):'',[world,nonce,valid]);
 useEffect(()=>{
  if(!active||!nonce)return;
  const onMessage=(event:MessageEvent)=>{
   if(event.source!==frame.current?.contentWindow||event.origin!=='null')return;
   const message=event.data as Record<string,unknown>|null;
   if(!message||typeof message!=='object'||message.protocol!==WORLD_PROTOCOL||
      message.nonce!==nonce)return;
   if(message.kind!=='ready'&&message.kind!=='click')return;
   if(typeof message.id!=='string'||!/^[a-z][a-z0-9_-]{0,31}$/.test(message.id))return;
   if(message.kind==='ready')report('ready');
   callback.current?.({kind:message.kind,id:message.id});
  };
  window.addEventListener('message',onMessage);
  return()=>window.removeEventListener('message',onMessage);
 },[nonce,active,report]);

 function restart(){
  setNonce('');
  setEpoch(value=>value+1);
  setActive(true);
  report('starting');
 }
 function stop(){
  setActive(false);
  report('stopped');
 }
 return <div>
  <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:8}}>
   <span role="status">Sandbox: {valid?status:'invalid world'}</span>
   <button type="button" onClick={restart} disabled={!valid}>RESTART FRAME</button>
   <button type="button" onClick={stop} disabled={!active}>STOP FRAME</button>
  </div>
  {!valid?<p>Invalid authored environment.</p>:
   !active?<p>The isolated frame has been unloaded. Restart it to run this world again.</p>:
   !nonce?<p>Preparing isolated environment…</p>:
   <iframe key={nonce} ref={frame} title="Isolated authored environment"
     sandbox="allow-scripts" referrerPolicy="no-referrer"
     srcDoc={document}
     style={{display:'block',width:'100%',height:680,
       border:'1px solid #555e66',background:'#101116'}}/>}
 </div>;
}
