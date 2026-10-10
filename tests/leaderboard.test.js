import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import worker from '../grok-relay/agent-worker.js';
import {createLeaderboard} from '../leaderboard-client.js';

function environment(){const store=new Map;return{ALLOWED_ORIGINS:'http://localhost:4173',PROFANITY_BLOCKLIST_GZ_B64:gzipSync('test-reserved-name').toString('base64'),LEADERBOARD:{async get(key,opt){const v=store.get(key);return opt?.type==='json'&&v?JSON.parse(v):v||null},async put(key,value){store.set(key,value)},async list({prefix}){return{keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true}}}}}
function memory(){const store=new Map;return{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}}
const result={display_name:'Test Driver',elapsed_ms:120000,position:2};

test('a result is accepted, persists, and cannot be replaced by a worse result',async()=>{
  const env=environment(),client=createLeaderboard({storage:memory(),endpoint:()=>'/leaderboard',request:(url,init={})=>worker.fetch(new Request('http://localhost:4173'+url,{...init,headers:{...init.headers,origin:'http://localhost:4173'}}),env,{})});
  assert.equal((await client.save(result)).pending,false);
  assert.equal((await client.load())[0].display_name,'Test Driver');
  const score=client.rows()[0].score;
  await client.save({...result,elapsed_ms:160000});
  assert.equal(client.rows()[0].score,score);
  const response=await worker.fetch(new Request('http://localhost:4173/leaderboard'),env,{});
  assert.equal((await response.json()).entries[0].score,score);
});
test('offline results remain visible alongside the remote board and retry successfully',async()=>{
  let online=false;const env=environment(),client=createLeaderboard({storage:memory(),endpoint:()=>'/leaderboard',request:(url,init={})=>{if(!online)throw new Error('offline');return worker.fetch(new Request('http://localhost:4173'+url,init),env,{})}});
  assert.equal((await client.save(result)).pending,true);assert.equal(client.pending,1);
  await client.load();assert.equal(client.rows()[0].display_name,'Test Driver');
  online=true;await client.retry();await client.load();assert.equal(client.pending,0);assert.equal(Boolean(client.rows()[0].pending),false);
});
test('invalid names and scores are rejected without a false saved message',async()=>{
  const env=environment();
  const response=await worker.fetch(new Request('http://localhost:4173/leaderboard',{method:'POST',body:JSON.stringify({...result,score:9,game_version:'neat-race-v4',track:'istanbul-park-v4'})}),env,{});
  assert.equal(response.status,400);
  const client=createLeaderboard({storage:memory(),endpoint:()=>'/leaderboard',request:async()=>new Response(JSON.stringify({error:'That display name is not accepted.'}),{status:400})});
  assert.equal((await client.save(result)).ok,false);assert.equal(client.rows().length,0);
});
test('old deployed code cannot masquerade as a successful leaderboard',async()=>{
  const client=createLeaderboard({storage:memory(),endpoint:()=>'/leaderboard',request:async()=>new Response(JSON.stringify({reply:'hello'}))});
  assert.equal((await client.save(result)).pending,true);assert.equal(client.status,'offline');
});
test('simultaneous saves retain every player instead of overwriting a shared KV array',async()=>{
  const env=environment();await Promise.all(Array.from({length:8},(_,i)=>worker.fetch(new Request('http://localhost:4173/leaderboard',{method:'POST',body:JSON.stringify({...result,display_name:'Driver '+i,score:700000,game_version:'neat-race-v4',track:'istanbul-park-v4'})}),env,{})));
  const response=await worker.fetch(new Request('http://localhost:4173/leaderboard'),env,{});assert.equal((await response.json()).entries.length,8);
});
test('legacy local results migrate and malformed offline results are not falsely saved',async()=>{
  const storage=memory();storage.setItem('arman.raceResults.v4',JSON.stringify([{...result,score:700000}]));
  const client=createLeaderboard({storage,request:async()=>{throw new Error('offline')}});assert.equal(client.pending,1);assert.equal(client.rows()[0].display_name,result.display_name);
  assert.equal((await client.save({...result,elapsed_ms:0})).ok,false);
});
