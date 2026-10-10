import test from 'node:test';
import assert from 'node:assert/strict';
import {createAI} from '../terminal-ai-v2.js';
import {escapeHTML} from '../chat-markdown.js';
class Element{
  constructor(){this.children=[];this.listeners={};this.attrs={};this.classList={add:()=>{}}}
  set innerHTML(value){this.html=value;this.children=[]}get innerHTML(){return this.html||''}
  appendChild(child){this.children.push(child);child.parent=this;return child}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
  setAttribute(k,v){this.attrs[k]=v}addEventListener(k,fn){this.listeners[k]=fn}
  querySelector(){return this.submit}
}
function setup(t,request,existing=[]){
  const store=new Map([['arman.chat.history.v3',JSON.stringify(existing)]]),chatWindow=new Element(),chatForm=new Element(),chatInput=new Element();chatForm.submit=new Element();
  const originals=Object.fromEntries(['document','localStorage','window','fetch'].map(k=>[k,globalThis[k]]));
  Object.assign(globalThis,{document:{createElement:()=>new Element()},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},window:{ARMAN_CHAT_ENDPOINT:'/chat'},fetch:request});
  t.after(()=>Object.assign(globalThis,originals));
  const ai=createAI({chatWindow,chatForm,chatInput,escapeHtml:escapeHTML,addLine:()=>{},addBlock:()=>{}});
  return{ai,chatWindow,chatForm,chatInput,store};
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
