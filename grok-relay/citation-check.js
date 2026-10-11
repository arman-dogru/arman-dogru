// Check provider-collected citations only. This is not a visitor URL-fetch API.
// No credentials, cookies, arbitrary ports, IP literals or private/local names.
const cache=new Map();
export function checkableURL(value){
  try{
    const u=new URL(value),host=u.hostname.toLowerCase().replace(/\.$/,'');
    if(!/^https?:$/.test(u.protocol)||u.username||u.password||u.port&&!['80','443'].includes(u.port))return'';
    if(!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)||/(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion)$/.test(host))return'';
    if(host==='metadata.google.internal')return'';
    return u.href;
  }catch{return''}
}
async function check(url,request,timeoutMs){
  const saved=cache.get(url);if(saved&&Date.now()-saved.at<600000)return saved.state;
  let target=url,state='unknown';
  try{
    for(let step=0;step<3;step++){
      if(!checkableURL(target)){state='dead';break}
      const response=await request(target,{method:'HEAD',redirect:'manual',headers:{'user-agent':'arman-portfolio-source-check'},signal:AbortSignal.timeout(timeoutMs)});
      if(response.status>=300&&response.status<400){const location=response.headers.get('location');if(!location)break;target=new URL(location,target).href;continue}
      if(response.status===404||response.status===410)state='dead';
      else if(response.ok)state='reachable';
      // A blocked HEAD or timeout is not proof a page is dead. Do not bypass it.
      break;
    }
  }catch{/* Keep unknown distinct from a confirmed broken URL. */}
  if(cache.size>=128)cache.delete(cache.keys().next().value);
  cache.set(url,{at:Date.now(),state});return state;
}
export async function validateCitations(citations,{request=fetch,timeoutMs=1800}={}){
  const checked=await Promise.all(citations.slice(0,8).map(async item=>({item,state:checkableURL(item.url)?await check(item.url,request,timeoutMs):'dead'})));
  return{citations:checked.filter(x=>x.state!=='dead').map(x=>x.item),deadURLs:checked.filter(x=>x.state==='dead').map(x=>x.item.url)};
}
