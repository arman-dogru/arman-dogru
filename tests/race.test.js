import test from 'node:test';
import assert from 'node:assert/strict';
import {DT,MAX_FWD,ROAD_HALF,wrap,nearest} from '../race-engine-v5.js';
import {createCar,updatePhysics,driveForVelocity,driverControl} from '../race-sim.js';
import {makeCircuit,evaluate} from '../scripts/race-evaluation.mjs';

test('player and AI have identical physics for the same inputs, including grass and runoff',()=>{
  const track=makeCircuit(),p=createCar(track,{player:true,offset:ROAD_HALF+7}),a=createCar(track,{driver:{rating:98,connections:[]},offset:ROAD_HALF+7});
  for(let i=0;i<1200;i++){const input={steer:Math.sin(i/80),drive:i<700?1:-1,handbrake:i>900?.5:0};updatePhysics(track,p,input);updatePhysics(track,a,input);for(const k of ['x','y','h','vx','vy','omega','steerAngle'])assert.equal(p[k],a[k]);assert.ok(Math.hypot(a.vx,a.vy)<MAX_FWD+1)}
  assert.deepEqual(a.metrics,p.metrics);assert.ok(p.metrics.grass>0);
});
test('crossing the asphalt edge does not reposition either car',()=>{
  const track=makeCircuit(),a=createCar(track,{driver:{rating:72,connections:[]},offset:ROAD_HALF+3}),before={x:a.x,y:a.y};
  updatePhysics(track,a,{drive:0});assert.equal(a.x,before.x);assert.equal(a.y,before.y);assert.ok(Math.abs(nearest(track,a.x,a.y).cross)>ROAD_HALF);
});
test('negative angles wrap correctly and simulation uses 120 Hz',()=>{
  assert.equal(DT,1/120);for(const angle of [-99,-12,-5,0,8,25]){assert.ok(Math.abs(wrap(angle))<=Math.PI);assert.ok(Math.abs(Math.sin(wrap(angle))-Math.sin(angle))<1e-12)}
});
test('traffic braking cannot turn a backwards roll into reverse acceleration',()=>{
  assert.ok(driveForVelocity(0,-8)>0);
  assert.equal(driveForVelocity(0,0),0);
  assert.equal(driveForVelocity(0,2),0);
  assert.ok(driveForVelocity(0,20)<0);
  assert.ok(driveForVelocity(2,0)>0);
});
test('the traffic planner passes stopped cars at reference pace at several circuit positions',()=>{
  // Hold pace at the previous controller's neutral 0.97 multiplier to isolate
  // traffic-planner regressions. Trained attack-pace packs are tested separately.
  const paceBias=Math.atanh(2*(.97-.6)/3.4-1);
  for(const blockerProgress of [42,350,1100,1700,2400]){
    const drivers=Array.from({length:9},(_,i)=>({name:`control${i}`,rating:90,connections:[[20,22,paceBias]]}));
    const result=evaluate(drivers,{scenario:'blocked',seed:809,seconds:180,blockerProgress});
    assert.equal(result.finished,9);assert.equal(result.contacts,0);assert.equal(result.wall_hits,0);assert.ok(result.max_stall_s<3);
  }
});
test('off-track recovery turns wrong-way cars around instead of following the circuit in reverse',()=>{
  const drivers=Array.from({length:9},(_,i)=>({name:`recovery${i}`,connections:[]}));
  // These starts place the last car near a hairpin with its nose pointing
  // against the nearest track segment. The old recovery objective rewarded
  // sustained reverse progress and held up the rest of the field.
  for(const seed of [809,1201]){
    const result=evaluate(drivers,{scenario:'recovery',seed,seconds:180});
    assert.equal(result.finished,9);assert.equal(result.contacts,0);
    assert.equal(result.wall_hits,0);assert.ok(result.max_stall_s<3);
    assert.ok(Math.max(...result.rows.map(r=>r.finish_ms))<135000);
  }
});
test('reorientation stays latched until the turn is complete',()=>{
  const track=makeCircuit(),car=createCar(track,{driver:{connections:[]},progress:1900});
  car.near=nearest(track,car.x,car.y,car.seg);
  car.h=car.near.heading+1.4;driverControl(track,car,[car]);assert.equal(car.reorienting,true);
  car.h=car.near.heading+.9;driverControl(track,car,[car]);assert.equal(car.reorienting,true);
  car.h=car.near.heading+.3;driverControl(track,car,[car]);assert.equal(car.reorienting,false);
});
test('a curved approach cannot lock a pass onto the stopped car\'s occupied centre lane',()=>{
  for(const headingOffset of [-.8,.8]){
    const track=makeCircuit(),car=createCar(track,{driver:{connections:[]},progress:191,headingOffset}),blocker=createCar(track,{player:true,progress:350});
    for(const c of [car,blocker])c.near=nearest(track,c.x,c.y,c.seg);
    driverControl(track,car,[car,blocker]);
    assert.equal(car.passTarget,blocker);assert.equal(Math.abs(car.passLane),16);
  }
});
