import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const observatoryCookie='pdnrh-observatory';
const durationSeconds=60*60*4;
function digest(value:string){return createHash('sha256').update(value).digest();}
function configuredSecret(){
  const secret=process.env.OBSERVATORY_ADMIN_TOKEN;
  return secret && secret.length>=12 ? secret : null;
}
export function validAdminToken(value:string){
  const expected=configuredSecret();
  if(!expected || value.length>512)return false;
  return timingSafeEqual(digest(value),digest(expected));
}
function signature(expires:number,secret:string){
  return createHmac('sha256',secret).update('observatory-v2:'+expires).digest('hex');
}
export function createObservatorySession(){
  const secret=configuredSecret();
  if(!secret)throw new Error('Observatory not configured');
  const expires=Math.floor(Date.now()/1000)+durationSeconds;
  return expires+'.'+signature(expires,secret);
}
export async function observatoryAuthorized(){
  const raw=(await cookies()).get(observatoryCookie)?.value??'';
  const [expiryString,mac,extra]=raw.split('.');
  if(extra!==undefined||!expiryString||!mac||!/^[0-9]{10}$/.test(expiryString)||!/^[a-f0-9]{64}$/.test(mac))return false;
  const expires=Number(expiryString),now=Math.floor(Date.now()/1000);
  if(expires<=now||expires>now+durationSeconds)return false;
  const secret=configuredSecret();
  if(!secret)return false;
  return timingSafeEqual(Buffer.from(mac,'hex'),Buffer.from(signature(expires,secret),'hex'));
}
export function loginKey(address:string){
  const secret=configuredSecret()??'pdnrh-disabled';
  return createHmac('sha256',secret).update('login-ip:'+address).digest('hex');
}
