export function createAI({addLine,addBlock,escapeHtml}){
  const endpoint=()=>window.ARMAN_CHAT_ENDPOINT||localStorage.getItem('arman.chatEndpoint')||'';
  const canonical='https://arman-dogru.arman-dogru.workers.dev';
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
    }catch(err){
      marker.remove();
      const msg=String(err?.message||err);
      if(/failed to fetch|networkerror|load failed/i.test(msg)){
        const here=location.origin;
        addBlock(`<b>GROK RELAY UNREACHABLE</b><br>Browser network/CORS request failed from <span class="yellow">${escapeHtml(here)}</span>.<br><br>Open the canonical portfolio at <span class="cyan">${canonical}</span> or verify that the Cloudflare chat Worker is deployed and its <span class="purple">ALLOWED_ORIGIN</span> matches the portfolio origin.`);
      }else addLine(`Grok relay failed: ${escapeHtml(msg)}`,'error');
    }
  }
  return{chat};
}
