import {BASE_MUTATION,validateMutation,type PageMutation} from './mutation';
import {applyPagePatch} from './page-runtime';
import {validateScene,isCreativeScene,type PageScene,type SceneBlock,type SceneReflex} from './scene';
import {validateStrategyPlan} from './strategic-planner';

/** PD12D-only compatibility compiler. The LLM must author an actual scene and plan.
 * The server supplies missing structural boilerplate and bounded local affordances.
 * It never accepts arbitrary links, scripts, URLs, browser operations or unsafe scene actions.
 */
function obj(value:unknown):Record<string,unknown>|null{
  return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
}
export type CompileResult={mutation:PageMutation|null;repairs:string[];failure:string|null};
function blockDefault(raw:Record<string,unknown>):Record<string,unknown>{
  return {...raw,detail:raw.detail??'',align:raw.align??'center',
    size:raw.size??'md',effect:raw.effect??'none',action:raw.action??'none'};
}
function defaultRule(blockId:string):SceneReflex{
  return {id:'local_ack',targetId:blockId,trigger:'hover',threshold:1,
    effect:'highlight',text:''};
}
function normalizeScene(source:unknown,repairs:string[]):PageScene|null{
  const raw=obj(source);
  if(!raw||!Array.isArray(raw.blocks))return null;
  const blocks=raw.blocks.map(b=>obj(b)).filter((b):b is Record<string,unknown>=>!!b)
    .map(blockDefault);
  if(blocks.length!==raw.blocks.length)return null;
  let candidate:Record<string,unknown>={
    version:raw.version??1,composition:raw.composition??'column',
    accent:raw.accent??'neutral',blocks,
    ...(raw.reflexes!==undefined?{reflexes:raw.reflexes}:{})
  };
  if(blocks.some((b,i)=>JSON.stringify(b)!==JSON.stringify(raw.blocks[i])))
    repairs.push('block_defaults');
  let scene=validateScene(candidate);
  if(!scene&&Array.isArray(raw.reflexes)&&raw.reflexes.length){
    const without=validateScene({...candidate,reflexes:[]});
    if(without){scene=without;repairs.push('invalid_reflex_removed');}
  }
  if(!scene)return null;
  if(scene.blocks.length<2)return null;
  let nextBlocks=[...scene.blocks];
  if(!nextBlocks.some(b=>['glyph','meter','void','rule'].includes(b.kind))){
    if(nextBlocks.length>=12)return null;
    nextBlocks=[...nextBlocks,{id:'scene_rule',kind:'rule',text:'',detail:'',
      align:'center',size:'md',effect:'none',action:'none'}];
    repairs.push('visual_affordance_added');
  }
  if(!nextBlocks.some(b=>(b.kind==='button'&&['reveal','toggle'].includes(b.action))||
    (b.kind==='link'&&b.action==='navigate'))){
    const candidateButton=nextBlocks.findIndex(b=>b.kind==='button'&&b.detail.length>0&&b.action==='none');
    if(candidateButton>=0){
      nextBlocks=nextBlocks.map((b,i)=>i===candidateButton?{...b,action:'reveal' as const}:b);
      repairs.push('button_action_default');
    }else if(nextBlocks.length<12){
      nextBlocks=[...nextBlocks,{id:'scene_inspect',kind:'button',text:'Inspect',
        detail:'The page noticed this interaction.',align:'center',size:'md',
        effect:'none',action:'reveal'}];
      repairs.push('interaction_affordance_added');
    }else return null;
  }
  const target=nextBlocks.find(b=>b.kind==='button'||b.kind==='link')?.id??nextBlocks[0].id;
  const reflexes=scene.reflexes?.length?scene.reflexes:[defaultRule(target)];
  if(!scene.reflexes?.length)repairs.push('safe_reflex_default');
  candidate={...candidate,blocks:nextBlocks,reflexes};
  scene=validateScene(candidate);
  return scene&&isCreativeScene(scene)?scene:null;
}
export function compilePd12dOutput(
  rawInput:unknown,previous:PageScene|undefined,
  options:{pivotRequired:boolean;avoidApproach:string|null}
):CompileResult{
  const repairs:string[]=[];
  const raw=obj(rawInput);
  if(!raw)return {mutation:null,repairs,failure:'not_object'};
  const plan=validateStrategyPlan(raw.plan);
  if(!plan)return {mutation:null,repairs,failure:'missing_or_invalid_plan'};
  if(options.pivotRequired&&plan.approach===options.avoidApproach)
    return {mutation:null,repairs,failure:'required_pivot_missing'};
  let scene:PageScene|null=null;
  let scenePatch:unknown=undefined;
  if(raw.scenePatch!==undefined){
    const patched=applyPagePatch(previous,raw.scenePatch);
    if(patched){
      scene=normalizeScene(patched.scene,repairs);
      scenePatch=patched.patch;
    }else if(raw.scene!==undefined)repairs.push('invalid_patch_ignored');
    else return {mutation:null,repairs,failure:previous?'invalid_patch':'patch_without_world'};
  }
  if(!scene&&raw.scene!==undefined)scene=normalizeScene(raw.scene,repairs);
  if(!scene)return {mutation:null,repairs,failure:'missing_or_invalid_scene'};
  const actionable=scene.blocks.filter(b=>b.kind==='button'||b.kind==='link');
  const matched=obj(raw.experiment);
  const validTarget=matched&&typeof matched.targetId==='string'&&
    scene.blocks.some(b=>b.id===matched.targetId);
  const experiment=validTarget?raw.experiment:{
    targetId:actionable[0]?.id??scene.blocks[0].id,event:'click',minimum:1
  };
  if(!validTarget)repairs.push('experiment_target_default');
  const fields={
    headline:raw.headline??scene.blocks.find(b=>b.kind==='heading')?.text??BASE_MUTATION.headline,
    message:raw.message??plan.thesis,
    aside:raw.aside??plan.assessment,
    actionLabel:raw.actionLabel??BASE_MUTATION.actionLabel,
    strategy:raw.strategy??plan.approach,
    tone:raw.tone??'direct',
    layout:raw.layout??'center',
    surface:raw.surface??'dark',
    nextDelaySeconds:raw.nextDelaySeconds??30,
    hypothesis:raw.hypothesis??plan.thesis,
    expectedReaction:raw.expectedReaction??'The visitor may inspect a displayed element.',
    experiment,plan,scene,
    ...(scenePatch?{scenePatch}:{})
  };
  if(['headline','message','aside','actionLabel','strategy','tone','layout','surface',
    'nextDelaySeconds','hypothesis','expectedReaction'].some(k=>raw[k]===undefined))
    repairs.push('cosmetic_or_observation_defaults');
  const mutation=validateMutation(fields);
  return {mutation,repairs,failure:mutation?null:'mutation_fields_invalid'};
}
