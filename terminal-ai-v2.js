import {renderMarkdown} from './chat-markdown.js';
export function createAI({addLine,addBlock,escapeHtml,chatWindow,chatForm,chatInput,contextProvider,onSources}){
  const endpoint=()=>window.ARMAN_CHAT_ENDPOINT||localStorage.getItem('arman.chatEndpoint')||'';
  const interrupted='The connection slipped. Your question is still here. Try again.';
  const STORAGE_KEY='arman.chat.history.v3';
  let history=[],busy=false,controller=null,generation=0;

  function loadHistory(){
    try{history=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{history=[]}
    if(!Array.isArray(history))history=[];
    history=history.filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.content==='string').slice(-12);
  }
  function saveHistory(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(history.slice(-12)))}catch{/* Chat still works when storage is unavailable. */}}
  function setBusy(value){busy=value;chatWindow?.setAttribute('aria-busy',String(value));const button=chatForm?.querySelector('button[type="submit"]');if(button)button.disabled=value}
  function renderMessage(m,store=true){
    if(store){history.push({role:m.role,content:m.content});history=history.slice(-12);saveHistory()}
    if(!chatWindow)return;
    const div=document.createElement('div');
    div.className=`chat-msg ${m.role==='user'?'user':'ai'}`;
    const body=m.role==='user'?escapeHtml(m.content).replace(/\n/g,'<br>'):renderMarkdown(m.content);
    div.innerHTML=`<span class="who">${m.role==='user'?'YOU':'MORPHEUS'}</span><div class="chat-body">${body}</div>`;
    chatWindow.appendChild(div);chatWindow.scrollTop=chatWindow.scrollHeight;return div;
  }
  function renderHistory(){
    if(!chatWindow)return;
    chatWindow.innerHTML='';
    if(!history.length){renderMessage({role:'assistant',content:'Ask.'},false);return}
    history.forEach(m=>renderMessage(m,false));chatWindow.scrollTop=chatWindow.scrollHeight;
  }
  function clientContext(){
    try{const value=contextProvider?.()||{};return JSON.parse(JSON.stringify(value,(k,v)=>typeof v==='string'?v.slice(0,1200):v))}catch{return{}}
  }
  async function send(message,{fromTerminal=false,retryHistory=null}={}){
    const text=(message||'').trim();
    if(!text){if(fromTerminal)addLine('usage: chat <message>','yellow');return}
    if(/^clear$/i.test(text)){generation++;controller?.abort();setBusy(false);history=[];saveHistory();renderHistory();if(fromTerminal)addLine('chat memory cleared','green');return}
    if(busy)return;
    const url=endpoint();
    const prior=retryHistory||history.slice(-10),turn=generation;
    if(!retryHistory)renderMessage({role:'user',content:text});
    if(fromTerminal)addLine(`<span class="purple">you</span> // ${escapeHtml(text)}`,'dim');
    setBusy(true);controller=new AbortController();const activeController=controller;
    const pending=renderMessage({role:'assistant',content:'…'},false);pending?.classList.add('pending');
    const timer=setTimeout(()=>activeController.abort(),75000);
    try{
      if(!url)throw new Error('unconfigured');
      const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:text,history:prior,context:clientContext()}),signal:activeController.signal});
      const data=await res.json();
      if(!res.ok||typeof data.reply!=='string'||!data.reply.trim())throw new Error('unavailable');
      if(turn!==generation)return;
      pending?.remove();const reply=data.reply.trim();
      renderMessage({role:'assistant',content:reply});onSources?.(data.sources||[]);
      if(fromTerminal)addBlock(`<b>MORPHEUS</b><div class="chat-body">${renderMarkdown(reply)}</div>`);
    }catch{
      if(turn!==generation)return;
      pending?.remove();const failure=renderMessage({role:'assistant',content:interrupted},false);
      // A transport failure is not a model answer; keep it out of conversation memory.
      if(failure){const button=document.createElement('button');button.type='button';button.className='chat-retry';button.textContent='Retry';button.addEventListener('click',()=>{if(busy)return;failure.remove();const same=history.at(-1)?.role==='user'&&history.at(-1).content===text;send(text,{fromTerminal,...(same?{retryHistory:prior}:{})})});failure.appendChild(button)}
      if(fromTerminal)addLine(escapeHtml(interrupted),'yellow');
    }finally{clearTimeout(timer);pending?.remove();if(turn===generation){controller=null;setBusy(false)}}
  }
  chatWindow?.setAttribute('role','log');chatWindow?.setAttribute('aria-live','polite');
  if(chatForm)chatForm.addEventListener('submit',e=>{e.preventDefault();if(busy)return;const v=chatInput?.value||'';if(chatInput)chatInput.value='';send(v)});
  if(chatInput)chatInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();chatForm?.requestSubmit()}});
  loadHistory();renderHistory();
  return{chat:send,clear:()=>send('clear'),renderHistory,focus:()=>chatInput?.focus(),history:()=>history.slice()};
}
