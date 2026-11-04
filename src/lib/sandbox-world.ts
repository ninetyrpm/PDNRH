export type AuthoredWorld={version:1;html:string;css:string;js:string};
export const WORLD_PROTOCOL='pdnrh-world-v1';
export const WORLD_LIMITS={html:12000,css:12000,js:8000} as const;
export function validateWorld(value:unknown):AuthoredWorld|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const w=value as Record<string,unknown>;
 if(w.version!==1)return null;
 for(const field of ['html','css','js'] as const){
  if(typeof w[field]!=='string'||w[field].length>WORLD_LIMITS[field]||
    w[field].includes(String.fromCharCode(0)))return null;
 }
 return {version:1,html:w.html as string,css:w.css as string,js:w.js as string};
}

/** The document lives in a sandboxed, opaque-origin iframe. It must not be
 * treated as a resource-limited VM: a runaway script can still consume CPU.
 */
export function worldDocument(world:AuthoredWorld,nonce:string):string{
 const valid=validateWorld(world);
 if(!valid)throw Error('Invalid authored world');
 if(!/^[a-zA-Z0-9_-]{24,96}$/.test(nonce))throw Error('Invalid nonce');
 const csp=["default-src 'none'","script-src 'unsafe-inline'","style-src 'unsafe-inline'",
  "img-src data:","font-src 'none'","connect-src 'none'","media-src 'none'",
  "object-src 'none'","frame-src 'none'","worker-src 'none'",
  "form-action 'none'","base-uri 'none'"].join('; ');
 const safeCss=valid.css.replaceAll('</style','<\\/style');
 const safeJs=valid.js.replaceAll('</script','<\\/script');
 const bridge=`
 (()=>{const protocol=${JSON.stringify(WORLD_PROTOCOL)},nonce=${JSON.stringify(nonce)};
 let count=0;
 document.addEventListener('click',event=>{
  const element=event.target;
  const id=element?.closest?.('[data-world-id]')?.getAttribute('data-world-id');
  if(!id||count++>=120||!(/^[a-z][a-z0-9_-]{0,31}$/).test(id))return;
  parent.postMessage({protocol,nonce,kind:'click',id},'*');
 },true);
 parent.postMessage({protocol,nonce,kind:'ready',id:'world'},'*');
 })();
 `;
 const cleanBridge=bridge.replaceAll('</script','<\\/script');
 return '<!doctype html><html><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<meta http-equiv="Content-Security-Policy" content="'+csp+'">'+
 '<style>html,body{margin:0;min-height:100%;background:#111318;color:#f1eee7;font-family:system-ui}*{box-sizing:border-box}</style>'+
 '<style>'+safeCss+'</style></head><body>'+valid.html+
 '<script>'+cleanBridge+'</script>'+
 (safeJs?'<script>'+safeJs+'</script>':'')+'</body></html>';
}
