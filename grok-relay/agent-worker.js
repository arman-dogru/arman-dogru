import baseWorker,{getBoard} from './worker.js';
import profile from '../portfolio-context.json' with {type:'json'};

const MAX_MESSAGE=10000;
const MAX_HISTORY=10;
let githubCache={value:null,at:0};

import {answerMorpheus,CONNECTION_REPLY,usesProfileSources} from './morpheus-model.js';
import {MORPHEUS_VERSION} from '../chat-version.js';
import {RACE_CONTEXT} from './portfolio-race-context.js';

function configuredOrigins(env){return String(env.ALLOWED_ORIGINS||env.ALLOWED_ORIGIN||'').split(',').map(v=>v.trim().replace(/\/$/,'')).filter(Boolean)}
function isAllowedOrigin(origin,env){if(!origin)return true;const allowed=configuredOrigins(env);return allowed.length>0&&allowed.includes(origin.replace(/\/$/,''))}
function corsHeaders(origin){return{'access-control-allow-origin':origin||'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'86400','vary':'Origin'}}
function json(body,status=200,origin='*'){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8',...corsHeaders(origin),'cache-control':'no-store','x-content-type-options':'nosniff'}})}
function cleanText(v,limit=MAX_MESSAGE){if(typeof v!=='string')return'';return v.normalize('NFKC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,' ').replace(/\r\n?/g,'\n').trim().slice(0,limit)}
const limitedFetch=(url,init={})=>fetch(url,{...init,signal:AbortSignal.timeout(5000)});
const STOP=new Set('the and for with from that this are was were have has had into your you our their they role job team work working about looking experience required preferred responsibilities qualifications years using who what why how good great engineer engineering research researcher candidate position'.split(' '));
function tokens(s){return[...new Set(String(s||'').toLowerCase().replace(/[^a-z0-9+#.-]+/g,' ').split(/\s+/).filter(x=>x.length>=2&&!STOP.has(x)))].slice(0,48)}
async function githubBase(){if(githubCache.value&&Date.now()-githubCache.at<180000)return githubCache.value;try{const headers={'user-agent':'arman-portfolio-agent','accept':'application/vnd.github+json'},[u,r]=await Promise.all([limitedFetch('https://api.github.com/users/arman-dogru',{headers,cf:{cacheEverything:true,cacheTtl:180}}),limitedFetch('https://api.github.com/users/arman-dogru/repos?per_page=100&sort=pushed',{headers,cf:{cacheEverything:true,cacheTtl:180}})]);if(!u.ok||!r.ok)throw new Error('github unavailable');const value={user:await u.json(),repos:await r.json()};githubCache={value,at:Date.now()};return value}catch{return null}}
async function githubContext(message){
  const base=await githubBase();if(!base||!Array.isArray(base.repos))return{text:'Public GitHub retrieval was unavailable for this request.',sources:[]};
  const q=tokens(message),scored=base.repos.filter(r=>r&&!r.private).map(repo=>{const hay=`${repo.name} ${repo.description||''} ${repo.language||''}`.toLowerCase();return{repo,score:q.reduce((n,t)=>n+(hay.includes(t)?1:0),0)}}).sort((a,b)=>b.score-a.score||new Date(b.repo.pushed_at)-new Date(a.repo.pushed_at));
  const u=base.user||{};let text=`GitHub profile: ${u.public_repos??'n/a'} public repositories, ${u.followers??'n/a'} followers.\n`+scored.slice(0,24).map(({repo:r})=>`- ${r.name} | ${r.language||'n/a'} | stars ${r.stargazers_count||0} | fork ${Boolean(r.fork)} | ${r.description||'no description'}`).join('\n');
  const excerpts=await Promise.all(scored.filter(x=>x.score>0&&!x.repo.fork).slice(0,2).map(async({repo})=>{try{const rr=await limitedFetch(`https://api.github.com/repos/arman-dogru/${encodeURIComponent(repo.name)}/readme`,{headers:{'user-agent':'arman-portfolio-agent','accept':'application/vnd.github.raw+json'},cf:{cacheEverything:true,cacheTtl:300}});if(rr.ok)return`\n\nREADME EXCERPT — ${repo.name}\n${(await rr.text()).slice(0,3500)}`}catch{}return''}));
  return{text:(text+excerpts.join('')).slice(0,14000),sources:['github-public']};
}
function cleanClientContext(v){if(!v||typeof v!=='object')return'';try{const allowed={active_view:String(v.active_view||'').slice(0,80),active_timeline_event:v.active_timeline_event||null,race:v.race||null,paddock:Array.isArray(v.paddock)?v.paddock.slice(0,8):[]};return JSON.stringify(allowed).slice(0,3500)}catch{return''}}
async function boardContext(env){try{return(await getBoard(env)).slice(0,10)}catch{return[]}}

async function requestBody(request){
  const reader=request.body?.getReader();if(!reader)return null;
  const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>50000){await reader.cancel();return null}chunks.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function chat(request,env,origin){
  if(!env.XAI_API_KEY)return json({reply:CONNECTION_REPLY,degraded:true},503,origin||'*');
  const len=Number(request.headers.get('content-length')||0);if(len>50000)return json({error:'request too large'},413,origin||'*');
  let body;try{body=await requestBody(request);if(body===null)return json({error:'request too large'},413,origin||'*')}catch{return json({error:'invalid JSON'},400,origin||'*')}
  if(typeof body?.message==='string'&&body.message.length>MAX_MESSAGE)return json({error:`message must be <= ${MAX_MESSAGE} characters`},400,origin||'*');
  const message=cleanText(body?.message);if(!message)return json({error:'message is required'},400,origin||'*');
  const history=Array.isArray(body?.history)?body.history.slice(-MAX_HISTORY).filter(m=>m&&['user','assistant'].includes(m.role)).map(m=>({role:m.role,content:cleanText(m.content,1800),...(m.persona_version===MORPHEUS_VERSION?{persona_version:MORPHEUS_VERSION}:{})})).filter(m=>m.content):[];
  try{if(!await chatAllowance(request,env))return json({reply:'A moment. Let the signal settle, then ask again.',degraded:true},429,origin||'*')}catch{return json({reply:CONNECTION_REPLY,degraded:true},503,origin||'*')}
  // Source-contract metadata is implementation documentation, not biography.
  // Sending old behavioral rules as "facts" primed the previous RAG/HR voice.
  const publicWork={profile:profile.profile,education:profile.education,experience:profile.experience,research:profile.research,projects:profile.projects};
  // Keep the latest request first, then bounded recent context, so "examples
  // online?" can retrieve repositories from the actual preceding discussion.
  const retrievalQuery=[message,...history.slice(-4).reverse().map(m=>m.content.slice(0,450))].join('\n');
  const [gh,board]=await Promise.all([githubContext(retrievalQuery),boardContext(env)]),client=cleanClientContext(body?.context);
  const verifiedReferences=[...publicWork.research.filter(x=>x.url).map(x=>({title:x.title,url:x.url})),{title:"Arman's public projects",url:publicWork.profile.github},{title:"Arman's research profile",url:publicWork.profile.scholar}];
  // Progressive disclosure: do not put the entire CV/benchmark table into every
  // redirection or opinion request. Detailed facts remain available through a
  // bounded read-only lookup, not a whitelist of questions.
  const orientation={name:publicWork.profile.name,work:'Applied AI research and software engineering: computer vision and digital twins, learning and coordination among agents, LLM reliability, backend services and interactive software. His work spans research simulations and prototypes as well as industry and startup software, API and applied ML contributions.',portfolio:'This portfolio includes the playable NEAT Grand Prix race. The race lookup has its documented driver architecture as well as the public leaderboard; retrieve it for technical race questions.',references:usesProfileSources(message)?verifiedReferences:verifiedReferences.slice(-2)};
  const referenceLibrary={profile:publicWork.profile,experience:publicWork.experience,research:publicWork.research,projects:publicWork.projects,education:publicWork.education,github:gh.text,page:client,race:{implementation:RACE_CONTEXT,leaderboard:board}};
  const result=await answerMorpheus({message,history,evidence:orientation,referenceLibrary,verifiedReferences},env),sources=['portfolio-profile',...gh.sources];if(client)sources.push('page-state');if(board.length)sources.push('paddock-board');if(result.researched)sources.push('public-web');
  return json({...result,persona_version:MORPHEUS_VERSION,sources:[...new Set(sources)]},200,origin||'*');
}

// Best-effort cost protection using existing KV. Counters are not transactional;
// Cloudflare edge rate limits/provider spend limits remain the hard abuse boundary.
async function chatAllowance(request,env){
  if(!env.LEADERBOARD)return true;
  const hour=Math.floor(Date.now()/3600000),ip=request.headers.get('cf-connecting-ip')||'local';
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${hour}:${ip}`)),id=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
  const key=`chat-rate:${hour}:${id}`,count=Number(await env.LEADERBOARD.get(key)||0);
  if(count>=40)return false;
  await env.LEADERBOARD.put(key,String(count+1),{expirationTtl:7200});return true;
}

export default{async fetch(request,env,ctx){const url=new URL(request.url),origin=request.headers.get('origin')||'';if(origin&&!isAllowedOrigin(origin,env))return json({error:'origin not allowed'},403,origin);if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(origin||'*')});if(request.method==='POST'&&(url.pathname==='/'||url.pathname==='/chat'))return chat(request,env,origin);if(request.method==='GET'&&url.pathname==='/health')return json({ok:true,service:'arman-dogru-chat',model:env.XAI_MODEL||'grok-4.3',key_configured:Boolean(env.XAI_API_KEY),leaderboard_configured:Boolean(env.LEADERBOARD),chat_version:MORPHEUS_VERSION,web_search:env.MORPHEUS_WEB_SEARCH!=='off'},200,origin||'*');return baseWorker.fetch(request,env,ctx)}};
