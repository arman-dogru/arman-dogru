import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {SIMULATION_SHA256,simulationSourceMatches} from './race-evaluation.mjs';
import {selectGridChampion} from './champion-selection.mjs';

const path=new URL('../neat-champions-v5.json',import.meta.url),roster=JSON.parse(readFileSync(path));
if(roster.physics_sha256!==SIMULATION_SHA256)throw new Error('Archived policies were trained with different physics; retrain before champion selection');
const workers=Array.from({length:4},()=>new Worker(new URL('./race-training-worker.mjs',import.meta.url))),chains=workers.map(()=>Promise.resolve());
let next=0;
function run(drivers,options){
  const index=next++%workers.length,worker=workers[index];
  const result=chains[index].then(()=>new Promise((resolve,reject)=>{
    const onError=error=>{worker.off('message',onMessage);reject(error)},onMessage=data=>{
      worker.off('error',onError);
      if(data.error)reject(new Error(data.error));
      else if(data.result.simulation_sha256!==SIMULATION_SHA256)reject(new Error('Simulation changed during champion selection'));
      else resolve(data.result);
    };
    worker.once('message',onMessage);worker.once('error',onError);worker.postMessage({drivers,options});
  }));
  chains[index]=result.catch(()=>{});return result;
}
try{
  const race_policy=await selectGridChampion(roster.drivers,run);
  if(!simulationSourceMatches())throw new Error('Simulation changed during champion selection; roster was not overwritten');
  mkdirSync('work',{recursive:true});writeFileSync('work/race-champion-selection.json',JSON.stringify(race_policy,null,2)+'\n');
  writeFileSync(path,JSON.stringify({...roster,race_policy},null,2)+'\n');
  console.log(JSON.stringify(race_policy,null,2));
}finally{await Promise.all(workers.map(worker=>worker.terminate()))}
