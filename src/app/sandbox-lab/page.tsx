import {observatoryAuthorized} from '@/lib/observatory-auth';
import Unlock from '../observatory/unlock';
import SandboxLab from './lab-client';
export const dynamic='force-dynamic';
export default async function SandboxLabPage(){
 if(!await observatoryAuthorized())return <Unlock/>;
 return <SandboxLab/>;
}
