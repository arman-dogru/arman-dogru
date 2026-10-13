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
test('a recoverable reset clears legacy and entry scores without deleting unrelated data',async()=>{
  const env=environment(),old={...result,score:700000,created_at:'2025-01-01T00:00:00.000Z'};
  await env.LEADERBOARD.put('race:istanbul:v4',JSON.stringify([old]));
  await env.LEADERBOARD.put('race:istanbul:v4:entry:old',JSON.stringify(old));
  await env.LEADERBOARD.put('chat-rate:untouched','7');
  await env.LEADERBOARD.put('race:istanbul:v4:reset-at','2026-01-01T00:00:00.000Z');
  const response=await worker.fetch(new Request('http://localhost:4173/leaderboard'),env,{}),data=await response.json();
  assert.deepEqual(data.entries,[]);assert.equal(data.reset_at,'2026-01-01T00:00:00.000Z');
  const svg=await worker.fetch(new Request('http://localhost:4173/leaderboard.svg'),env,{});
  assert.doesNotMatch(await svg.text(),/Test Driver/);
  assert.equal(await env.LEADERBOARD.get('chat-rate:untouched'),'7');
  await env.LEADERBOARD.put('race:istanbul:v4:reset-at','');
  assert.equal((await(await worker.fetch(new Request('http://localhost:4173/leaderboard'),env,{})).json()).entries.length,1,'reset is reversible');
});
test('confirmed browser rows and old pending rows cannot resurrect a cleared board',async()=>{
  const storage=memory(),old={...result,score:700000,created_at:'2025-01-01T00:00:00.000Z'};
  storage.setItem('arman.raceResults.v5',JSON.stringify([old,{...old,display_name:'Pending Driver',pending:true},{...result,display_name:'Legacy Driver',score:700000}]));
  storage.setItem('arman.raceBest.istanbul-park-v4','700000');
  let stale=false;
  const client=createLeaderboard({storage,endpoint:()=>'/leaderboard',request:async()=>Response.json(stale?{entries:[old],configured:true}:{entries:[],reset_at:'2026-01-01T00:00:00.000Z',configured:true})});
  assert.deepEqual(await client.load(),[]);assert.equal(client.pending,0);
  stale=true;assert.deepEqual(await client.load(),[],'a stale edge response cannot undo an observed reset');
  assert.equal(storage.getItem('arman.raceBest.istanbul-park-v4'),'700000');
});
test('new confirmed scores survive a stale board read but do not bypass a later reset',async()=>{
  const env=environment(),storage=memory();let stale=false;
  const client=createLeaderboard({storage,endpoint:()=>'/leaderboard',request:async(url,init={})=>stale?Response.json({entries:[],configured:true}):worker.fetch(new Request('http://localhost:4173'+url,init),env,{})});
  const saved=await client.save(result);assert.equal(saved.pending,false);
  assert.ok(JSON.parse(storage.getItem('arman.raceResults.v5'))[0].created_at,'retain the server receipt timestamp');
  stale=true;assert.equal((await client.load())[0].display_name,result.display_name);
  stale=false;await env.LEADERBOARD.put('race:istanbul:v4:reset-at',new Date(Date.now()+1000).toISOString());
  assert.deepEqual(await client.load(),[]);
});
test('new submissions are accepted after a reset and return the reset with their receipt',async()=>{
  const env=environment();await env.LEADERBOARD.put('race:istanbul:v4:reset-at','2026-01-01T00:00:00.000Z');
  const client=createLeaderboard({storage:memory(),endpoint:()=>'/leaderboard',request:(url,init={})=>worker.fetch(new Request('http://localhost:4173'+url,init),env,{})});
  assert.equal((await client.save(result)).pending,false);assert.equal((await client.load()).length,1);
});
test('an incomplete or mismatched server receipt is not reported as globally saved',async()=>{
  for(const entry of [undefined,{...result,score:1,created_at:new Date().toISOString()}]){
    const client=createLeaderboard({storage:memory(),endpoint:()=>'/leaderboard',request:async()=>Response.json({ok:true,entries:[],entry})});
    const saved=await client.save(result);assert.equal(saved.pending,true);assert.equal(client.status,'offline');
    assert.match(saved.error,/did not confirm/);
  }
});
