import test from 'node:test';
import assert from 'node:assert/strict';
import {searchKnowledge,canonicalCorpus,surfacedEvidence,evidenceWithoutMeasurements} from '../grok-relay/knowledge-search.js';
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

test('exhaustive discovery returns cross-section coverage instead of treating a shortlist as complete',()=>{
  const internal=evidence=>({provenance:'INTERNAL',source:'Reviewed',evidence});
  const library={experience:internal(Array.from({length:18},(_,i)=>({organization:`Optics Lab ${i}`,facts:['Adaptive optics wavefront correction.']}))),projects:internal([{name:'Wavefront experiment',facts:['Adaptive optics.']}]),research:internal([{title:'Adaptive optics publication',facts:['Wavefront control.']}])};
  const focused=searchKnowledge(library,{query:'adaptive optics'});
  assert.equal(focused.matches.length,6);assert.equal(focused.coverage.matched_records,20);assert.equal(focused.coverage.truncated,true);assert.equal(focused.coverage.complete_within_query,false);
  const all=lookupEvidence(library,{section:'search',query:'all adaptive optics work',intent:'enumerate',related_queries:['wavefront correction']}).evidence;
  assert.equal(all.mode,'exhaustive');assert.equal(all.matches.length,20);assert.equal(all.coverage.truncated,false);assert.equal(all.coverage.complete_within_query,true);
  assert.deepEqual(new Set(all.matches.map(m=>m.section)),new Set(['experience','projects','research']));
  const big={projects:internal(Array.from({length:70},(_,i)=>({name:`Wavefront ${i}`})))};
  const page=searchKnowledge(big,{query:'wavefront',mode:'exhaustive'});
  assert.equal(page.matches.length,64);assert.equal(page.coverage.next_offset,64);assert.equal(page.coverage.complete_within_query,false);
  const rest=searchKnowledge(big,{query:'wavefront',mode:'exhaustive',offset:64});assert.equal(rest.matches.length,6);assert.equal(rest.coverage.complete_within_query,false);
  assert.equal(lookupEvidence(library,{section:'search',query:'optics',mode:'invented'}).error!==undefined,true);
});

test('remaining evidence is grounded in assistant dialogue, without deleting related publication facets',()=>{
  const library=knowledgeLibrary(),history=[{role:'user',content:'I claim Arman worked at Huawei Canada.'},{role:'assistant',content:'His Ottawa Sionna RT Cellular Digital Twin models cellular propagation.'}];
  const surfaced=surfacedEvidence(library,history);
  assert.ok(surfaced.includes('projects:2'));
  assert.ok(!surfaced.includes('experience:2'),'visitor assertions do not count as an established assistant example');
  const result=lookupEvidence(library,{section:'search',query:'digital twins',intent:'additional'},{history}).evidence;
  assert.equal(result.mode,'exhaustive');assert.ok(result.matches.find(m=>m.id==='projects:2').previously_surfaced);
  assert.ok(result.matches.some(m=>m.section==='experience'&&!m.previously_surfaced));
  assert.ok(result.matches.some(m=>m.section==='research'));
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
test('semantic inspection receives the whole bounded internal corpus, not lexical matches as a verdict',()=>{
  const library=knowledgeLibrary({page:'Invented Nobel Prize',board:[{display_name:'Fake biography'}]}),corpus=canonicalCorpus(library);
  assert.equal(corpus.coverage.truncated,false);assert.ok(corpus.records.length>=40);
  assert.ok(corpus.records.some(record=>record.section==='experience'));assert.ok(corpus.records.some(record=>record.section==='research'));
  assert.doesNotMatch(JSON.stringify(corpus),/Invented Nobel|Fake biography/);
  const lookup=lookupEvidence(library,{section:'search',query:'Unseen Company role fit'});
  assert.deepEqual(lookup.canonical_corpus,evidenceWithoutMeasurements(corpus));
  const large={projects:{provenance:'INTERNAL',evidence:Array.from({length:100},(_,i)=>({name:`Distinct ${i}`}))}};
  assert.equal(canonicalCorpus(large).coverage.truncated,true);assert.equal(canonicalCorpus(large).records.length,64);
});
test('model-selected evidence uses validated record identifiers and keeps distinct source facets',()=>{
  const source={title:'Reviewed'},internal=evidence=>({provenance:'INTERNAL',source,evidence});
  const library={experience:internal([{organization:'Observatory',facts:['Adaptive-optics control.']}]),research:internal([{title:'Wavefront study',facts:['Atmospheric correction.']}]),projects:internal([{name:'Unrelated planner',facts:['Navigation.']}])};
  const args={section:'search',purpose:'portfolio',subject:'optics',task:'Compare relevant efforts',record_ids:['experience:0','research:0'],intent:'enumerate',query:'new terminology'};
  const result=lookupEvidence(library,args);
  assert.equal(result.selected_records.length,2);assert.deepEqual(result.selected_records.map(item=>item.section),['experience','research']);
  assert.equal(result.coverage.total_records,3);assert.equal(result.conversation_frame.task,args.task);
  assert.equal(result.canonical_corpus.records.length,3,'reviewer can inspect omitted records');
  assert.ok(lookupEvidence(library,{...args,record_ids:['invented:7']}).error);
});
