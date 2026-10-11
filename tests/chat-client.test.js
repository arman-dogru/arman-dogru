import test from 'node:test';
import assert from 'node:assert/strict';
import {createAI} from '../terminal-ai-v2.js';
import {escapeHTML} from '../chat-markdown.js';
import {MORPHEUS_VERSION} from '../chat-version.js';
class Element{
  constructor(){this.children=[];this.listeners={};this.attrs={};this.classList={add:()=>{}}}
  set innerHTML(value){this.html=value;this.children=[]}get innerHTML(){return this.html||''}
  appendChild(child){this.children.push(child);child.parent=this;return child}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
  setAttribute(k,v){this.attrs[k]=v}addEventListener(k,fn){this.listeners[k]=fn}
  focus(){this.focused=true}
  querySelector(){return this.submit}
}
function setup(t,request,existing=[]){
  const store=new Map([['arman.chat.history.v3',JSON.stringify(existing)]]),chatWindow=new Element(),chatForm=new Element(),chatInput=new Element(),chatRestart=new Element(),sources=[];chatForm.submit=new Element();
  const originals=Object.fromEntries(['document','localStorage','window','fetch'].map(k=>[k,globalThis[k]]));
  Object.assign(globalThis,{document:{createElement:()=>new Element()},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},window:{ARMAN_CHAT_ENDPOINT:'/chat',confirm:()=>true},fetch:request});
  t.after(()=>Object.assign(globalThis,originals));
  const ai=createAI({chatWindow,chatForm,chatInput,chatRestart,onSources:value=>sources.push(value),escapeHtml:escapeHTML,addLine:()=>{},addBlock:()=>{}});
  return{ai,chatWindow,chatForm,chatInput,chatRestart,store,sources};
}
test('existing history is preserved; only assistant Markdown is interpreted',async t=>{
  const old=[{role:'user',content:'**literal**'},{role:'assistant',content:'**Yes.**'}],{ai,chatWindow}=setup(t,async()=>Response.json({reply:'He builds.'}),old);
  assert.equal(ai.history().length,2);assert.match(chatWindow.children[0].innerHTML,/\*\*literal\*\*/);assert.match(chatWindow.children[1].innerHTML,/<strong>Yes\.<\/strong>/);
  await ai.chat('Explain.');assert.equal(ai.history().length,4);
});
test('empty output gets a retry, never a backend error or a fake history answer',async t=>{
  const requests=[],{ai,chatWindow}=setup(t,async(url,init)=>{requests.push(JSON.parse(init.body));return Response.json({reply:requests.length===1?'':'Yes. He builds.'})});
  await ai.chat('Should we hire Arman?');assert.equal(ai.history().length,1);
  const failure=chatWindow.children.at(-1);assert.match(failure.innerHTML,/connection slipped/);assert.doesNotMatch(failure.innerHTML,/No response|Relay error/);
  failure.children[0].listeners.click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,2);assert.deepEqual(requests[1].history,[]);assert.equal(ai.history().length,2);
});
test('overlapping sends are blocked without deleting the draft; clear cancels stale answers',async t=>{
  let resolve,calls=0;const {ai,chatWindow,chatForm,chatInput}=setup(t,()=>{calls++;return new Promise(r=>resolve=r)});
  const first=ai.chat('One');assert.equal(chatForm.submit.disabled,true);
  chatInput.value='Draft';chatForm.listeners.submit({preventDefault(){}});await ai.chat('Two');assert.equal(calls,1);assert.equal(chatInput.value,'Draft');
  await ai.clear();resolve(Response.json({reply:'Stale answer'}));await first;
  assert.deepEqual(ai.history(),[]);assert.equal(chatWindow.children.length,1);assert.equal(chatForm.submit.disabled,false);
});
test('unavailable storage and transport errors do not break the interface',async t=>{
  const {ai,chatForm}=setup(t,async()=>{throw new Error('private backend exception')});
  localStorage.setItem=()=>{throw new Error('blocked storage')};await ai.chat('Hello');assert.equal(ai.history().length,1);assert.equal(chatForm.submit.disabled,false);
});
test('successful current replies retain their persona version without erasing older history',async t=>{
  const old=[{role:'assistant',content:'An old answer.'}],{ai,store}=setup(t,async()=>Response.json({reply:'Yes. He sees beyond the surface.',persona_version:MORPHEUS_VERSION}),old);
  await ai.chat('Do you believe in him?');assert.equal(ai.history()[0].content,old[0].content);assert.equal(ai.history().at(-1).persona_version,MORPHEUS_VERSION);
  assert.equal(JSON.parse(store.get('arman.chat.history.v3')).at(-1).persona_version,MORPHEUS_VERSION);
});
test('opening the chat scrolls saved history to the latest response after the hidden pane becomes visible',t=>{
  const {ai,chatWindow,chatInput}=setup(t,async()=>Response.json({reply:'Unused'}),[{role:'assistant',content:'Saved response'}]);
  chatWindow.scrollHeight=1000;chatWindow.scrollTop=0;ai.focus();assert.equal(chatWindow.scrollTop,1000);assert.equal(chatInput.focused,true);
});
test('hourly limit is explained honestly, with no fake network failure or model answer in history',async t=>{
  const {ai,chatWindow}=setup(t,async()=>Response.json({reply:'Internal limit details'},{status:429}));
  await ai.chat('Hello');const failure=chatWindow.children.at(-1);assert.match(failure.innerHTML,/after the hour turns/);assert.doesNotMatch(failure.innerHTML,/connection slipped|Internal limit/);assert.equal(ai.history().length,1);assert.equal(failure.children[0].textContent,'Retry');
});
test('restart button confirms, clears only chat memory and draft, and focuses a fresh conversation',async t=>{
  const {ai,chatWindow,chatInput,chatRestart,store,sources}=setup(t,async()=>Response.json({reply:'He builds.'}),[{role:'user',content:'Old question'}]);
  store.set('arman.theme','dracula');store.set('arman.chatEndpoint','/custom');chatInput.value='Unsent draft';
  let confirmations=0;window.confirm=message=>{confirmations++;assert.match(message,/clears the conversation and your draft/);return false};
  chatRestart.listeners.click();assert.equal(ai.history().length,1);assert.equal(chatInput.value,'Unsent draft');
  window.confirm=()=>{confirmations++;return true};chatRestart.listeners.click();
  assert.equal(confirmations,2);assert.deepEqual(ai.history(),[]);assert.deepEqual(JSON.parse(store.get('arman.chat.history.v3')),[]);
  assert.equal(chatWindow.children.length,1);assert.match(chatWindow.children[0].innerHTML,/Ask\./);assert.equal(chatInput.value,'');assert.equal(chatInput.focused,true);
  assert.equal(store.get('arman.theme'),'dracula');assert.equal(store.get('arman.chatEndpoint'),'/custom');assert.deepEqual(sources.at(-1),[]);
  await ai.chat('Fresh question');assert.equal(ai.history().length,2);
});
test('restart aborts an in-flight reply and stale completion cannot overwrite a newer conversation',async t=>{
  let finishOld,oldSignal;const bodies=[];
  const {ai,chatWindow,chatRestart,chatForm}=setup(t,async(url,init)=>{
    bodies.push(JSON.parse(init.body));if(bodies.length===1){oldSignal=init.signal;return new Promise(resolve=>finishOld=resolve)}
    return Response.json({reply:'Fresh answer',persona_version:MORPHEUS_VERSION});
  });
  const old=ai.chat('Old question');chatRestart.listeners.click();assert.equal(oldSignal.aborted,true);assert.equal(chatForm.submit.disabled,false);
  await ai.chat('New question');assert.deepEqual(bodies[1].history,[]);
  finishOld(Response.json({reply:'Stale answer'}));await old;
  assert.deepEqual(ai.history().map(x=>x.content),['New question','Fresh answer']);assert.doesNotMatch(chatWindow.children.map(x=>x.innerHTML).join(''),/Stale answer/);
});
