'use client';
import { useState } from 'react';
export default function Unlock(){
  const [token,setToken]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function login(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('');
    try{
      const res=await fetch('/observatory/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
      if(!res.ok){setError(res.status===401?'Invalid credential or observatory not configured.':'Unable to unlock.');return;}
      setToken('');window.location.reload();
    }catch{setError('Connection unavailable');}finally{setBusy(false);}
  }
  return <main className="obs"><div className="obs-head"><span className="obs-kicker">PDNRH / RESTRICTED</span><a href="/">RETURN TO EXPERIMENT</a></div><section className="obs-login"><p className="obs-kicker">OPERATIONS / READ ONLY</p><h1>OBSERVATORY.</h1><p>Authentication required. Experimental records are not public.</p><form onSubmit={login}><label htmlFor="credential">ADMIN CREDENTIAL</label><input id="credential" type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} required/><button disabled={busy||token.length===0} type="submit">{busy?'VERIFYING':'UNLOCK OBSERVATORY'}</button></form>{error&&<p role="alert">{error}</p>}</section></main>;
}
