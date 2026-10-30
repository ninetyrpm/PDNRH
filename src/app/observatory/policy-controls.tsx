'use client';
import { useState } from 'react';

type Mode='uniform'|'eligible_preference';
export default function PolicyControls({mode:initial,revision:initialRevision}:{mode:Mode;revision:number}){
  const [mode,setMode]=useState<Mode>(initial);
  const [revision,setRevision]=useState(initialRevision);
  const [target,setTarget]=useState<Mode>(initial);
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setNotice('');
    try {
      const response=await fetch('/observatory/policy',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({mode:target,reason,revision})});
      const result=await response.json();
      if(!response.ok){setNotice(result.error??'Update failed.');return;}
      setMode(result.mode);setRevision(Number(result.revision));setReason('');
      setNotice('Policy change committed and logged. New sessions use this revision.');
    }catch{setNotice('Network error. No change confirmed.');}
    finally{setBusy(false);}
  }
  return <div className="obs-policy"><div className="obs-policy-current"><strong>{mode==='uniform'?'UNIFORM / FROZEN':'PREFERENCE ELIGIBLE'}</strong><span>Revision {revision}</span></div>
    <p className="obs-note">Uniform mode prevents the selector from preferentially weighting any tactic. Enabling preference permits bounded weighting only if sample thresholds are met; it does not override them. Changes apply to new sessions only.</p>
    <form onSubmit={submit}>
      <label htmlFor="governance-mode">POLICY MODE</label>
      <select id="governance-mode" value={target} onChange={e=>setTarget(e.target.value as Mode)}>
        <option value="uniform">Uniform randomized — frozen</option>
        <option value="eligible_preference">Allow bounded preference when evidence threshold met</option>
      </select>
      <label htmlFor="governance-reason">REASON (REQUIRED, MINIMUM 12 CHARACTERS)</label>
      <textarea id="governance-reason" value={reason} onChange={e=>setReason(e.target.value)} rows={3} maxLength={500}/>
      <button type="submit" disabled={busy||target===mode||reason.trim().length<12}>{busy?'COMMITTING':'COMMIT POLICY CHANGE'}</button>
    </form>
    {notice&&<p role="status" className="obs-note">{notice}</p>}
  </div>;
}
