import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {SIMULATION_SHA256,simulationSourceMatches} from './race-evaluation.mjs';
import {TRAINING_OBJECTIVE} from './race-fitness.mjs';
import {packCases,REGRESSION_SEEDS,UNSEEN_SEEDS} from './race-pack-cases.mjs';

const roster=JSON.parse(readFileSync(new URL('../neat-champions-v5.json',import.meta.url)));
const baseline=process.argv.includes('--baseline'),stress=process.argv.includes('--stress'),unseen=process.argv.includes('--unseen'),seeds=unseen?UNSEEN_SEEDS:REGRESSION_SEEDS,jobs=packCases(roster.drivers,{seeds,stress}),tests=[];
let next=0;
async function consume(){const worker=new Worker(new URL('./race-training-worker.mjs',import.meta.url));try{while(next<jobs.length){const job=jobs[next++],result=await new Promise((resolve,reject)=>{const onError=error=>{worker.off('message',onMessage);reject(error)},onMessage=d=>{worker.off('error',onError);d.error?reject(new Error(d.error)):resolve(d.result)};worker.once('message',onMessage);worker.once('error',onError);worker.postMessage({id:next,...job})});tests.push(result);console.log(`${result.scenario} seed=${result.seed}: ${result.finished}/${result.rows.length} finishes, grass ${result.grass_s.toFixed(2)}s, walls ${result.wall_hits}, contacts ${result.contacts}, longest stop ${result.max_stall_s.toFixed(2)}s`)}}finally{await worker.terminate()}}
await Promise.all(Array.from({length:4},consume));
const hash=SIMULATION_SHA256,sourceUnchanged=simulationSourceMatches()&&tests.every(t=>t.simulation_sha256===hash);
const failed=tests.filter(t=>t.rows.some(r=>!r.finish_ms||r.wall_hits>0||r.contacts>(t.scenario==='blocked'?2:0)||r.impacts>(t.scenario==='blocked'?1:0)||r.max_stall_s>(t.scenario==='grid'?3.5:6)||t.scenario!=='recovery'&&r.grass_s>(t.scenario==='blocked'?3:1)));
const performance=Object.fromEntries(['grid','parked-grid','blocked','recovery'].map(scenario=>{
  const rows=tests.filter(t=>t.scenario===scenario).flatMap(t=>t.rows),finished=rows.filter(r=>r.finish_ms!==null),times=finished.map(r=>r.finish_ms).sort((a,b)=>a-b);
  return[scenario,{starts:rows.length,finished:finished.length,mean_finish_ms:times.reduce((n,t)=>n+t,0)/times.length,p95_finish_ms:times[Math.ceil(times.length*.95)-1],best_finish_ms:times[0],worst_finish_ms:times.at(-1),mean_progress_speed:finished.reduce((n,r)=>n+r.distance/(r.finish_ms/1000),0)/finished.length}];
}));
const report={shared_physics:true,dt:1/120,episode_seconds:TRAINING_OBJECTIVE.episode_seconds,seeds,unseen,physics_sha256:hash,simulation_source_unchanged:sourceUnchanged,roster_physics_matches:roster.physics_sha256===hash,runs:tests.length,starts:tests.reduce((n,t)=>n+t.rows.length,0),finished:tests.reduce((n,t)=>n+t.finished,0),contacts:tests.reduce((n,t)=>n+t.contacts,0),wall_hits:tests.reduce((n,t)=>n+t.wall_hits,0),normal_grass_s:tests.filter(t=>t.scenario!=='recovery').reduce((n,t)=>n+t.grass_s,0),recovery_grass_s:tests.filter(t=>t.scenario==='recovery').reduce((n,t)=>n+t.grass_s,0),max_stop_s:Math.max(...tests.map(t=>t.max_stall_s)),failed_runs:failed.length,performance,tests};
mkdirSync('work',{recursive:true});writeFileSync(stress?'work/race-stress-validation.json':unseen?'work/race-unseen-validation.json':'work/race-validation.json',JSON.stringify({...report,stress},null,2));
console.log(JSON.stringify({...report,tests:undefined},null,2));
if(!sourceUnchanged||!baseline&&(failed.length||!report.roster_physics_matches))process.exitCode=1;
