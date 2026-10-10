export function createAI({addLine,addBlock,escapeHtml,chatWindow,chatForm,chatInput,contextProvider,onSources}){
  const endpoint=()=>window.ARMAN_CHAT_ENDPOINT||localStorage.getItem('arman.chatEndpoint')||'';
  const portfolioURL='https://arman-dogru.arman-dogru.workers.dev';
  const STORAGE_KEY='arman.chat.history.v3';
  let history=[];

  function loadHistory(){
    try{history=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{history=[]}
    if(!Array.isArray(history))history=[];
    history=history.filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.content==='string').slice(-12);
  }
  function saveHistory(){localStorage.setItem(STORAGE_KEY,JSON.stringify(history.slice(-12)))}
  function renderMessage(m,store=true){
    if(store){history.push({role:m.role,content:m.content});history=history.slice(-12);saveHistory()}
    if(!chatWindow)return;
    const div=document.createElement('div');
    div.className=`chat-msg ${m.role==='user'?'user':'ai'}`;
    div.innerHTML=`<span class="who">${m.role==='user'?'YOU':'MORPHEUS'}</span><div>${escapeHtml(m.content).replace(/\n/g,'<br>')}</div>`;
    chatWindow.appendChild(div);chatWindow.scrollTop=chatWindow.scrollHeight;
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
  async function send(message,{fromTerminal=false}={}){
    const text=(message||'').trim();
    if(!text){if(fromTerminal)addLine('usage: chat <message>','yellow');return}
    if(/^clear$/i.test(text)){history=[];saveHistory();renderHistory();if(fromTerminal)addLine('chat memory cleared','green');return}
    const url=endpoint();
    if(!url){const msg='The chat relay is not configured.';if(fromTerminal)addBlock(`<b>MORPHEUS</b><br>${escapeHtml(msg)}`);else renderMessage({role:'assistant',content:msg});return}
    const prior=history.slice(-10);
    renderMessage({role:'user',content:text});
    if(fromTerminal)addLine(`<span class="purple">you</span> // ${escapeHtml(text)}`,'dim');
    const pending=document.createElement('div');pending.className='chat-msg ai pending';pending.innerHTML='<span class="who">MORPHEUS</span><div>…</div>';chatWindow?.appendChild(pending);if(chatWindow)chatWindow.scrollTop=chatWindow.scrollHeight;
    try{
      const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:text,history:prior,context:clientContext()})});
      const data=await res.json().catch(()=>({}));pending.remove();
      if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);
      const reply=data.reply||'No response text returned.';
      renderMessage({role:'assistant',content:reply});onSources?.(data.sources||[]);
      if(fromTerminal)addBlock(`<b>MORPHEUS</b><br>${escapeHtml(reply).replace(/\n/g,'<br>')}`);
    }catch(err){
      pending.remove();const msg=String(err?.message||err);
      const out=/failed to fetch|networkerror|load failed/i.test(msg)?`The relay is unreachable from this page. Open ${portfolioURL} or check the Worker deployment.`:`Relay error: ${msg}`;
      if(fromTerminal)addLine(`Morpheus relay failed: ${escapeHtml(out)}`,'error');else renderMessage({role:'assistant',content:out});
    }
  }
  if(chatForm)chatForm.addEventListener('submit',e=>{e.preventDefault();const v=chatInput?.value||'';if(chatInput)chatInput.value='';send(v)});
  if(chatInput)chatInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();chatForm?.requestSubmit()}});
  loadHistory();renderHistory();
  return{chat:send,clear:()=>send('clear'),renderHistory,focus:()=>chatInput?.focus(),history:()=>history.slice()};
}
