import test from 'node:test';
import assert from 'node:assert/strict';
import {checkableURL,validateCitations,losesResourcePath} from '../grok-relay/citation-check.js';
test('a resource redirecting to its generic parent is not evidence that the resource still exists',async()=>{
  assert.equal(losesResourcePath('https://employer.com/careers/job/expired','https://www.employer.com/careers'),true);
  assert.equal(losesResourcePath('https://publisher.com/article/old','https://publisher.com/'),true);
  assert.equal(losesResourcePath('http://employer.com/careers/job/active','https://www.employer.com/careers/job/active/'),false);
  assert.equal(losesResourcePath('https://publisher.com/old-title','https://publisher.com/new-title'),false);
  assert.equal(losesResourcePath('https://publisher.com/faq/item','https://publisher.com/faq#item'),false);
  const url='https://citation-resource-check.com/jobs/removed';let calls=0;
  const result=await validateCitations([{url}],{request:async()=>{calls++;return new Response(null,{status:302,headers:{location:'/jobs'}})}});
  assert.deepEqual(result.deadURLs,[url]);assert.equal(calls,1);
});
test('citation checks exclude private/local addresses, credentials and unexpected ports',()=>{
  for(const url of ['http://127.0.0.1','http://2130706433','http://0x7f000001','http://[::1]','http://[::ffff:127.0.0.1]','http://10.0.0.1','http://169.254.169.254','http://localhost','http://service.local','https://host.internal','https://user:secret@example.com','https://example.com:8080','file:///etc/passwd'])assert.equal(checkableURL(url),'');
  assert.equal(checkableURL('https://www.anthropic.com/careers'),'https://www.anthropic.com/careers');
});
test('404 and 410 citations are removed; blocked or timed-out checks are not called verified',async()=>{
  const citations=['not-found','gone','blocked','timeout','good'].map(name=>({url:`https://citation-check.com/${name}`,title:name}));
  const result=await validateCitations(citations,{request:async(url,init)=>{assert.equal(init.method,'HEAD');assert.equal(init.redirect,'manual');assert.equal(init.headers.authorization,undefined);if(url.endsWith('timeout'))throw new Error('timeout');return new Response(null,{status:url.endsWith('not-found')?404:url.endsWith('gone')?410:url.endsWith('blocked')?403:200})}});
  assert.deepEqual(result.deadURLs,citations.slice(0,2).map(x=>x.url));assert.equal(result.citations.length,3);
});
test('redirects are bounded and rechecked before following; local redirect targets are never fetched',async()=>{
  const calls=[];
  const result=await validateCitations([{url:'https://redirect-check.com/private'},{url:'https://redirect-check.com/valid'}],{request:async url=>{calls.push(url);return url.endsWith('/valid')?new Response(null,{status:301,headers:{location:'/landing'}}):url.endsWith('/landing')?new Response(null,{status:200}):new Response(null,{status:302,headers:{location:'http://127.0.0.1/'}})}});
  assert.equal(result.citations.length,1);assert.ok(calls.includes('https://redirect-check.com/landing'));assert.ok(!calls.some(url=>url.includes('127.0.0.1')));
});
