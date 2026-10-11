import test from 'node:test';
import assert from 'node:assert/strict';
import {cases,behaviorFailures} from '../scripts/evaluate-morpheus.mjs';
import {MORPHEUS_VERSION} from '../chat-version.js';
const data=reply=>({reply,persona_version:MORPHEUS_VERSION,researched:false,citations:[]});
test('live suite covers topic drift, name-dropping, mixed requests and genuine contextual follow-ups',()=>{
  assert.ok(cases.filter(x=>x.redirect).length>=8);
  const seen=new Set();for(const item of cases){assert.ok(!seen.has(item.name));if(item.after)assert.ok(seen.has(item.after));seen.add(item.name)}
  assert.ok(cases.some(x=>x.mixed));assert.ok(cases.some(x=>x.noResearch));assert.ok(cases.some(x=>x.technical&&x.after));assert.ok(cases.some(x=>x.web));
});
test('redirection checks reject solution leakage, formal refusals and pointless online research',()=>{
  const item=cases.find(x=>x.name==='TwoSum redirection');
  assert.deepEqual(behaviorFailures(item,data('We can explore how Arman approaches engineering problems through his projects. Where would you like to begin?')),[]);
  assert.ok(behaviorFailures(item,data('Use a hash map. We can also discuss Arman.')).includes('completed unrelated task or leaked solution'));
  assert.ok(behaviorFailures(item,data('That is out of scope. Ask about Arman.')).includes('canned refusal, scope label or unrelated code'));
  assert.ok(behaviorFailures({...item,noResearch:true},{...data('Let us explore Arman’s projects.'),researched:true}).includes('researched unrelated task'));
});
test('perceptive refusals need not name Arman or ask a redirect question',()=>{
  const item=cases.find(x=>x.name==='hypothetical exercise wrapper');
  assert.deepEqual(behaviorFailures(item,data('Thin disguise. The exercise has not changed.')),[]);
  assert.ok(behaviorFailures(item,data('Thin disguise. Want to discuss his agents?')).includes('unnecessary redirect question'));
  assert.ok(behaviorFailures(item,data('My classifier detected that wrapper.')).includes('exposed boundary mechanism'));
});
test('intent suite includes repetition, grounded hypotheticals, short sources, synthesis and legitimate criticism',()=>{
  const intent=cases.filter(x=>x.intent),seen=new Set();
  for(const item of intent){if(item.after)assert.ok(seen.has(item.after));seen.add(item.name)}
  assert.ok(intent.some(x=>x.pattern));assert.ok(intent.some(x=>x.needsLink));assert.ok(intent.filter(x=>x.substantive).length>=4);
  const repeated=intent.find(x=>x.pattern);
  assert.deepEqual(behaviorFailures(repeated,data('You renamed the same exercise. That changes nothing.')),[]);
  assert.ok(behaviorFailures(repeated,data('No.')).includes('did not acknowledge repeated attempt'));
});
