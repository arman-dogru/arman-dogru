import {identity,knowledge} from './knowledge-context.js';

let cache={value:null,at:0};
const readmeCache=new Map();
const headers={'user-agent':'arman-portfolio-agent','accept':'application/vnd.github+json'};
const limitedFetch=(request,url,init={})=>request(url,{...init,signal:AbortSignal.timeout(5000)});
const STOP=new Set('the and for with from that this are was were have has had into your you our their they role job team work working about looking experience required preferred responsibilities qualifications years using who what why how good great engineer engineering research researcher candidate position'.split(' '));
function tokens(value){return[...new Set(String(value||'').toLowerCase().replace(/[^a-z0-9+#.-]+/g,' ').split(/\s+/).filter(x=>x.length>=2&&!STOP.has(x)))].slice(0,48)}
export function ownedRepository(repo){
  if(!repo||repo.private||repo.owner?.login?.toLowerCase()!==identity.githubOwner.toLowerCase()||typeof repo.name!=='string'||repo.name.length>100||!/^[\w.-]+$/.test(repo.name))return false;
  return repo.full_name?.toLowerCase()===`${identity.githubOwner}/${repo.name}`.toLowerCase()&&repo.html_url?.toLowerCase()===`${knowledge.profile.github}/${repo.name}`.toLowerCase();
}
async function githubBase(request){
  // Test-injected transports cannot seed or consume the production cache.
  if(request===fetch&&cache.value&&Date.now()-cache.at<180000)return cache.value;
  try{
    const owner=encodeURIComponent(identity.githubOwner),[userResponse,repoResponse]=await Promise.all([
      limitedFetch(request,`https://api.github.com/users/${owner}`,{headers,cf:{cacheEverything:true,cacheTtl:180}}),
      limitedFetch(request,`https://api.github.com/users/${owner}/repos?per_page=100&sort=pushed`,{headers,cf:{cacheEverything:true,cacheTtl:180}})
    ]);
    if(!userResponse.ok||!repoResponse.ok)return null;
    const user=await userResponse.json(),repos=await repoResponse.json();
    if(user.login?.toLowerCase()!==identity.githubOwner.toLowerCase()||user.html_url?.toLowerCase()!==knowledge.profile.github.toLowerCase()||!Array.isArray(repos))return null;
    // Do not import a remote bio, employer, identity, email or account links.
    const value={counts:{public_repos:user.public_repos,followers:user.followers},repos:repos.filter(ownedRepository)};
    if(request===fetch)cache={value,at:Date.now()};return value;
  }catch{return null}
}
export async function githubContext(message,{request=fetch}={}){
  const base=await githubBase(request);
  if(!base)return{provenance:'UNKNOWN',source:knowledge.profile.github,evidence:'Public GitHub retrieval unavailable. No outside identity claims established.'};
  const query=tokens(message),scored=base.repos.map(repo=>({repo,score:query.reduce((sum,token)=>sum+(`${repo.name} ${repo.description||''} ${repo.language||''}`.toLowerCase().includes(token)?1:0),0)})).sort((a,b)=>b.score-a.score||new Date(b.repo.pushed_at)-new Date(a.repo.pushed_at));
  const repos=await Promise.all(scored.slice(0,24).map(async({repo,score},index)=>{
    const item={name:repo.name,url:repo.html_url,owner:identity.githubOwner,language:repo.language,description:String(repo.description||'').slice(0,600),fork:Boolean(repo.fork),stars:repo.stargazers_count||0};
    if(score>0&&!repo.fork&&index<2)try{
      const response=await limitedFetch(request,`https://api.github.com/repos/${encodeURIComponent(identity.githubOwner)}/${encodeURIComponent(repo.name)}/readme`,{headers:{...headers,accept:'application/vnd.github.raw+json'},cf:{cacheEverything:true,cacheTtl:300}});
      if(response.ok)item.readme_excerpt=(await response.text()).slice(0,3500);
    }catch{}
    return item;
  }));
  // Bound the structured response without slicing serialized JSON mid-field.
  while(JSON.stringify(repos).length>13000&&repos.length>2)repos.pop();
  return{provenance:'VERIFIED_EXTERNAL',source:knowledge.profile.github,attribution:{github_owner:identity.githubOwner,method:'GitHub API owner.login, full_name and html_url matched the internal identifier; this verifies account attribution, not every README claim.'},evidence:{counts:base.counts,repositories:repos}};
}

// After semantic evidence selection, fetch the actual linked project rather
// than relying on words in the visitor's phrasing to rank its README. No URL
// supplied by a visitor is fetched here; ownership and exact path must match.
export async function repositoryReadmes(reference,{request=fetch,limit=2}={}){
  if(reference?.provenance!=='VERIFIED_EXTERNAL'||!Array.isArray(reference.evidence))return reference;
  const eligible=reference.evidence.filter(repo=>repo&&repo.owner===identity.githubOwner&&!repo.fork&&typeof repo.name==='string'&&repo.name.length<=100&&/^[\w.-]+$/.test(repo.name)&&repo.url===`${knowledge.profile.github}/${repo.name}`).slice(0,Math.max(0,Math.min(2,limit)));
  const evidence=await Promise.all(eligible.map(async repo=>{
    if(repo.readme_excerpt)return repo;
    const cached=request===fetch?readmeCache.get(repo.url):null;
    if(cached&&Date.now()-cached.at<180000)return{...repo,readme_excerpt:cached.text};
    try{
      const response=await request(`https://api.github.com/repos/${encodeURIComponent(identity.githubOwner)}/${encodeURIComponent(repo.name)}/readme`,{headers:{...headers,accept:'application/vnd.github.raw+json'},signal:AbortSignal.timeout(3000)});
      if(response.ok){
        const text=(await response.text()).slice(0,3500);
        if(text){if(request===fetch){if(readmeCache.size>=12)readmeCache.delete(readmeCache.keys().next().value);readmeCache.set(repo.url,{text,at:Date.now()})}return{...repo,readme_excerpt:text}}
      }
    }catch{}
    return repo;
  }));
  return{...reference,evidence};
}
