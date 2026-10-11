import {Worker} from 'node:worker_threads';
import {availableParallelism} from 'node:os';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {evolution} from './neat-evolution.mjs';
import {rng,SIMULATION_SHA256,simulationSourceMatches} from './race-evaluation.mjs';
import {TRAINING_OBJECTIVE,distanceFitness} from './race-fitness.mjs';
import {packCases,REGRESSION_SEEDS} from './race-pack-cases.mjs';
import {selectGridChampion} from './champion-selection.mjs';

const args=Object.fromEntries(process.argv.slice(2).filter(x=>x.startsWith('--')).map(x=>x.slice(2).split('=')));
const checkpoint=args.checkpoint?JSON.parse(readFileSync(args.checkpoint)):null;
if(checkpoint&&(JSON.stringify(checkpoint.objective)!==JSON.stringify(TRAINING_OBJECTIVE)||checkpoint.physics_sha256!==SIMULATION_SHA256))throw new Error('Checkpoint objective or simulation differs; start fresh distance-only training.');
const seed=Number(checkpoint?.seed||args.seed||20261011),size=Number(checkpoint?.population?.length||args.population||64),generations=Number(checkpoint?.generation||args.generations||100),packSize=8;
if(!Number.isSafeInteger(size)||size<24||size%packSize||!Number.isSafeInteger(generations)||generations<1||!Number.isSafeInteger(seed))throw new Error('Use an integer seed, population >=24 in multiples of eight, and generations >=1.');
const episodeOptions={seconds:TRAINING_OBJECTIVE.episode_seconds,stopOnFinish:TRAINING_OBJECTIVE.stop_on_finish};
const old=JSON.parse(readFileSync(new URL('../neat-champions-v5.json',import.meta.url))),neat=evolution(seed),random=rng(seed+77),started=Date.now();
mkdirSync('work',{recursive:true});
const workers=Array.from({length:Math.min(4,availableParallelism())},()=>new Worker(new URL('./race-training-worker.mjs',import.meta.url))),queue=[],pending=new Map();let serial=0;
function pump(worker){if(worker.busy||!queue.length)return;const job=queue.shift();worker.busy=true;pending.set(job.id,{...job,worker});worker.postMessage({id:job.id,drivers:job.drivers,options:job.options})}
for(const worker of workers){worker.on('message',data=>{const job=pending.get(data.id);pending.delete(data.id);worker.busy=false;if(data.error)job.reject(new Error(data.error));else if(data.result.simulation_sha256!==SIMULATION_SHA256)job.reject(new Error('Simulation changed while workers started; rerun training.'));else job.resolve(data.result);pump(worker)});worker.on('error',error=>{for(const job of pending.values())if(job.worker===worker)job.reject(error)})}
function run(drivers,options){return new Promise((resolve,reject)=>{queue.push({id:serial++,drivers,options,resolve,reject});for(const worker of workers)pump(worker)})}
function shuffle(array){array=[...array];for(let i=array.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[array[i],array[j]]=[array[j],array[i]]}return array}
const signature=g=>JSON.stringify([g.hidden,g.connections]);
let population=checkpoint?.population||Array.from({length:size},()=>neat.fresh()),archive=new Map((checkpoint?.archive||[]).map(g=>[signature(g),g])),history=checkpoint?.history||[];
console.log(checkpoint?`Screening completed generation ${generations}; ${workers.length} CPU workers.`:`Training ${size} genomes for ${generations} generations; ${workers.length} CPU workers; shared 120 Hz browser physics.`);
try{
  for(let gen=checkpoint?generations+1:1;gen<=generations;gen++){
    const scores=new Map(population.map(g=>[g.id,[]])),episodes=[];
    for(let round=0;round<2;round++){
      const order=shuffle(population),scenario=round===0?'grid':gen%5===0?'recovery':'blocked';
      for(let i=0;i<order.length;i+=packSize){const pack=order.slice(i,i+packSize).map(neat.exportGenome),blockerProgress=[42,350,1100,1700,2400][(gen+i/packSize)%5];episodes.push(run(pack,{...episodeOptions,seed:seed+gen*101+round*31+i,scenario,blockerProgress}).then(result=>{for(const row of result.rows){const id=Number(row.name.slice(7));scores.get(id).push(distanceFitness(row))}return result}))}
    }
    const results=await Promise.all(episodes);
    for(const g of population)g.fitness=scores.get(g.id).reduce((a,b)=>a+b,0)/scores.get(g.id).length;
    population.sort((a,b)=>b.fitness-a.fitness);
    for(const g of population.slice(0,12)){const exported=neat.exportGenome(g),key=signature(exported),prev=archive.get(key);if(!prev||exported.fitness>prev.fitness)archive.set(key,exported)}
    if(archive.size>192)archive=new Map([...archive].sort((a,b)=>b[1].fitness-a[1].fitness).slice(0,192));
    const summary={generation:gen,best:+population[0].fitness.toFixed(2),median:+population[Math.floor(size/2)].fitness.toFixed(2),species:neat.species(population).length,hidden:Object.keys(population[0].hidden).length,finished:results.reduce((n,r)=>n+r.finished,0),starts:results.reduce((n,r)=>n+r.rows.length,0),contacts:results.reduce((n,r)=>n+r.contacts,0),grass_s:+results.reduce((n,r)=>n+r.grass_s,0).toFixed(2)};history.push(summary);
    writeFileSync('work/neat-checkpoint.json',JSON.stringify({seed,objective:TRAINING_OBJECTIVE,physics_sha256:SIMULATION_SHA256,generation:gen,history,archive:[...archive.values()],population}));
    console.log(`gen ${String(gen).padStart(2)}: best ${summary.best}, median ${summary.median}, species ${summary.species}, finishes ${summary.finished}/${summary.starts}, contacts ${summary.contacts}, grass ${summary.grass_s}s`);
    if(gen<generations)population=neat.breed(population,gen);
  }
  // Rank the archive by the same distance-only objective, in identical solo
  // conditions. Collisions/grass/stalls are diagnostics, never hidden penalties.
  const candidates=[...archive.values()].sort((a,b)=>b.fitness-a.fitness),qualified=[];
  console.log(`Ranking ${candidates.length} archived policies by fixed-time distance on open track and five stopped-car positions.`);
  const screens=await Promise.all(candidates.map(async g=>{const tests=await Promise.all([{scenario:'grid'},...[42,350,1100,1700,2400].map(blockerProgress=>({scenario:'blocked',blockerProgress}))].map(options=>run([g],{...episodeOptions,seed:19001,...options})));return{g,tests}}));
  for(const {g,tests} of screens)if(tests.every(r=>r.finished===1))qualified.push({...g,pack_fitness:g.fitness,fitness:tests.reduce((n,r)=>n+distanceFitness(r.rows[0]),0)/tests.length,solo_ms:tests[0].rows[0].finish_ms});
  qualified.sort((a,b)=>b.fitness-a.fitness);
  if(qualified.length<22)throw new Error(`Only ${qualified.length} policies completed screening races; roster was not overwritten.`);
  let chosen=qualified.slice(0,22),validation;
  const rejected=new Set(),selectionHistory=[];
  const makeRoster=policies=>old.drivers.map((d,i)=>({...policies[i],name:d.name,rating:d.rating}));
  for(let attempt=0;attempt<12;attempt++){
    const drivers=makeRoster(chosen),tests=packCases(drivers,{seeds:[701,809,911,1201,2027,...REGRESSION_SEEDS]}).map(job=>run(job.drivers,job.options));
    const results=await Promise.all(tests),bad=new Set;
    // Completion is a release check, not an additional evolutionary reward.
    for(const result of results)for(const row of result.rows)if(!row.finish_ms)bad.add(row.name);
    validation={runs:results.length,starts:results.reduce((n,r)=>n+r.rows.length,0),finished:results.reduce((n,r)=>n+r.finished,0),total_grass_s:results.reduce((n,r)=>n+r.grass_s,0),total_wall_hits:results.reduce((n,r)=>n+r.wall_hits,0),total_collisions:results.reduce((n,r)=>n+r.contacts,0),max_stall_s:Math.max(...results.map(r=>r.max_stall_s)),force_field_assists:0,shared_physics:true,dt:1/120,results};
    selectionHistory.push({attempt:attempt+1,failed:[...bad],policies:chosen.map(g=>g.name)});
    writeFileSync('work/neat-training-report.json',JSON.stringify({seed,objective:TRAINING_OBJECTIVE,population:size,generations,history,qualified:qualified.length,selectionHistory,validation},null,2));
    console.log(`Pack selection ${attempt+1}: ${validation.finished}/${validation.starts} finishes, ${validation.total_collisions} contacts, ${validation.total_wall_hits} walls, ${bad.size} policies failed to finish.`);
    if(!bad.size)break;
    chosen.forEach((g,i)=>{if(bad.has(old.drivers[i].name))rejected.add(signature(g))});
    const used=new Set(chosen.map(signature)),replacements=qualified.filter(g=>!used.has(signature(g))&&!rejected.has(signature(g)));
    if(replacements.length<bad.size)throw new Error('No untested qualified replacements remain; roster was not overwritten.');
    chosen=chosen.map((g,i)=>bad.has(old.drivers[i].name)?replacements.shift()||g:g);
    if(attempt===11)throw new Error('Pack completion gate failed; inspect work/neat-training-report.json before exporting.');
  }
  const report={seed,objective:TRAINING_OBJECTIVE,population:size,generations,pack_size:packSize,episodes:history.reduce((n,r)=>n+r.starts,0),simulation_step:1/120,elapsed_s:checkpoint?null:(Date.now()-started)/1000,selection_elapsed_s:checkpoint?(Date.now()-started)/1000:undefined,history,qualified:qualified.length,selectionHistory,validation};
  writeFileSync('work/neat-training-report.json',JSON.stringify(report,null,2));
  const drivers=makeRoster(chosen),race_policy=await selectGridChampion(drivers,run);
  if(!simulationSourceMatches())throw new Error('Simulation changed during the run; roster was not overwritten. Rerun selection against the current code.');
  const roster={version:'neat-race-v5',seed,track:'istanbul-park-v4',population:size,generations,pack_size:packSize,pack_rounds_per_generation:2,input_count:20,bias_node:20,output_nodes:[21,22],controller:'shared-physics trajectory planner, predictive traffic separation, learned NEAT steering and pace, ordinary reverse recovery',road_width_cars:5.4,physics_sha256:SIMULATION_SHA256,training:{objective:TRAINING_OBJECTIVE,episodes:report.episodes,elapsed_s:report.elapsed_s,qualified:qualified.length,topology_mutation:true,innovation_aligned_crossover:true,speciation:true},validation:{...validation,results:undefined},drivers,race_policy};
  writeFileSync(new URL('../neat-champions-v5.json',import.meta.url),JSON.stringify(roster,null,2)+'\n');
  console.log(`Exported 22 qualified drivers. Report: work/neat-training-report.json (${((Date.now()-started)/1000).toFixed(1)}s this run)`);
}finally{await Promise.all(workers.map(w=>w.terminate()))}
