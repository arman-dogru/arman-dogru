import {createServer} from 'node:http';
import {readFile, mkdir, writeFile, stat} from 'node:fs/promises';
import {watch} from 'node:fs';
import {resolve, extname, relative} from 'node:path';
import {gzipSync} from 'node:zlib';
import worker from '../grok-relay/agent-worker.js';
import {developmentChat,previewStatus} from './dev-chat.mjs';
import {MORPHEUS_VERSION} from '../chat-version.js';

const root=resolve(import.meta.dirname,'..'), port=Number(process.env.PORT||4173);
const publicChat=process.argv.includes('--public-chat');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
const localVars={};
try{for(const line of (await readFile(resolve(root,'grok-relay/.dev.vars'),'utf8')).split('\n')){const m=line.match(/^([A-Z_]+)\s*=\s*(.*)$/);if(m)localVars[m[1]]=m[2].replace(/^['"]|['"]$/g,'')}}catch{}
const storePath=resolve(root,'work/dev-kv.json');
let store={};try{store=JSON.parse(await readFile(storePath,'utf8'))}catch{}
let writes=Promise.resolve();
const kv={
  async get(key,options){const value=store[key];if(!value||value.expires&&Date.now()>value.expires)return null;return options?.type==='json'?JSON.parse(value.value):value.value},
  async put(key,value,options){store[key]={value,expires:options?.expirationTtl?Date.now()+options.expirationTtl*1000:null};writes=writes.then(async()=>{await mkdir(resolve(root,'work'),{recursive:true});await writeFile(storePath,JSON.stringify(store))});await writes},
  async list({prefix=''}){return{keys:Object.keys(store).filter(name=>name.startsWith(prefix)&&(!store[name].expires||Date.now()<store[name].expires)).map(name=>({name})),list_complete:true}}
};
const env={...localVars, XAI_API_KEY:localVars.XAI_API_KEY||process.env.XAI_API_KEY, XAI_MODEL:localVars.XAI_MODEL||'grok-4.3', LEADERBOARD:kv, ALLOWED_ORIGINS:`http://localhost:${port},http://127.0.0.1:${port}`, PROFANITY_BLOCKLIST_GZ_B64:localVars.PROFANITY_BLOCKLIST_GZ_B64||gzipSync('local-reserved-test-name').toString('base64')};
const subscribers=new Set();let reloadTimer;
watch(root,{recursive:true},(_,file)=>{if(!file||/^(work|node_modules|\.git|\.wrangler|scripts|tests|grok-relay)\//.test(file)||file.startsWith('.')||! /\.(html|css|m?js|json|svg|png|jpe?g)$/.test(file))return;clearTimeout(reloadTimer);reloadTimer=setTimeout(()=>{for(const res of subscribers)res.write('data: reload\n\n')},150)});
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://localhost:${port}`);
    if(url.pathname==='/__preview'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({...previewStatus(env,{publicChat}),chat_version:MORPHEUS_VERSION}));return}
    if(url.pathname==='/__reload'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(': connected\n\n');subscribers.add(res);req.on('close',()=>subscribers.delete(res));return}
    if(url.pathname.startsWith('/api/')){
      const chunks=[];for await(const c of req){chunks.push(c);if(chunks.reduce((n,c)=>n+c.length,0)>100000){res.writeHead(413);res.end();return}}
      const path=url.pathname.slice(4),body=Buffer.concat(chunks);
      // Public chat is explicit opt-in, never a fallback for a missing local key.
      // Local score submissions always exercise the checked-out Worker with separate storage.
      const localRequest=new Request(`http://localhost:${port}${path}`,{method:req.method,headers:{'content-type':'application/json',origin:`http://localhost:${port}`},...(body.length?{body}: {})});
      const response=path==='/chat'?await developmentChat(localRequest,env,{worker,publicChat}):await worker.fetch(localRequest,env,{});
      // fetch() has already decompressed the upstream body. Forwarding its encoding/length
      // headers made the browser attempt to decode the JSON a second time.
      const headers=new Headers(response.headers);for(const key of ['content-encoding','content-length','transfer-encoding','connection','alt-svc','nel','report-to'])headers.delete(key);
      res.writeHead(response.status,Object.fromEntries(headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    const rel=relative(root,path);
    if(rel.startsWith('..')||rel.split('/').some(p=>p.startsWith('.'))||/^(work|grok-relay|scripts|tests|node_modules)\//.test(rel)){res.writeHead(404);res.end('Not found');return}
    let data=await readFile(path);
    if(extname(path)==='.html')data=Buffer.from(data.toString().replace('</body>',`<script>new EventSource('/__reload').onmessage=()=>location.reload();document.querySelector('.oracle-signal').lastChild.textContent=${JSON.stringify(publicChat?'PUBLIC RELAY':env.XAI_API_KEY?'LOCAL PREVIEW':'LOCAL KEY NEEDED')};</script></body>`));
    res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.code==='ENOENT'?'Not found':error.message}))}
});
server.listen(port,'127.0.0.1',()=>console.log(`Portfolio: http://localhost:${port}\nChat: ${previewStatus(env,{publicChat}).mode}${!publicChat&&!env.XAI_API_KEY?' — add XAI_API_KEY to grok-relay/.dev.vars before testing':''}\nVersion: ${MORPHEUS_VERSION}\nLeaderboard: persistent local development board`));
process.on('SIGTERM',()=>{for(const res of subscribers)res.end();server.close(()=>process.exit())});
