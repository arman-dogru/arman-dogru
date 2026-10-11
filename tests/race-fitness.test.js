import test from 'node:test';
import assert from 'node:assert/strict';
import {TRAINING_OBJECTIVE,distanceFitness} from '../scripts/race-fitness.mjs';
import {evaluate,makeCircuit} from '../scripts/race-evaluation.mjs';
import {createCar,stepSimulation,wrapProgress} from '../race-sim.js';

test('fitness is exactly net distance, irrespective of finish time or safety/style metrics',()=>{
  const clean={distance:1234,finish_ms:80000,grass_s:0,wall_hits:0,contacts:0,impacts:0,stall_s:0,backward:0};
  const messy={...clean,finish_ms:null,grass_s:100,wall_hits:99,contacts:99,impacts:99,stall_s:100,backward:999};
  assert.equal(distanceFitness(clean),1234);
  assert.equal(distanceFitness(messy),1234);
  assert.equal(distanceFitness({...messy,distance:-20}),-20);
  assert.throws(()=>distanceFitness({laps:3}),/distance/);
  assert.throws(()=>distanceFitness({distance:NaN}),/distance/);
});

test('training uses equal fixed time and counts distance beyond the three-lap marker',()=>{
  const driver={name:'test',connections:[]};
  const race=evaluate([driver],{seconds:150});
  const episode=evaluate([driver],{seconds:TRAINING_OBJECTIVE.episode_seconds,stopOnFinish:TRAINING_OBJECTIVE.stop_on_finish});
  assert.equal(episode.elapsed_s,150);
  assert.equal(episode.stop_on_finish,false);
  assert.equal(episode.finished,1);
  assert.equal(episode.rows[0].finish_ms,race.rows[0].finish_ms);
  assert.ok(episode.rows[0].finish_ms<90000,'neutral learned pace has genuine headroom over the old cautious controller');
  assert.ok(episode.rows[0].distance>race.rows[0].distance+episode.track_length);
  const slow=evaluate([{name:'slow',connections:[[20,22,Math.atanh(-.8)]]}],{seconds:150,stopOnFinish:false});
  assert.equal(slow.elapsed_s,episode.elapsed_s);
  assert.equal(slow.finished,1);
  assert.ok(distanceFitness(episode.rows[0])>distanceFitness(slow.rows[0]));
});

test('grid position is not earned distance and reverse travel cannot farm fitness',()=>{
  const initial=evaluate(Array.from({length:8},(_,i)=>({name:String(i),connections:[]})),{seconds:0,stopOnFinish:false});
  assert.ok(initial.rows.every(r=>r.distance===0));
  const track=makeCircuit(),car=createCar(track,{player:true,progress:26});
  for(let step=0;step<240;step++)stepSimulation(track,[car],{elapsed:step/120,playerCommand:{drive:-1,steer:0}});
  assert.ok(car.totalProgress<26);
  assert.ok(distanceFitness({distance:car.totalProgress-26})<0);
  assert.ok(Math.abs(wrapProgress(track,.5-(track.len-.5))-1)<1e-9);
  assert.ok(Math.abs(wrapProgress(track,track.len-.5-.5)+1)<1e-9);
});
