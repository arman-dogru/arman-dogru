import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeTrack,normalizeGeo,DT} from '../race-engine-v5.js';
import {createCar,stepSimulation} from '../race-sim.js';
const geometry=JSON.parse(readFileSync(new URL('../race-track-istanbul.json',import.meta.url)));
function sourceHash(){const hash=createHash('sha256');for(const file of ['race-engine-v5.js','race-sim.js','race-track-istanbul.json'])hash.update(file+'\0').update(readFileSync(new URL('../'+file,import.meta.url)));return hash.digest('hex')}
export const SIMULATION_SHA256=sourceHash();
export const simulationSourceMatches=()=>sourceHash()===SIMULATION_SHA256;
export const makeCircuit=()=>makeTrack(normalizeGeo(geometry.coordinates),{name:'Istanbul Park'});
export function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function evaluate(drivers,{seconds=150,seed=1,scenario='grid',stopOnFinish=true,blockerProgress=42}={}){
  const track=makeCircuit(),random=rng(seed),order=[...drivers];
  for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
  const cars=order.map((driver,i)=>createCar(track,{driver,progress:26-i*24,offset:i%2?12:-12}));
  if(scenario==='blocked')cars.unshift(createCar(track,{player:true,progress:blockerProgress,offset:0}));
  if(scenario==='parked-grid')cars.unshift(createCar(track,{player:true,progress:26-9*24,offset:12}));
  if(scenario==='recovery')for(let i=0;i<cars.length;i++){const base=createCar(track,{driver:order[i],progress:track.len*(i+.17)/cars.length,offset:(i%2?1:-1)*(22+random()*10),headingOffset:(random()-.5)*1.8,speed:10});Object.assign(cars[i],base,{totalProgress:0})}
  const starts=new Map(cars.map(c=>[c,c.totalProgress]));
  const snapshot=c=>({name:c.name,rating:c.rating,laps:c.totalProgress/track.len,distance:c.totalProgress-starts.get(c),finish_ms:c.finishMs,grass_s:c.metrics.grass,wall_hits:c.metrics.walls,contacts:c.metrics.contacts,impacts:c.metrics.impacts,stall_s:c.metrics.stall,max_stall_s:c.metrics.max_stall,backward:c.metrics.backward});
  const finishers=new Map();
  const steps=Math.round(seconds/DT);let completedSteps=0;
  for(let step=0;step<steps;step++){
    stepSimulation(track,cars,{elapsed:step*DT});
    completedSteps++;
    for(const c of cars)if(!c.player&&c.finished&&!finishers.has(c))finishers.set(c,snapshot(c));
    if(stopOnFinish&&finishers.size===drivers.length)break;
  }
  // Fixed-time training must not freeze progress at the three-lap marker.
  const rows=cars.filter(c=>!c.player).map(c=>stopOnFinish?(finishers.get(c)||snapshot(c)):snapshot(c));
  return{scenario,seed,simulation_sha256:SIMULATION_SHA256,elapsed_s:completedSteps*DT,stop_on_finish:stopOnFinish,track_length:track.len,blocker_progress:scenario==='blocked'?blockerProgress:scenario==='parked-grid'?26-9*24:null,rows,finished:rows.filter(r=>r.finish_ms!==null).length,min_laps:Math.min(...rows.map(x=>x.laps)),mean_laps:rows.reduce((n,x)=>n+x.laps,0)/rows.length,mean_distance:rows.reduce((n,x)=>n+x.distance,0)/rows.length,grass_s:rows.reduce((n,x)=>n+x.grass_s,0),wall_hits:rows.reduce((n,x)=>n+x.wall_hits,0),contacts:rows.reduce((n,x)=>n+x.contacts,0)/2,impacts:rows.reduce((n,x)=>n+x.impacts,0)/2,max_stall_s:Math.max(...rows.map(x=>x.max_stall_s))};
}
