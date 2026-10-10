export function createAI({addLine,addBlock,escapeHtml,chatWindow,chatForm,chatInput,contextProvider,onSources}){
  const endpoint=()=>window.ARMAN_CHAT_ENDPOINT||localStorage.getItem('arman.chatEndpoint')||'';
  const canonical='https://arman-dogru.arman-dogru.workers.dev';
  const STORAGE_KEY='arman.chat.history.v2';
  let history=[];
  function loadHistory(){try{history=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{history=[]}if(!Array.isArray(history))history=[];history=history.filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.content==='string').slice(-16)}
  function saveHistory(){localStorage.setItem(STORAGE_KEY,JSON.stringify(history.slice(-16)))}
  function renderMessage(m,store=true){
    if(store){history.push({role:m.role,content:m.content});history=history.slice(-16);saveHistory()}
    if(!chatWindow)return;const div=document.createElement('div');div.className=`chat-msg ${m.role==='user'?'user':'ai'}`;div.innerHTML=`<span class="who">${m.role==='user'?'YOU':'MORPHEUS'}</span><div>${escapeHtml(m.content).replace(/\n/g,'<br>')}</div>`;chatWindow.appendChild(div);chatWindow.scrollTop=chatWindow.scrollHeight;
  }
  function renderHistory(){
    if(!chatWindow)return;chatWindow.innerHTML='';
    if(!history.length){
      renderMessage({role:'assistant',content:'I answer open-ended questions about Arman’s public professional work. I am not limited to a canned question list.'},false);
      renderMessage({role:'assistant',content:'My source contract is the portfolio knowledge base, current page state, live public GitHub metadata when the relay can retrieve it, and the race board. I do not invent missing private facts.'},false);
      return;
    }
    history.forEach(m=>renderMessage(m,false));chatWindow.scrollTop=chatWindow.scrollHeight;
  }
  function clientContext(){
    try{
      const value=contextProvider?.()||{};
      return JSON.parse(JSON.stringify(value,(k,v)=>typeof v==='string'?v.slice(0,900):v));
    }catch{return{}}
  }
  async function send(message,{fromTerminal=false}={}){
    const text=(message||'').trim();
    if(!text){if(fromTerminal)addLine('usage: chat <question about Arman or his public work>','yellow');return}
    if(/^clear$/i.test(text)){history=[];saveHistory();renderHistory();if(fromTerminal)addLine('chat memory cleared','green');return}
    if(/^sources$/i.test(text)){
      const msg='Sources: canonical public portfolio context; current page state; public GitHub metadata/targeted README retrieval through the relay; and the Istanbul paddock board. LinkedIn is a profile link, not a live scraped source.';
      if(fromTerminal)addBlock(`<b>AGENT SOURCES</b><br>${escapeHtml(msg)}`);else renderMessage({role:'assistant',content:msg});return;
    }
    const url=endpoint();if(!url){const msg='Chat relay is not configured. Set a worker URL with connect-chat <url>.';if(fromTerminal)addBlock(`<b>CHAT RELAY NOT CONFIGURED</b><br>${escapeHtml(msg)}`);else renderMessage({role:'assistant',content:msg});return}
    const prior=history.slice(-12);renderMessage({role:'user',content:text});if(fromTerminal)addLine(`<span class="purple">you</span> // ${escapeHtml(text)}`,'dim');
    const pending=document.createElement('div');pending.className='chat-msg ai pending';pending.innerHTML='<span class="who">MORPHEUS</span><div>retrieving public context…</div>';chatWindow?.appendChild(pending);if(chatWindow)chatWindow.scrollTop=chatWindow.scrollHeight;
    try{
      const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:text,history:prior,context:clientContext()})});const data=await res.json().catch(()=>({}));pending.remove();if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);const reply=data.reply||'No response text returned.';renderMessage({role:'assistant',content:reply});onSources?.(data.sources||[]);if(fromTerminal)addBlock(`<b>MORPHEUS</b><br>${escapeHtml(reply).replace(/\n/g,'<br>')}`);
    }catch(err){pending.remove();const msg=String(err?.message||err),out=/failed to fetch|networkerror|load failed/i.test(msg)?`The relay is unreachable from this origin. Open the canonical portfolio at ${canonical} or verify the worker/CORS configuration.`:`Relay error: ${msg}`;if(fromTerminal)addLine(`Morpheus relay failed: ${escapeHtml(out)}`,'error');else renderMessage({role:'assistant',content:out})}
  }
  if(chatForm)chatForm.addEventListener('submit',e=>{e.preventDefault();const v=chatInput?.value||'';if(chatInput)chatInput.value='';send(v)});
  loadHistory();renderHistory();
  return{chat:send,clear:()=>send('clear'),renderHistory,focus:()=>chatInput?.focus(),history:()=>history.slice()};
}
