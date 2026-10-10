import {scoreFor,validateName,VERSION,GLOBAL_TRACK,RACERS} from './race-engine-v5.js';

export function createLeaderboard({storage=localStorage,request=fetch,endpoint=()=>window.ARMAN_BOARD_ENDPOINT}={}){
  const key='arman.raceResults.v5';
  let remote=[],status='loading',message='';
  if(!storage.getItem(key)){try{const old=JSON.parse(storage.getItem('arman.raceResults.v4')||'[]');if(Array.isArray(old)&&old.length)storage.setItem(key,JSON.stringify(old.filter(x=>x&&Number.isFinite(x.score)&&x.display_name).map(x=>({...x,pending:true}))))}catch{}}
  const local=()=>{try{const rows=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(rows)?rows.filter(x=>x&&Number.isFinite(x.score)&&typeof x.display_name==='string'):[]}catch{return[]}};
  function keep(row){const rows=local(),id=row.display_name.toLocaleLowerCase(),old=rows.find(x=>x.display_name.toLocaleLowerCase()===id);if(!old||row.score>=old.score){storage.setItem(key,JSON.stringify([...rows.filter(x=>x!==old),row].sort((a,b)=>b.score-a.score).slice(0,100)))}}
  function rows(){const best=new Map;for(const row of [...remote,...local()]){const id=row.display_name.toLocaleLowerCase(),old=best.get(id);if(!old||row.score>old.score||row.score===old.score&&!row.pending)best.set(id,row)}return [...best.values()].sort((a,b)=>b.score-a.score||a.elapsed_ms-b.elapsed_ms).slice(0,12)}
  async function load(){
    try{const res=await request(endpoint(),{cache:'no-store',signal:AbortSignal.timeout(10000)}),data=await res.json();if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);if(!Array.isArray(data.entries))throw new Error('Leaderboard endpoint is out of date.');if(data.configured===false)throw new Error('Global leaderboard storage is not configured.');remote=data.entries;status='online';message=''}catch(e){status='offline';message=e.message}
    return rows();
  }
  async function save({display_name,elapsed_ms,position}){
    const valid=validateName(display_name);if(!valid.ok)return{ok:false,error:valid.error};
    if(!Number.isFinite(elapsed_ms)||elapsed_ms<45000||elapsed_ms>900000||!Number.isInteger(position)||position<1||position>RACERS)return{ok:false,error:'Invalid race result.'};
    const payload={display_name:valid.name,elapsed_ms:Math.round(elapsed_ms),position,score:scoreFor(Math.round(elapsed_ms),position),game_version:VERSION,track:GLOBAL_TRACK};
    try{
      const res=await request(endpoint(),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)}),data=await res.json();
      if(!res.ok){if(res.status<500&&res.status!==429)return{ok:false,error:data.error||`HTTP ${res.status}`};throw new Error(data.error||`HTTP ${res.status}`)}
      if(!data.ok||!Array.isArray(data.entries))throw new Error('Leaderboard endpoint is out of date.');
      keep({...payload,pending:false});remote=data.entries;status='online';message='';return{ok:true,pending:false,rows:rows()};
    }catch(e){keep({...payload,pending:true});status='offline';message=e.message;return{ok:true,pending:true,error:e.message,rows:rows()}}
  }
  async function retry(){for(const row of local().filter(x=>x.pending))await save(row);return rows()}
  return{load,save,retry,rows,get status(){return status},get message(){return message},get pending(){return local().filter(x=>x.pending).length}};
}
