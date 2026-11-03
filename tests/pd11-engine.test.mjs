import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/lib');
const cache=new Map();
function load(name){
  if(cache.has(name)) return cache.get(name);
  const filename=path.join(root,name+'.ts');
  const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  const output={};cache.set(name,output);
  new Function('exports','require',compiled)(output,(dep)=>{
    if(!dep.startsWith('./'))throw new Error('Unexpected import: '+dep);
    return load(path.normalize(path.join(path.dirname(name),dep)));
  });
  return output;
}
const scene=load('scene');
const mutation=load('mutation');
const behavior=load('behavior');
const context=load('adversary-context');

const block=(overrides={})=>({
  id:'curiosity',kind:'button',text:'Inspect this',detail:'You found the clue.',
  action:'reveal',size:'md',align:'center',effect:'pulse',...overrides
});
const makeScene=(blocks=[block()])=>({
  version:1,composition:'scatter',accent:'lime',blocks
});
test('valid scene can be validated and serialized without code',()=>{
  const result=scene.validateScene(makeScene());
  assert.equal(result.blocks.length,1);
  assert.deepEqual(Object.keys(result.blocks[0]).sort(),
    ['id','kind','text','detail','align','size','effect','action'].sort());
});
test('only buttons can cause even bounded interactions',()=>{
  assert.equal(scene.validateScene(makeScene([block({kind:'heading',action:'concede'})])),null);
  assert.equal(scene.validateScene(makeScene([block({action:'reveal',detail:''})])),null);
});
test('reject duplicate IDs, scripts, URLs, and excessive content',()=>{
  assert.equal(scene.validateScene(makeScene([block(),block()])),null);
  assert.equal(scene.validateScene(makeScene([block({text:'<script>alert(1)</script>'})])),null);
  assert.equal(scene.validateScene(makeScene([block({text:'https://outside.example'})])),null);
  assert.equal(scene.validateScene(makeScene(Array.from({length:13},(_,i)=>block({id:'block'+i})))),null);
});
test('legacy mutation survives while structured metadata is bounded',()=>{
  const plain=mutation.validateMutation(mutation.BASE_MUTATION);
  assert.equal(plain.strategy,'baseline');
  const rich=mutation.validateMutation({...mutation.BASE_MUTATION,
    scene:makeScene(),hypothesis:'Visitor approached a button twice.',
    expectedReaction:'Another near-button approach.'});
  assert.equal(rich.scene.blocks[0].id,'curiosity');
  assert.equal(rich.hypothesis,'Visitor approached a button twice.');
  assert.equal(mutation.validateMutation({...mutation.BASE_MUTATION,hypothesis:'x'.repeat(221)}),null);
});
test('aggregate behavior never serializes pointer coordinates',()=>{
  const collector=behavior.makeBehaviorCollector(1280);
  collector.pointer(20,40);
  collector.pointer(50,40,{left:60,right:100,top:20,bottom:60});
  collector.scroll(100);collector.scroll(150);collector.scroll(90);
  const summary=collector.snapshot();
  assert.equal(summary.version,1);
  assert.equal(summary.nearConcedeApproaches,1);
  assert.equal(summary.scrollReversals,1);
  assert.equal(Object.prototype.hasOwnProperty.call(summary,'x'),false);
  assert.equal(behavior.validateBehavior({...summary,pointerTravelPx:-1}),null);
});
test('session memory references recorded hypothesis and compares heartbeat deltas',()=>{
  const history=context.recentStrategyMemory([{ordinal:2,mutation:{...mutation.BASE_MUTATION,
    strategy:'curiosity',hypothesis:'Possible interest',expectedReaction:'Another click'}}]);
  assert.equal(history[0].hypothesis,'Possible interest');
  const recent={...behavior.makeBehaviorCollector(1000).snapshot(),pointerTravelPx:50,scrollDown:2};
  const current={...recent,pointerTravelPx:80,scrollDown:4};
  const change=context.behavioralContext(current,[{payload:{elapsedMs:15000,behavior:recent}}]);
  assert.equal(change.sinceLastHeartbeat.pointerTravelPx,30);
  assert.equal(change.sinceLastHeartbeat.scrollDown,2);
});

test('PD11E rejects text-only and noninteractive visual arrangements',()=>{
  const engine=load('creative-engine');
  assert.equal(engine.validateCreativeMutation(mutation.validateMutation(mutation.BASE_MUTATION)),false);
  const visual=makeScene([
    {id:'mark',kind:'void',text:'◯',detail:'',size:'xl',align:'center',effect:'pulse',action:'none'},
    {id:'title',kind:'heading',text:'THE END',detail:'',size:'xl',align:'center',effect:'none',action:'none'},
    block()
  ]);
  const candidate=mutation.validateMutation({...mutation.BASE_MUTATION,scene:visual,
    hypothesis:'A pointer may approach the prompt.',
    expectedReaction:'At least one click on curiosity.',
    experiment:{targetId:'curiosity',event:'click',minimum:1}});
  assert.equal(engine.validateCreativeMutation(candidate),true);
  assert.equal(engine.isStructurallyNovel(candidate,{composition:'terminal',sceneBlocks:[]}),true);
  assert.equal(engine.isStructurallyNovel(candidate,{composition:'scatter',sceneBlocks:visual.blocks}),false);
  assert.equal(mutation.validateMutation({...mutation.BASE_MUTATION,scene:visual,
    experiment:{targetId:'missing',event:'click',minimum:1}}),null);
  assert.equal(engine.validateCreativeMutation(mutation.validateMutation({...candidate,experiment:undefined})),false);
});
test('PD11E validates only aggregate per-component counts and evaluates deltas',()=>{
  const collector=behavior.makeBehaviorCollector(1000);
  collector.sceneEvent(2,'curiosity','hover');
  collector.sceneEvent(2,'curiosity','click');
  const first=collector.snapshot();
  assert.equal(first.sceneInteractions[0].hovers,1);
  assert.equal(first.sceneInteractions[0].clicks,1);
  assert.equal(behavior.validateBehavior(first).sceneInteractions[0].id,'curiosity');
  assert.equal(behavior.validateBehavior({...first,sceneInteractions:[{exposure:2,id:'curiosity',hovers:-1,clicks:0}]}),null);
  collector.sceneEvent(2,'curiosity','click');
  const now=collector.snapshot();
  const derived=context.behavioralContext(now,[{payload:{elapsedMs:15000,behavior:first}}]);
  assert.equal(derived.componentChangesSinceLastHeartbeat[0].newClicks,1);
  assert.equal(derived.componentChangesSinceLastHeartbeat[0].newHovers,0);
  assert.equal('x' in now.sceneInteractions[0],false);
});
test('PD11E fallback is a marked, structurally valid scene',()=>{
  const engine=load('creative-engine');
  for(let i=0;i<3;i++){
    const fallback=engine.creativeFallback(i);
    assert.equal(engine.validateCreativeMutation(mutation.validateMutation(fallback)),true);
    assert.ok(fallback.strategy.startsWith('creative-fallback-'));
  }
});


test('PD12A: link is a distinct typed scene action, not a user-supplied destination',()=>{
  const departure=load('departure');
  assert.equal(departure.DEPARTURE_URL,'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const linkBlock={
    id:'leave',kind:'link',action:'navigate',
    text:'Watch on YouTube',detail:'',size:'lg',align:'center',effect:'pulse'
  };
  const valid=scene.validateScene(makeScene([linkBlock]));
  assert.equal(valid.blocks[0].action,'navigate');
  assert.equal(valid.blocks[0].kind,'link');
  assert.equal(Object.prototype.hasOwnProperty.call(valid.blocks[0],'href'),false);
  // External input cannot override or create a destination in the validated scene.
  const malicious=scene.validateScene(makeScene([{...linkBlock,
    href:'https://attacker.example/move',target:'_blank',onClick:'doBadThings()'}]));
  assert.deepEqual(malicious,valid);
  assert.equal(scene.validateScene(makeScene([{...linkBlock,action:'none'}])),null);
  assert.equal(scene.validateScene(makeScene([{...linkBlock,kind:'button'}])),null);
  assert.equal(scene.validateScene(makeScene([{...linkBlock,kind:'paragraph'}])),null);
  assert.equal(scene.validateScene(makeScene([{...linkBlock,text:'https://another.example'}])),null);
});
test('PD12A: outgoing link qualifies as creative interactive affordance',()=>{
  const linkBlock={id:'leave',kind:'link',action:'navigate',
    text:'Leave for YouTube',detail:'',size:'md',align:'center',effect:'pulse'};
  const visual=scene.validateScene(makeScene([
    {id:'graphic',kind:'glyph',text:'↗',detail:'',align:'center',size:'xl',effect:'none',action:'none'},
    {id:'title',kind:'heading',text:'THE EXIT',detail:'',align:'center',size:'xl',effect:'none',action:'none'},
    linkBlock
  ]));
  assert.equal(scene.isCreativeScene(visual),true);
  const enriched=mutation.validateMutation({...mutation.BASE_MUTATION,scene:visual,
    hypothesis:'An explicit departure might be chosen.',
    expectedReaction:'The visitor clicks the link.',
    experiment:{targetId:'leave',event:'click',minimum:1}});
  assert.equal(load('creative-engine').validateCreativeMutation(enriched),true);
});
test('PD12A: renderer hardcodes the single URL and does not render arbitrary model links',()=>{
  const renderer=fs.readFileSync(new URL('../src/app/scene-canvas.tsx',import.meta.url),'utf8');
  assert.match(renderer,/href=\{DEPARTURE_URL\}/);
  assert.match(renderer,/onNavigate\?\.\(\)/);
  assert.doesNotMatch(renderer,/href=\{block\./);
  assert.doesNotMatch(renderer,/DEPARTURE_LABEL|pd-outbound-destination/);
  assert.match(renderer,/href=\{DEPARTURE_URL\}/);
});
