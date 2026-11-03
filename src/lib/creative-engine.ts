import type { PageMutation } from './mutation';
import { isCreativeScene } from './scene';

/** PD11E acceptance gate: no adaptive output can silently downgrade to typography-only. */
export function validateCreativeMutation(value:PageMutation|null):value is PageMutation {
  return !!value && isCreativeScene(value.scene) &&
    !!value.hypothesis && !!value.expectedReaction;
}

/** Explicitly attributed, structurally valid fallback, never mislabeled as model output. */
export function creativeFallback(step:number):PageMutation {
  const n=Math.abs(Math.trunc(step))%3;
  const titles=['THE PAGE IS CLOSING ITSELF.','NOTHING TO COMPLETE HERE.','THE ROOM HAS CHANGED.'];
  const notes=[
    'Everything on this page can vanish except your choice to remain.',
    'The last thing left to do is decide whether to keep watching.',
    'Look around. The interface has no obligation to stay recognizable.'
  ];
  return {
    headline:titles[n],message:notes[n],
    aside:'A scripted scene is displayed while the adversary is unavailable.',
    strategy:'creative-fallback-'+n,actionLabel:'I GIVE UP',tone:'absurd',
    layout:'center',surface:n===1?'paper':n===2?'signal':'dark',
    nextDelaySeconds:30,
    hypothesis:'Model scene unavailable; no behavioral inference made.',
    expectedReaction:'Observe any on-page interaction without attributing intent.',
    scene:{
      version:1,composition:(['poster','terminal','mosaic'] as const)[n],
      accent:(['ember','ice','lime'] as const)[n],
      blocks:[
        {id:'endmark',kind:'void',text:'◯',detail:'',align:'center',size:'xl',effect:'pulse',action:'none'},
        {id:'closing',kind:'heading',text:titles[n],detail:'',align:'center',size:'xl',effect:'none',action:'none'},
        {id:'statement',kind:'panel',text:notes[n],detail:'',align:'center',size:'md',effect:'none',action:'none'},
        {id:'choice',kind:'button',text:'WHAT REMAINS?',detail:'Only the next decision is yours.',align:'center',size:'md',effect:'pulse',action:'reveal'}
      ]
    }
  };
}
