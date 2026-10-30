import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const cookieName='pdnrh-observatory';
function digest(value:string){return createHash('sha256').update(value).digest();}
export function validAdminToken(value:string){
  const expected=process.env.OBSERVATORY_ADMIN_TOKEN;
  if(!expected || expected.length<12 || value.length>512)return false;
  return timingSafeEqual(digest(value),digest(expected));
}
export async function observatoryAuthorized(){
  const jar=await cookies();
  return validAdminToken(jar.get(cookieName)?.value??'');
}
export const observatoryCookie=cookieName;
