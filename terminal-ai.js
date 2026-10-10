export function createAI({addLine,addBlock,escapeHtml,chatWindow,chatForm,chatInput}){
  const endpoint=()=>window.ARMAN_CHAT_ENDPOINT||localStorage.getItem('arman.chatEndpoint')||'';
  const canonical='https://arman-dogru.arman-dogru.workers.dev';
  const STORAGE_KEY='arman.chat.history';
  let history=[];
  function loadHistory(){
    try{history=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{history=[]}
    if(!Array.isArray(history))history=[];
    history=history.filter(x=>x&&typeof x.role==='string'&&typeof x.content==='string').slice(-12);
  }
  function saveHistory(){localStorage.setItem(STORAGE_KEY,JSON.stringify(history.slice(-12)))}
  function renderHistory(){
    if(!chatWindow)return;
    chatWindow.innerHTML='';
    if(!history.length){
      const hello=[
        {role:'assistant',content:'I am Morpheus in portfolio mode. Ask about Arman\'s work, research, papers, or projects.'},
        {role:'assistant',content:'If you are searching for the person behind the code, start with: “What makes Arman useful on hard problems?”'}
      ];
      hello.forEach(m=>renderMessage(m,false));
      return;
    }
    history.forEach(m=>renderMessage(m,false));
    chatWindow.scrollTop=chatWindow.scrollHeight;
  }
  function renderMessage(m,store=true){
    if(store){history.push({role:m.role,content:m.content});history=history.slice(-12);saveHistory()}
    if(!chatWindow)return;
    const div=document.createElement('div');
    div.className=`chat-msg ${m.role==='user'?'user':'ai'}`;
    div.innerHTML=`<span class="who">${m.role==='user'?'YOU':'MORPHEUS'}</span>${escapeHtml(m.content).replace(/\n/g,'<br>')}`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop=chatWindow.scrollHeight;
  }
  async function send(message,{fromTerminal=false}={}){
    const text=(message||'').trim();
    if(!text){if(fromTerminal)addLine('usage: chat <question about Arman or his work>','yellow');return}
    if(/^help$/i.test(text)){
      const help='Ask about Arman\'s research, publications, timeline, or public projects. Use “chat clear” to wipe local memory.';
      if(fromTerminal)addBlock(`<b>CHAT HELP</b><br>${escapeHtml(help)}`); else renderMessage({role:'assistant',content:help});
      return;
    }
    if(/^clear$/i.test(text)){
      history=[];saveHistory();renderHistory();if(fromTerminal)addLine('chat memory cleared','green');return;
    }
    const url=endpoint();
    if(!url){
      const msg='Chat relay is not configured. Open the canonical portfolio or set a worker URL with connect-chat <url>.';
      if(fromTerminal)addBlock(`<b>CHAT RELAY NOT CONFIGURED</b><br>${escapeHtml(msg)}`); else renderMessage({role:'assistant',content:msg});
      return;
    }
    const prior=history.slice(-10);
    renderMessage({role:'user',content:text});
    if(fromTerminal)addLine(`<span class="purple">you</span> // ${escapeHtml(text)}`,'dim');
    try{
      const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:text,history:prior})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);
      const reply=data.reply||'No response text returned.';
      renderMessage({role:'assistant',content:reply});
      if(fromTerminal)addBlock(`<b>MORPHEUS</b><br>${escapeHtml(reply).replace(/\n/g,'<br>')}`);
    }catch(err){
      const msg=String(err?.message||err);
      const out=/failed to fetch|networkerror|load failed/i.test(msg)
        ?`The path is there, but the door is closed. Open the canonical portfolio at ${canonical} or verify the worker and CORS origin.`
        :`Relay error: ${msg}`;
      if(fromTerminal)addLine(`Grok relay failed: ${escapeHtml(out)}`,'error');
      else renderMessage({role:'assistant',content:out});
    }
  }
  if(chatForm){chatForm.addEventListener('submit',e=>{e.preventDefault();const v=chatInput?.value||'';if(chatInput)chatInput.value='';send(v)});}  
  loadHistory();
  renderHistory();
  return{chat:send,clear:()=>send('clear'),renderHistory};
}
