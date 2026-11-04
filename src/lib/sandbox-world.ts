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
