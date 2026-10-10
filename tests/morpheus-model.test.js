import test from 'node:test';
import assert from 'node:assert/strict';
import {answerMorpheus,readResponse,CONNECTION_REPLY} from '../grok-relay/morpheus-model.js';
import {MORPHEUS_VERSION} from '../chat-version.js';
const env={XAI_API_KEY:'test-only-secret',XAI_MODEL:'grok-4.3'},question={message:'Would Arman fit an AI engineer role at Example?',evidence:{profile:'public work'},history:[]};
const answer=(text,extra={})=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text}]}],...extra});
test('only final assistant output is shown, never reasoning or tool content',()=>{
  const result=readResponse(answer('Yes.',{output:[{type:'reasoning',summary:[{text:'private reasoning'}]},{type:'message',role:'tool',content:[{type:'output_text',text:'internal result'}]},{type:'message',role:'assistant',content:[{type:'output_text',text:'Yes.'},{type:'output_text',text:'He builds.'}]}]}));
  assert.equal(result.reply,'Yes.\n\nHe builds.');assert.equal(result.researched,false);
  for(const value of [null,{}, {output:{}},answer(''),answer('partial',{status:'incomplete'}),answer('bad',{error:{message:'internal'}})])assert.equal(readResponse(value).reply,'');
});
test('web research is available without external storage or executable tools',async()=>{
  let payload;const result=await answerMorpheus(question,env,{request:async(url,init)=>{assert.equal(url,'https://api.x.ai/v1/responses');payload=JSON.parse(init.body);return Response.json(answer('Yes.'))}});
  assert.equal(result.reply,'Yes.');assert.equal(payload.store,false);assert.equal(payload.model,'grok-4.3');assert.equal(payload.max_turns,4);assert.equal(payload.parallel_tool_calls,false);
  assert.deepEqual(payload.tools,[{type:'web_search'}]);assert.match(payload.instructions,/You are Morpheus from The Matrix/);assert.equal(payload.input[0].role,'user');assert.equal(payload.input.at(-1).content,question.message);
});
test('empty and transient responses retry once without repeating paid research',async()=>{
  for(const first of [()=>Response.json(answer('')),()=>new Response('upstream secret',{status:503}),()=>Response.json({output:[{type:'reasoning'}]})]){
    const calls=[];const result=await answerMorpheus(question,env,{request:async(url,init)=>{calls.push(JSON.parse(init.body));return calls.length===1?first():Response.json(answer('Yes. He sees the whole system.'))}});
    assert.equal(calls.length,2);assert.equal(result.degraded,false);assert.deepEqual(calls[1].tools,[]);assert.match(calls[1].instructions,/no verified live findings/);
  }
});
test('total failure, malformed JSON and authentication failure never expose raw errors',async()=>{
  for(const request of [async()=>{throw new Error('private diagnostic')},async()=>new Response('not JSON'),async()=>new Response('secret',{status:401})]){
    let calls=0;const result=await answerMorpheus(question,env,{request:async(...args)=>{calls++;return request(...args)}});
    assert.equal(result.reply,CONNECTION_REPLY);assert.equal(result.degraded,true);assert.equal(result.researched,false);assert.ok(calls<=2);assert.doesNotMatch(JSON.stringify(result),/secret|diagnostic/);
  }
});
test('a hung provider request is aborted by the request budget',async()=>{
  const result=await answerMorpheus(question,env,{timeoutMs:15,request:(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))))});
  assert.equal(result.degraded,true);
});
test('only real research supplies deduplicated safe citations',()=>{
  const data=answer('A team building agents. [[1]](https://example.com/careers)',{usage:{server_side_tool_usage_details:{web_search_calls:1}}});
  data.output[0].content[0].annotations=[{type:'url_citation',url:'https://example.com/careers',title:'Example careers'},{type:'url_citation',url:'javascript:alert(1)'},{type:'url_citation',url:'https://user:password@example.com'}];
  assert.deepEqual(readResponse(data).citations,[{url:'https://example.com/careers',title:'Example careers'}]);assert.equal(readResponse(data).researched,true);
  delete data.usage;assert.deepEqual(readResponse(data).citations,[]);
});
test('adjacent provider citations do not merge into an invented source URL',()=>{
  const data=answer('Fit.[[1]](https://one.test/job)[[2]](https://two.test/team)',{usage:{server_side_tool_usage_details:{web_search_calls:1}}});
  assert.deepEqual(readResponse(data).citations.map(x=>x.url),['https://one.test/job','https://two.test/team']);
});
test('operator can disable web research without changing the character prompt',async()=>{
  await answerMorpheus(question,{...env,MORPHEUS_WEB_SEARCH:'off'},{request:async(url,init)=>{assert.deepEqual(JSON.parse(init.body).tools,[]);return Response.json(answer('Yes.'))}});
});
test('legacy replies remain available for continuity without priming assistant style',async()=>{
  const history=[{role:'user',content:'Earlier question'},{role:'assistant',content:'Old HR-style assessment.'},{role:'user',content:'And now?'},{role:'assistant',content:'A current answer.',persona_version:MORPHEUS_VERSION}];
  await answerMorpheus({...question,history},env,{request:async(url,init)=>{
    const data=JSON.parse(init.body),reference=JSON.parse(data.input[0].content.slice(data.input[0].content.indexOf('{')));
    assert.deepEqual(reference.archived_conversation,history.slice(0,2));assert.equal(data.input[2].content,'A current answer.');assert.equal(data.input[2].role,'assistant');
    assert.equal(data.input.filter(x=>x.role==='assistant').length,1);return Response.json(answer('Yes.'));
  }});
});
