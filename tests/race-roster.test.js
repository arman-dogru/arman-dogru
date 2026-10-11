import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SIMULATION_SHA256,evaluate} from '../scripts/race-evaluation.mjs';
import {TRAINING_OBJECTIVE} from '../scripts/race-fitness.mjs';

const roster=JSON.parse(readFileSync(new URL('../neat-champions-v5.json',import.meta.url)));

test('shipped roster is distance-trained against the current shared simulation',()=>{
  assert.equal(roster.physics_sha256,SIMULATION_SHA256);
  assert.deepEqual(roster.training.objective,TRAINING_OBJECTIVE);
  assert.equal(roster.drivers.length,22);
  assert.equal(new Set(roster.drivers.map(d=>JSON.stringify([d.hidden,d.connections]))).size,22);
  assert.ok(roster.drivers.every(d=>Number.isFinite(d.fitness)&&d.fitness>0));
  assert.ok(roster.training.topology_mutation&&roster.training.innovation_aligned_crossover&&roster.training.speciation);
});

test('exported selection fitness reproduces as distance alone, with no safety reranking',()=>{
  const driver=roster.drivers[0],conditions=[{scenario:'grid'},...[42,350,1100,1700,2400].map(blockerProgress=>({scenario:'blocked',blockerProgress}))];
  const distances=conditions.map(options=>evaluate([driver],{...options,seed:19001,seconds:TRAINING_OBJECTIVE.episode_seconds,stopOnFinish:false}).rows[0].distance);
  const mean=distances.reduce((n,d)=>n+d,0)/distances.length;
  assert.ok(Math.abs(driver.fitness-mean)<1e-8,`stored ${driver.fitness}, measured ${mean}`);
});

test('every shipped policy completes real packs at attack pace, including an idle player',()=>{
  const rows=[];
  for(const scenario of ['grid','parked-grid'])for(let i=0;i<roster.drivers.length;i+=9){
    const pack=Array.from({length:9},(_,j)=>roster.drivers[(i+j)%roster.drivers.length]);
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
