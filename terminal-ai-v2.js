import {renderMarkdown,publicLink} from './chat-markdown.js';
import {MORPHEUS_VERSION} from './chat-version.js';
export function createAI({addLine,addBlock,escapeHtml,chatWindow,chatForm,chatInput,chatRestart,chatRestartDialog,chatRestartConfirm,chatRestartCancel,contextProvider,onSources}){
  const endpoint=()=>window.ARMAN_CHAT_ENDPOINT||localStorage.getItem('arman.chatEndpoint')||'';
  const interrupted='The connection slipped. Your question is still here. Try again.';
  const rateLimited='The signal needs a pause. Try again after the hour turns.';
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
    if(store){history.push({role:m.role,content:m.content,...(m.role==='assistant'&&m.persona_version===MORPHEUS_VERSION?{persona_version:MORPHEUS_VERSION}:{})});history=history.slice(-12);saveHistory()}
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
  function restart(){
    generation++;controller?.abort();controller=null;setBusy(false);
    history=[];saveHistory();renderHistory();onSources?.([]);
    if(chatInput){chatInput.value='';chatInput.focus()}
  }
  async function send(message,{fromTerminal=false,retryHistory=null}={}){
    const text=(message||'').trim();
    if(!text){if(fromTerminal)addLine('usage: chat <message>','yellow');return}
    if(/^clear$/i.test(text)){restart();if(fromTerminal)addLine('chat memory cleared','green');return}
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
      if(res.status===429)throw Object.assign(new Error('rate limited'),{rateLimited:true});
      if(!res.ok||data.degraded||typeof data.reply!=='string'||!data.reply.trim())throw new Error('unavailable');
      if(turn!==generation)return;
      pending?.remove();let reply=data.reply.trim();
      const citations=(Array.isArray(data.citations)?data.citations:[]).map(c=>({url:publicLink(c?.url),title:String(c?.title||'').replace(/[\[\]\\\n]/g,'').slice(0,90)})).filter((c,i,all)=>c.url&&!reply.includes(c.url)&&all.findIndex(x=>x.url===c.url)===i).slice(0,3);
      if(citations.length)reply+='\n\n'+citations.map(c=>`[${c.title||new URL(c.url).hostname}](${c.url})`).join(' · ');
      renderMessage({role:'assistant',content:reply,persona_version:data.persona_version});onSources?.(data.sources||[]);
      if(fromTerminal)addBlock(`<b>MORPHEUS</b><div class="chat-body">${renderMarkdown(reply)}</div>`);
    }catch(error){
      if(turn!==generation)return;
      const notice=error?.rateLimited?rateLimited:interrupted;
      pending?.remove();const failure=renderMessage({role:'assistant',content:notice},false);
      // A transport failure is not a model answer; keep it out of conversation memory.
      if(failure){const button=document.createElement('button');button.type='button';button.className='chat-retry';button.textContent='Retry';button.addEventListener('click',()=>{if(busy)return;failure.remove();const same=history.at(-1)?.role==='user'&&history.at(-1).content===text;send(text,{fromTerminal,...(same?{retryHistory:prior}:{})})});failure.appendChild(button)}
      if(fromTerminal)addLine(escapeHtml(notice),'yellow');
    }finally{clearTimeout(timer);pending?.remove();if(turn===generation){controller=null;setBusy(false)}}
  }
  chatWindow?.setAttribute('role','log');chatWindow?.setAttribute('aria-live','polite');
  if(chatForm)chatForm.addEventListener('submit',e=>{e.preventDefault();if(busy)return;const v=chatInput?.value||'';if(chatInput)chatInput.value='';send(v)});
  if(chatInput)chatInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();chatForm?.requestSubmit()}});
  chatRestart?.addEventListener('click',()=>{
    if(history.length||busy||chatInput?.value?.trim()){chatRestartDialog?.showModal();chatRestartCancel?.focus();return}
    restart();
  });
  chatRestartCancel?.addEventListener('click',()=>{chatRestartDialog?.close();chatRestart?.focus()});
  chatRestartConfirm?.addEventListener('click',()=>{chatRestartDialog?.close();restart()});
  loadHistory();renderHistory();
  return{chat:send,clear:()=>send('clear'),renderHistory,focus:()=>{chatInput?.focus();if(chatWindow)chatWindow.scrollTop=chatWindow.scrollHeight},history:()=>history.slice()};
}
