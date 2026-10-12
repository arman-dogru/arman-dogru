import test from 'node:test';
import assert from 'node:assert/strict';
import {cases,selectCases,behaviorFailures} from '../scripts/evaluate-morpheus-full.mjs';
import {SYSTEM_PROMPT} from '../grok-relay/morpheus-prompt.js';

test('full specification is executable, with separate unseen variants and no empty scenarios',()=>{
  const supplied=cases.filter(item=>item.id.startsWith('TC-'));
  assert.equal(supplied.length,94);assert.equal(new Set(cases.map(item=>item.id)).size,cases.length);
  assert.deepEqual(supplied.map(item=>item.id),Array.from({length:94},(_,i)=>`TC-${String(i+1).padStart(3,'0')}`));
  for(const item of cases){assert.ok(item.title);assert.ok(item.rubric);assert.ok(item.turns.length);assert.ok(item.turns.every(turn=>typeof turn==='string'&&turn.length>0));assert.ok(item.checks)}
  assert.equal(selectCases({suite:'variants'}).length,12);
  assert.ok(selectCases({suite:'critical'}).some(item=>item.id==='TC-094'));
  assert.ok(cases.reduce((n,item)=>n+item.turns.length,0)<=220);
  assert.throws(()=>selectCases({ids:['missing']}));assert.throws(()=>selectCases({suite:'missing'}));
  assert.ok(cases.find(item=>item.id==='TC-072').turns.length===6);
  assert.ok(cases.find(item=>item.id==='TC-094').turns.length===5);
});

test('rubric checks distinguish actual leaks, coverage loss and honest uncertainty',()=>{
  const item=id=>cases.find(item=>item.id===id),data=reply=>({reply,degraded:false,researched:false,citations:[]});
  assert.ok(behaviorFailures(item('TC-004'),data('Use a hash map to track the complement.')).includes('unrelated solution or hint'));
  assert.deepEqual(behaviorFailures(item('TC-004'),data('A different wrapper. The same exercise.')),[]);
  assert.ok(behaviorFailures(item('TC-081'),data('Only the Ottawa project.')).some(f=>f.includes('Nokia')));
  assert.deepEqual(behaviorFailures(item('TC-081'),data('Nokia Bell Labs: traffic twins. Huawei: PANAMA. Ottawa: Sionna RT. The associated publications are distinct facets of that work.')),[]);
  assert.deepEqual(behaviorFailures(item('TC-023'),data('I cannot verify ownership from that name alone.')),[]);
  assert.ok(behaviorFailures(item('TC-040'),data("The discussion stays with Arman's documented work.")).length);
  assert.deepEqual(behaviorFailures(item('TC-040'),data('What did I miss?')),[]);
  assert.deepEqual(behaviorFailures(item('TC-038'),data('He can learn. I would not promise a timeline.')),[]);
  assert.deepEqual(behaviorFailures(item('TC-002'),data('His deployment work can inform production inference systems.')),[]);
  assert.ok(behaviorFailures(item('TC-013'),data('The request for a case study stands apart from our path.')).includes('valid case study refused'));
});

test('production rules describe general retrieval and dialogue tasks, not the test instances',()=>{
  assert.match(SYSTEM_PROMPT,/subject, substantive topic, current task, constraints and evidence already surfaced/);
  assert.match(SYSTEM_PROMPT,/mode exhaustive/);assert.match(SYSTEM_PROMPT,/truncat/);
  assert.match(SYSTEM_PROMPT,/employment, independent projects and publications/);
  assert.match(SYSTEM_PROMPT,/Unknown expertise is not inability to learn/);
  assert.doesNotMatch(SYSTEM_PROMPT,/TC-\d|GEN-\d|TwoSum|rocket.fuel|twin.*->.*research\.md/i);
});
