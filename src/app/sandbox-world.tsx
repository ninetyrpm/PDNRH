'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {validateWorld,worldDocument,WORLD_PROTOCOL,type AuthoredWorld} from '@/lib/sandbox-world';

type Signal={kind:'ready'|'click';id:string};
export default function SandboxWorld({world,onSignal}:{
 world:AuthoredWorld;onSignal?:(signal:Signal)=>void
}){
 const frame=useRef<HTMLIFrameElement>(null);
 const [nonce]=useState(()=>{
  const bytes=new Uint8Array(24);
  if(typeof crypto!=='undefined')crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 });
 const document=useMemo(()=>worldDocument(world,nonce),[world,nonce]);
 useEffect(()=>{
  const onMessage=(event:MessageEvent)=>{
   if(event.source!==frame.current?.contentWindow||event.origin!=='null')return;
   const message=event.data as Record<string,unknown>|null;
   if(!message||typeof message!=='object'||message.protocol!==WORLD_PROTOCOL||
      message.nonce!==nonce)return;
   if(message.kind!=='ready'&&message.kind!=='click')return;
   if(typeof message.id!=='string'||!/^[a-z][a-z0-9_-]{0,31}$/.test(message.id))return;
   onSignal?.({kind:message.kind,id:message.id});
  };
  window.addEventListener('message',onMessage);
  return()=>window.removeEventListener('message',onMessage);
 },[nonce,onSignal]);
 if(!validateWorld(world))return <p>Invalid authored environment.</p>;
 return <iframe ref={frame} title="Isolated authored environment"
  sandbox="allow-scripts" referrerPolicy="no-referrer"
  srcDoc={document} className="pd-sandbox-world"/>;
}
