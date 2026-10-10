import baseWorker,{getBoard} from './worker.js';
import profile from '../portfolio-context.json' with {type:'json'};

const MODEL='grok-4.3';
const MAX_MESSAGE=10000;
const MAX_HISTORY=10;
let githubCache={value:null,at:0};

import {SYSTEM_PROMPT} from './morpheus-prompt.js';

function configuredOrigins(env){return String(env.ALLOWED_ORIGINS||env.ALLOWED_ORIGIN||'').split(',').map(v=>v.trim().replace(/\/$/,'')).filter(Boolean)}
function isAllowedOrigin(origin,env){if(!origin)return true;const allowed=configuredOrigins(env);return allowed.length>0&&allowed.includes(origin.replace(/\/$/,''))}
function corsHeaders(origin){return{'access-control-allow-origin':origin||'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'86400','vary':'Origin'}}
function json(body,status=200,origin='*'){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8',...corsHeaders(origin),'cache-control':'no-store','x-content-type-options':'nosniff'}})}
function cleanText(v,limit=MAX_MESSAGE){if(typeof v!=='string')return'';return v.normalize('NFKC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,' ').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,limit)}
const STOP=new Set('the and for with from that this are was were have has had into your you our their they role job team work working about looking experience required preferred responsibilities qualifications years using who what why how good great engineer engineering research researcher candidate position'.split(' '));
function tokens(s){return[...new Set(String(s||'').toLowerCase().replace(/[^a-z0-9+#.-]+/g,' ').split(/\s+/).filter(x=>x.length>=2&&!STOP.has(x)))].slice(0,48)}
async function githubBase(){if(githubCache.value&&Date.now()-githubCache.at<180000)return githubCache.value;try{const headers={'user-agent':'arman-portfolio-agent','accept':'application/vnd.github+json'},[u,r]=await Promise.all([fetch('https://api.github.com/users/arman-dogru',{headers,cf:{cacheEverything:true,cacheTtl:180}}),fetch('https://api.github.com/users/arman-dogru/repos?per_page=100&sort=pushed',{headers,cf:{cacheEverything:true,cacheTtl:180}})]);if(!u.ok||!r.ok)throw new Error('github unavailable');const value={user:await u.json(),repos:await r.json()};githubCache={value,at:Date.now()};return value}catch{return null}}
async function githubContext(message){const base=await githubBase();if(!base)return{text:'Public GitHub retrieval was unavailable for this request.',sources:[]};const q=tokens(message),repos=(base.repos||[]).filter(r=>r&&!r.private),scored=repos.map(repo=>{const hay=`${repo.name} ${repo.description||''} ${repo.language||''}`.toLowerCase();return{repo,score:q.reduce((n,t)=>n+(hay.includes(t)?1:0),0)}}).sort((a,b)=>b.score-a.score||new Date(b.repo.pushed_at)-new Date(a.repo.pushed_at));const overview=scored.slice(0,24).map(x=>x.repo),u=base.user||{};let text=`GitHub profile: ${u.public_repos??'n/a'} public repositories, ${u.followers??'n/a'} followers.\n`+overview.map(r=>`- ${r.name} | ${r.language||'n/a'} | stars ${r.stargazers_count||0} | fork ${Boolean(r.fork)} | ${r.description||'no description'}`).join('\n');const targets=scored.filter(x=>x.score>0&&!x.repo.fork).slice(0,2);for(const item of targets){try{const rr=await fetch(`https://api.github.com/repos/arman-dogru/${encodeURIComponent(item.repo.name)}/readme`,{headers:{'user-agent':'arman-portfolio-agent','accept':'application/vnd.github.raw+json'},cf:{cacheEverything:true,cacheTtl:300}});if(rr.ok)text+=`\n\nREADME EXCERPT — ${item.repo.name}\n${(await rr.text()).slice(0,3500)}`}catch{}}return{text:text.slice(0,14000),sources:['github-public']}}
function cleanClientContext(v){if(!v||typeof v!=='object')return'';try{const allowed={active_view:String(v.active_view||'').slice(0,80),active_timeline_event:v.active_timeline_event||null,race:v.race||null,paddock:Array.isArray(v.paddock)?v.paddock.slice(0,8):[]};return JSON.stringify(allowed).slice(0,3500)}catch{return''}}
async function boardContext(env){try{return(await getBoard(env)).slice(0,10)}catch{return[]}}

async function chat(request,env,origin){
  if(!env.XAI_API_KEY)return json({error:'server is missing XAI_API_KEY'},503,origin||'*');
  const len=Number(request.headers.get('content-length')||0);if(len>50000)return json({error:'request too large'},413,origin||'*');
  let body;try{body=await request.json()}catch{return json({error:'invalid JSON'},400,origin||'*')}
  const message=cleanText(body?.message);if(!message)return json({error:'message is required'},400,origin||'*');if(message.length>MAX_MESSAGE)return json({error:`message must be <= ${MAX_MESSAGE} characters`},400,origin||'*');
  const history=Array.isArray(body?.history)?body.history.slice(-MAX_HISTORY).map(m=>({role:m?.role==='assistant'?'assistant':'user',content:cleanText(m?.content,1800)})).filter(m=>m.content):[];
  const [gh,board]=await Promise.all([githubContext(message),boardContext(env)]),client=cleanClientContext(body?.context),blocks=[`PORTFOLIO PROFILE\n${JSON.stringify(profile)}`,`PUBLIC GITHUB\n${gh.text}`];if(client)blocks.push(`CURRENT PORTFOLIO STATE\n${client}`);if(board.length)blocks.push(`ISTANBUL PADDOCK\n${JSON.stringify(board)}`);
  const system=`${SYSTEM_PROMPT}\n\n--- EVIDENCE ---\n\n${blocks.join('\n\n---\n\n')}`;
  let upstream;try{upstream=await fetch('https://api.x.ai/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${env.XAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model:env.XAI_MODEL||MODEL,messages:[{role:'system',content:system},...history,{role:'user',content:message}],temperature:.24,max_tokens:520,reasoning_effort:'none'})})}catch(err){console.error('xAI network error',err?.message||err);return json({error:'model service unreachable'},502,origin||'*')}
  if(!upstream.ok){const text=await upstream.text();console.error('xAI error',upstream.status,text.slice(0,500));return json({error:'model service unavailable'},502,origin||'*')}
  const data=await upstream.json(),reply=data?.choices?.[0]?.message?.content?.trim();if(!reply)return json({error:'empty model response'},502,origin||'*');const sources=['portfolio-profile',...gh.sources];if(client)sources.push('page-state');if(board.length)sources.push('paddock-board');return json({reply,sources:[...new Set(sources)]},200,origin||'*');
}

export default{async fetch(request,env,ctx){const url=new URL(request.url),origin=request.headers.get('origin')||'';if(origin&&!isAllowedOrigin(origin,env))return json({error:'origin not allowed'},403,origin);if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(origin||'*')});if(request.method==='POST'&&(url.pathname==='/'||url.pathname==='/chat'))return chat(request,env,origin);return baseWorker.fetch(request,env,ctx)}};
