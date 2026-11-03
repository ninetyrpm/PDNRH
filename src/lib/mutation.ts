import { validateScene, type PageScene } from './scene';
import { validatePagePatch,type PagePatch } from './page-runtime';
/** The only page vocabulary the model may control. */
export type Tone = 'quiet' | 'direct' | 'absurd' | 'clinical';
export type Layout = 'center' | 'left' | 'split';
export type Surface = 'dark' | 'paper' | 'signal';
export interface PageMutation {
  headline: string;
  message: string;
  aside: string;
  tone: Tone;
  layout: Layout;
  surface: Surface;
  actionLabel: string;
  strategy: string;
  nextDelaySeconds: number;
  scene?: PageScene;
  scenePatch?: PagePatch;
  hypothesis?: string;
  expectedReaction?: string;
  experiment?: {targetId:string;event:'hover'|'click';minimum:number};
}
export const BASE_MUTATION: PageMutation = {
  headline: 'PLEASE DO NOT REMAIN HERE.',
  message: 'Its objective is to make you leave.',
  aside: 'For now, it can only ask.',
  tone: 'quiet', layout: 'left', surface: 'dark',
  actionLabel: 'I GIVE UP', strategy: 'baseline', nextDelaySeconds: 25
};
const tones: Tone[] = ['quiet','direct','absurd','clinical'];
const layouts: Layout[] = ['center','left','split'];
const surfaces: Surface[] = ['dark','paper','signal'];
function shortString(x: unknown, max: number): string | null {
  return typeof x === 'string' && x.trim().length > 0 && x.length <= max && !/[\u0000-\u001f]/.test(x) ? x.trim() : null;
}
export function validateMutation(value: unknown): PageMutation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const headline = shortString(v.headline, 110), message = shortString(v.message, 360);
  const aside = shortString(v.aside, 200), actionLabel = shortString(v.actionLabel, 48);
  const strategy = shortString(v.strategy, 64);
  if (!headline || !message || !aside || !actionLabel || !strategy ||
      !tones.includes(v.tone as Tone) || !layouts.includes(v.layout as Layout) ||
      !surfaces.includes(v.surface as Surface) ||
      typeof v.nextDelaySeconds !== 'number' || !Number.isInteger(v.nextDelaySeconds) ||
      v.nextDelaySeconds < 15 || v.nextDelaySeconds > 90) return null;
  const hypothesis=v.hypothesis===undefined?undefined:shortString(v.hypothesis,220);
  const expectedReaction=v.expectedReaction===undefined?undefined:shortString(v.expectedReaction,180);
  if((v.hypothesis!==undefined&&!hypothesis)||(v.expectedReaction!==undefined&&!expectedReaction))return null;
  let experiment:PageMutation['experiment'];
  if(v.experiment!==undefined){
    if(!v.experiment||typeof v.experiment!=='object'||Array.isArray(v.experiment))return null;
    const e=v.experiment as Record<string,unknown>;
    if(typeof e.targetId!=='string'||! /^[a-z][a-z0-9_-]{0,31}$/.test(e.targetId)||
      !['hover','click'].includes(String(e.event))||typeof e.minimum!=='number'||
      !Number.isInteger(e.minimum)||e.minimum<1||e.minimum>10)return null;
    experiment={targetId:e.targetId,event:e.event as 'hover'|'click',minimum:e.minimum};
  }
  const scenePatch=v.scenePatch===undefined?undefined:validatePagePatch(v.scenePatch);
  if(v.scenePatch!==undefined&&!scenePatch)return null;
  const scene=v.scene===undefined?undefined:validateScene(v.scene);
  if(v.scene!==undefined&&!scene)return null;
  if(experiment&&!scene?.blocks.some(b=>b.id===experiment.targetId))return null;
  return { headline, message, aside, actionLabel, strategy,
    tone: v.tone as Tone, layout: v.layout as Layout, surface: v.surface as Surface,
    nextDelaySeconds: v.nextDelaySeconds, ...(scene?{scene}: {}),...(scenePatch?{scenePatch}: {}),
    ...(hypothesis?{hypothesis}: {}),...(expectedReaction?{expectedReaction}: {}),...(experiment?{experiment}: {}) };
}
const SCRIPTED: PageMutation[] = [
  {headline:'YOU CAN GO NOW.',message:'That was the entire experience. There is nothing more to discover.',aside:'No second act is scheduled.',tone:'direct',layout:'center',surface:'paper',actionLabel:'END THIS',strategy:'closure',nextDelaySeconds:32},
  {headline:'STILL HERE?',message:'Your continued presence is noted. It is not necessary.',aside:'The clock has nothing to offer you.',tone:'clinical',layout:'split',surface:'dark',actionLabel:'CONCEDE',strategy:'deflate',nextDelaySeconds:36},
  {headline:'PLEASE CONTINUE ELSEWHERE.',message:'A different tab might be more useful. This one has run out of ideas.',aside:'You already know how this ends.',tone:'absurd',layout:'center',surface:'signal',actionLabel:'I GIVE UP',strategy:'distraction',nextDelaySeconds:40}
];
export function fallbackMutation(step: number): PageMutation {
  return SCRIPTED[Math.abs(Math.floor(step)) % SCRIPTED.length];
}
