'use client';
import {useState} from 'react';
import SandboxWorld from '../sandbox-world';
import type {AuthoredWorld} from '@/lib/sandbox-world';

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
 return <main className="pd-lab">
  <header><span>PDNRH / PD13A</span><span>ISOLATION PROTOTYPE</span></header>
  <h1>MODEL-AUTHORED ENVIRONMENT</h1>
  <p>This is a locally authored fixture, not a generated adversarial mutation.
    It demonstrates custom HTML, CSS and procedural behavior inside an isolated frame.
    It is not connected to a live experiment.</p>
  <SandboxWorld world={example} onSignal={signal=>
    setSignals(previous=>[signal.kind+':'+signal.id,...previous].slice(0,12))}/>
  <section><h2>Observed sandbox signals</h2>
   <p>Read-only interaction summaries; no privileged game actions are exposed.</p>
   <pre>{signals.join('\n')||'No sandbox activity recorded.'}</pre>
  </section>
  <footer>Experimental development surface. No live adversarial rounds use this runtime.</footer>
 </main>;
}
