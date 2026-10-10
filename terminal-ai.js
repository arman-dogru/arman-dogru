export function createAI({addLine,addBlock,escapeHtml}){
  const endpoint=()=>window.ARMAN_CHAT_ENDPOINT||localStorage.getItem('arman.chatEndpoint')||'';
  async function chat(message){
    const text=(message||'').trim();
    if(!text){addLine('usage: chat <question about Arman or his work>','yellow');return}
    if(text.length>600){addLine('chat input rejected: maximum 600 characters.','error');return}
    const url=endpoint();
    if(!url){addBlock(`<b>GROK RELAY NOT CONFIGURED</b><br>This static site never stores an xAI key. Deploy the included <span class="cyan">grok-relay/worker.js</span>, set <span class="purple">XAI_API_KEY</span> as a server secret, then configure this browser with:<br><br><span class="cyan">connect-chat https://your-worker.example.workers.dev/</span>`);return}
    const marker=addLine('<span class="purple">grok</span> // answering from portfolio context…','dim');
    try{
      const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:text})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);
      marker.remove();addBlock(`<b>GROK // PORTFOLIO MODE</b><br>${escapeHtml(data.reply||'No response text returned.').replace(/\n/g,'<br>')}`);
    }catch(err){marker.remove();addLine(`Grok relay failed: ${escapeHtml(err.message)}`,'error')}
  }
  return{chat};
}
