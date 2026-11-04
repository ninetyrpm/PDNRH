import {validateWorld,type AuthoredWorld} from './sandbox-world';

export type GenerationDiagnostics={
  finishReason:string;outputLength:number;
  completionTokens:number|null;promptTokens:number|null;
};
export type GenerationResult=
  |{ok:true;world:AuthoredWorld;diagnostics:GenerationDiagnostics}
  |{ok:false;code:'empty'|'truncated'|'refused'|'malformed_json'|'invalid_world';message:string;diagnostics:GenerationDiagnostics};

export function interpretGeneratedWorld(response:unknown):GenerationResult{
 const data=response&&typeof response==='object'?response as Record<string,unknown>:{};
 const choices=Array.isArray(data.choices)?data.choices:[];
 const first=choices[0]&&typeof choices[0]==='object'?choices[0] as Record<string,unknown>:{};
 const message=first.message&&typeof first.message==='object'?first.message as Record<string,unknown>:{};
 const usage=data.usage&&typeof data.usage==='object'?data.usage as Record<string,unknown>:{};
 const raw=typeof message.content==='string'?message.content:'';
 const finishReason=typeof first.finish_reason==='string'?first.finish_reason:'unknown';
 const diagnostics:GenerationDiagnostics={
  finishReason,outputLength:raw.length,
  completionTokens:typeof usage.completion_tokens==='number'?usage.completion_tokens:null,
  promptTokens:typeof usage.prompt_tokens==='number'?usage.prompt_tokens:null
 };
 const failure=(code:Extract<GenerationResult,{ok:false}>['code'],message:string):GenerationResult=>
  ({ok:false,code,message,diagnostics});
 if(finishReason==='length')return failure('truncated','Generation exceeded its token budget before the JSON was complete. Try a more focused concept.');
 if(message.refusal||finishReason==='content_filter')return failure('refused','The model did not produce an authorized design.');
 if(!raw.trim())return failure('empty','The model returned no content.');
 let parsed:unknown;
 try{parsed=JSON.parse(raw);}
 catch{return failure('malformed_json','The model returned malformed JSON. Please retry or simplify the requested design.');}
 const world=validateWorld(parsed);
 if(!world)return failure('invalid_world','The generated design did not pass its structural limits. Try a simpler design.');
 return {ok:true,world,diagnostics};
}
