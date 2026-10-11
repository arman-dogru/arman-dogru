import test from 'node:test';
import assert from 'node:assert/strict';
import {evolution} from '../scripts/neat-evolution.mjs';
import {compile,activate} from '../race-engine-v5.js';

test('NEAT adds real hidden nodes and feed-forward connections',()=>{
  const neat=evolution(20261010),genome=neat.fresh();for(let i=0;i<80;i++)neat.mutate(genome);
  assert.ok(Object.keys(genome.hidden).length>0);assert.ok(genome.genes.some(g=>!g.enabled));
  const exported=neat.exportGenome(genome),network=compile(exported),out=activate(network,Array(20).fill(.2));
  assert.equal(out.length,2);assert.ok(out.every(Number.isFinite));
  const levels={...Object.fromEntries(Array.from({length:21},(_,i)=>[i,0])),21:1,22:1,...genome.hidden};
  for(const c of genome.genes.filter(g=>g.enabled))assert.ok(levels[c.a]<levels[c.b]);
});
test('evolution is reproducible and breeding preserves the population size',()=>{
  const a=evolution(17),b=evolution(17),population=Array.from({length:48},()=>a.fresh());
  assert.deepEqual(a.exportGenome(population[0]).connections,b.exportGenome(b.fresh()).connections);
  population.forEach((g,i)=>g.fitness=i);const next=a.breed(population,1);
  assert.equal(next.length,48);assert.ok(next.every(g=>g.generation===1));
});
