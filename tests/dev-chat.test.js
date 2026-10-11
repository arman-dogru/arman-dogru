import test from 'node:test';
import assert from 'node:assert/strict';
import {developmentChat,previewStatus} from '../scripts/dev-chat.mjs';
const request=()=>new Request('http://localhost:4173/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'Local test'})});
test('local chat never silently falls back to production when the key is absent',async()=>{
  const never=()=>{throw new Error('must not contact another worker')};
  const response=await developmentChat(request(),{},{worker:{fetch:never},requestPublic:never});
  assert.equal(response.status,503);assert.equal((await response.json()).error,'local_key_missing');
  assert.deepEqual(previewStatus({}),{mode:'local prompt',key_configured:false,ready:false});
});
test('configured preview runs the checked-out worker and does not expose its key',async()=>{
  const env={XAI_API_KEY:'test-only-not-a-real-key'};
  const response=await developmentChat(request(),env,{worker:{fetch:async(req,received)=>{
    assert.equal(received,env);assert.equal((await req.json()).message,'Local test');return Response.json({reply:'Local answer'});
  }},requestPublic:()=>{throw new Error('must not contact production')}});
  assert.equal((await response.json()).reply,'Local answer');
  assert.doesNotMatch(JSON.stringify(previewStatus(env)),/test-only/);
});
test('public relay mode is explicit opt-in, never inferred from missing credentials',async()=>{
  const response=await developmentChat(request(),{},{publicChat:true,worker:{fetch:()=>{throw new Error('wrong worker')}},requestPublic:async(url,init)=>{
    assert.equal(url,'https://arman-dogru-chat.arman-dogru.workers.dev/');assert.equal(JSON.parse(new TextDecoder().decode(init.body)).message,'Local test');return Response.json({reply:'Public answer'});
  }});
  assert.equal((await response.json()).reply,'Public answer');assert.equal(previewStatus({},{publicChat:true}).mode,'public relay');
});
