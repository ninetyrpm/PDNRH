import Legacy from './legacy/page';
import PD13Game from './pd13-game';
export default function Home(){
 return process.env.PDNRH_GAME_ENGINE==='pd12d'?<Legacy/>:<PD13Game/>;
}
