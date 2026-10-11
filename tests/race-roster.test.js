import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SIMULATION_SHA256,evaluate} from '../scripts/race-evaluation.mjs';
import {TRAINING_OBJECTIVE} from '../scripts/race-fitness.mjs';
import {championDriver,championRoster} from '../race-roster.js';
import {selectGridChampion} from '../scripts/champion-selection.mjs';

const roster=JSON.parse(readFileSync(new URL('../neat-champions-v5.json',import.meta.url)));

test('trained archive is distance-trained against the current shared simulation',()=>{
  assert.equal(roster.physics_sha256,SIMULATION_SHA256);
  assert.deepEqual(roster.training.objective,TRAINING_OBJECTIVE);
  assert.equal(roster.drivers.length,22);
  assert.equal(new Set(roster.drivers.map(d=>JSON.stringify([d.hidden,d.connections]))).size,22);
  assert.ok(roster.drivers.every(d=>Number.isFinite(d.fitness)&&d.fitness>0));
  assert.ok(roster.training.topology_mutation&&roster.training.innovation_aligned_crossover&&roster.training.speciation);
});

test('every runtime opponent uses exactly the qualified champion, preserving only cosmetic identities',()=>{
  const champion=championDriver(roster.drivers,roster.race_policy.champion_name),drivers=championRoster(roster.drivers,roster.race_policy.champion_name);
  assert.equal(roster.race_policy.mode,'single-champion');
  assert.equal(champion.fitness,roster.race_policy.fitness);
  assert.equal(roster.race_policy.validation.finished,roster.race_policy.validation.starts);
  assert.equal(drivers.length,22);
  assert.deepEqual(drivers.map(d=>[d.name,d.rating]),roster.drivers.map(d=>[d.name,d.rating]));
  for(const driver of drivers){
    assert.deepEqual(driver.hidden,champion.hidden);
    assert.deepEqual(driver.connections,champion.connections);
    assert.equal(driver.generation,champion.generation);
    assert.equal(driver.fitness,champion.fitness);
  }
  assert.equal(new Set(drivers.map(d=>JSON.stringify([d.hidden,d.connections]))).size,1);
  assert.equal(new Set(roster.drivers.map(d=>JSON.stringify([d.hidden,d.connections]))).size,22,'archive remains unchanged');
});

test('champion selection uses distance fitness, not generation, rating or lap time',()=>{
  const best={name:'best',fitness:200,generation:3,rating:72,solo_ms:90000};
  const later={name:'later',fitness:100,generation:99,rating:98,solo_ms:80000};
  assert.equal(championDriver([later,best]),best);
  assert.equal(championDriver([best,later]),best);
  assert.throws(()=>championDriver([]),/distance fitness/);
  assert.throws(()=>championDriver([{fitness:NaN}]),/distance fitness/);
  assert.throws(()=>championDriver([best,later],'missing'),/missing/);
});

test('cloned-grid qualification ranks by distance and rejects only non-completion, not driving incidents',async()=>{
  const drivers=Array.from({length:22},(_,i)=>({name:`model-${i}`,fitness:100-i,generation:i,connections:[[20,22,i]]}));
  const result=await selectGridChampion(drivers,async clones=>({rows:clones,finished:clones[0].fitness===100?2:clones.length,contacts:100,wall_hits:20,max_stall_s:10}));
  assert.equal(result.champion_name,'model-1');
  assert.equal(result.rejected[0].name,'model-0');
  assert.equal(result.validation.starts,864);
  assert.equal(result.validation.finished,864);
  assert.ok(result.validation.contacts>0,'incidents are diagnostic, not hidden fitness penalties');
});

test('exported selection fitness reproduces as distance alone, with no safety reranking',()=>{
  const driver=championDriver(roster.drivers,roster.race_policy.champion_name),conditions=[{scenario:'grid'},...[42,350,1100,1700,2400].map(blockerProgress=>({scenario:'blocked',blockerProgress}))];
  const distances=conditions.map(options=>evaluate([driver],{...options,seed:19001,seconds:TRAINING_OBJECTIVE.episode_seconds,stopOnFinish:false}).rows[0].distance);
  const mean=distances.reduce((n,d)=>n+d,0)/distances.length;
  assert.ok(Math.abs(driver.fitness-mean)<1e-8,`stored ${driver.fitness}, measured ${mean}`);
});

test('cloned champion grid completes real packs at attack pace, including an idle player',()=>{
  const rows=[],drivers=championRoster(roster.drivers,roster.race_policy.champion_name);
  for(const scenario of ['grid','parked-grid'])for(let i=0;i<drivers.length;i+=9){
    const pack=Array.from({length:9},(_,j)=>drivers[(i+j)%drivers.length]);
    const result=evaluate(pack,{scenario,seed:17389+i,seconds:150});
    assert.equal(result.finished,9,`${scenario} pack ${i}: all drivers finish`);
    assert.equal(result.wall_hits,0,`${scenario} pack ${i}: no wall riding`);
    rows.push(...result.rows);
  }
  // An observable release regression check, not a term in evolutionary fitness.
  // The previous local roster averaged 113s (grid) / 117s (idle-player grid).
  const mean=rows.reduce((n,r)=>n+r.finish_ms,0)/rows.length;
  assert.ok(mean<100000,`three-lap pack mean ${mean}ms should remain below 100s`);
});
