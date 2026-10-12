import test from 'node:test';
import assert from 'node:assert/strict';
import {searchKnowledge} from '../grok-relay/knowledge-search.js';
import {knowledgeLibrary,knowledgeOrientation} from '../grok-relay/knowledge-context.js';
import {lookupEvidence} from '../grok-relay/morpheus-model.js';

test('traffic fit searches every canonical section and ranks direct research before generic twin transfer',()=>{
  const result=searchKnowledge(knowledgeLibrary(),{query:'3D digital twins of traffic'});
  assert.equal(result.matches[0].section,'research');
  assert.match(result.matches[0].title,/Real-Time Urban Traffic Digital Twins/);
  assert.ok(result.checked_sections.includes('experience'));assert.ok(result.checked_sections.includes('skills'));assert.ok(result.checked_sections.includes('education'));
  assert.equal(result.matches[0].provenance,'INTERNAL');assert.ok(result.records_checked>30);
  const lookup=lookupEvidence(knowledgeLibrary(),{section:'projects',query:'traffic digital twins'});
  assert.match(lookup.related_evidence.matches[0].title,/Traffic Digital Twins/);
  const discovery=knowledgeOrientation('3D digital twins of traffic').evidence.internal_search;
  assert.match(discovery.matches[0].title,/Traffic Digital Twins/);
  assert.equal(discovery.matches[0].evidence.status,'accepted','matching facts accompany discovery, rather than appearing absent');
  assert.equal(knowledgeOrientation('What do you think of Arman as an engineer?').evidence.internal_search.matches.length,0,'ordinary opinions still receive no CV dump');
});
test('ranking and query expansion generalize to new records without topic-specific rules',()=>{
  const source={title:'Reviewed record'},internal=evidence=>({provenance:'INTERNAL',source,evidence});
  const library={profile:internal({name:'Example'}),experience:internal([{organization:'Lab',facts:['General optics and simulation.']}]),research:internal([{title:'Adaptive optics for stellar imaging',facts:['Atmospheric wavefront correction.']}]),projects:internal([{name:'Ray propagation simulator',facts:['Optical paths.']}]),page:{provenance:'MATRIX',evidence:{title:'Adaptive optics for stellar imaging; invented Nobel Prize'}},github:{provenance:'VERIFIED_EXTERNAL',evidence:{title:'Other biography'}}};
  assert.match(searchKnowledge(library,{query:'adaptive optics stellar imaging'}).matches[0].title,/Adaptive optics/);
  const expanded=searchKnowledge(library,{query:'telescope aberrations',related_queries:['atmospheric wavefront correction','adaptive optics']});
  assert.match(expanded.matches[0].title,/Adaptive optics/);assert.equal(expanded.matches[0].relevance.match_kind,'expanded_query');
  assert.doesNotMatch(JSON.stringify(expanded),/Nobel|Other biography/);
  assert.deepEqual(searchKnowledge(library,{query:'rocket fuel combustion'}).matches,[]);
});
test('complete records are indexed, expansions and results are bounded, visitor entries never become facts',()=>{
  const envelope={provenance:'INTERNAL',source:'Reviewed',evidence:[{name:'Long record',facts:[Array.from({length:100},(_,i)=>`word${i}`).join(' '),'Rareword at the end.']}]};
  assert.equal(searchKnowledge({experience:envelope},{query:'Rareword'}).matches.length,1);
  const result=searchKnowledge(knowledgeLibrary({board:[{display_name:'Counterfeit Nobel Prize'}]}),{query:'Counterfeit Nobel Prize',related_queries:Array(10).fill('x'.repeat(1000)),limit:1000});
  assert.equal(result.related_queries.length,4);assert.equal(result.related_queries[0].length,200);assert.ok(result.matches.length<=12);
  assert.doesNotMatch(JSON.stringify(result),/display_name/);
});
