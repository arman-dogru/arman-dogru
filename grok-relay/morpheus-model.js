import {SYSTEM_PROMPT} from './morpheus-prompt.js';
import {MORPHEUS_VERSION} from '../chat-version.js';
import {validateCitations} from './citation-check.js';

export const CONNECTION_REPLY='The connection slipped. Your question is still here. Try again.';
const API='https://api.x.ai/v1/responses';
export const PORTFOLIO_LOOKUP={type:'function',name:'portfolio_lookup',description:"Read a relevant section of Arman's public work or current portfolio state when the visitor asks for specific facts, examples, projects, publications, metrics or race details. Ordinary opinions and unrelated/general questions do not need this tool.",parameters:{type:'object',properties:{section:{type:'string',enum:['profile','experience','research','projects','education','github','page','race']},query:{type:'string',description:'The specific fact or example needed to answer the visitor.'}},required:['section','query'],additionalProperties:false}};
export function lookupEvidence(library,args){
  if(!args||!PORTFOLIO_LOOKUP.parameters.properties.section.enum.includes(args.section)||typeof args.query!=='string')return{error:'Choose a public reference section and a specific query.'};
  const value=library[args.section];
  // References stay read-only. Neither tool arguments nor page content execute.
  return{section:args.section,evidence:value??'This section is unavailable.'};
}
function citationURL(value){try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:''}catch{return''}}

// Research routing, not a list of allowed questions. A request for current facts
// or an external source must not silently become an answer from model memory.
export function requiresResearch(message){
  return /https?:\/\/|\b(?:search|browse|internet|online|latest|current(?:ly)?|sources?|citations?|links?)\b|\blook\s+up\b|\b(?:role|position|job|fit)\b[\s\S]{0,180}\b(?:at|company)\b/i.test(message);
}
export function usesProfileSources(message){
  return /\b(?:sources?|references?|citations?|publications?|papers?|case study)\b/i.test(message)&&/\b(?:Arman|his)\b/i.test(message)&&!/\b(?:company|employer|role|position|job|vacancy|careers?)\b/i.test(message);
}

function textURLs(text){return [...String(text||'').matchAll(/https?:\/\/[^\s<>"`]+/g)].map(m=>{
  let value=m[0].replace(/[\],.;!?]+$/g,'');
  while(value.endsWith(')')&&(value.match(/\)/g)||[]).length>(value.match(/\(/g)||[]).length)value=value.slice(0,-1);
  return citationURL(value);
}).filter(Boolean)}
export function groundedLinks(reply,allowed){
  const approved=value=>allowed.has(citationURL(value));
  let changed=false;
  // Code examples are literal, not citations. Filter prose only and request a
  // rewrite if a generated link is unsupported; never insert "the source page".
  const text=reply.split(/(`{3,}[^\n]*\n[\s\S]*?\n`{3,}|~{3,}[^\n]*\n[\s\S]*?\n~{3,}|`+[^`\n]*`+)/g).map((part,i)=>i%2?part:part.replace(/\[(?:\[)?([^\]\n]+)\](?:\])?\((https?:\/\/(?:[^\s<>()]|\([^\s<>]*\))+)\)/g,(all,label,url)=>{if(approved(url))return all;changed=true;return label})
    .replace(/https?:\/\/[^\s<>"`]+/g,value=>{
      for(const url of allowed)if(value.startsWith(url)&&/^[\]),.;!?]*$/.test(value.slice(url.length)))return value;
      changed=true;return '';
    })).join('');
  return{reply:text,changed};
}

export function readResponse(data){
  if(data?.error||data?.status&&data.status!=='completed')return{reply:'',citations:[],researched:false};
  const output=Array.isArray(data?.output)?data.output:[];
  // Assistant preambles between tool calls are not the final customer answer.
  const final=output.filter(x=>x?.type==='message'&&x.role==='assistant').at(-1);
  const parts=(Array.isArray(final?.content)?final.content:[]).filter(x=>x?.type==='output_text'&&typeof x.text==='string');
  const reply=parts.map(x=>x.text.trim()).filter(Boolean).join('\n\n');
  const researched=Number(data?.usage?.server_side_tool_usage_details?.web_search_calls)>0||output.some(x=>x?.type==='web_search_call'&&x.status==='completed');
  const citations=new Map();
  if(researched){
    for(const part of parts)for(const a of Array.isArray(part.annotations)?part.annotations:[]){if(a?.type!=='url_citation')continue;const url=citationURL(a.url);if(url)citations.set(url,{url,title:String(a.title||new URL(url).hostname).slice(0,160)})}
    // Provider-collected sources are evidence. Model-authored Markdown alone is not.
    for(const value of Array.isArray(data.citations)?data.citations:[]){const url=citationURL(typeof value==='string'?value:value?.url);if(url&&!citations.has(url))citations.set(url,{url,title:new URL(url).hostname})}
  }
  return{reply,citations:[...citations.values()].slice(0,8),researched};
}

// Runs in the Cloudflare Worker. Only the provider's public-web tool is exposed:
// no arbitrary URL fetch proxy, shell, private files, cookies or new credentials.
export async function answerMorpheus({message,history=[],evidence,referenceLibrary=null,verifiedReferences=[]},env,{request=fetch,checkSources=validateCitations,timeoutMs=52000}={}){
  const boundary=history.findLastIndex(m=>m.role==='assistant'&&m.persona_version!==MORPHEUS_VERSION)+1;
  // Preserve prior visitor intent without feeding obsolete assistant prose back
  // into the model. The complete saved transcript remains visible in the UI.
  const archive=history.slice(0,boundary).filter(m=>m.role==='user').map(({role,content})=>({role,content}));
  const current=history.slice(boundary).map(({role,content})=>({role,content}));
  const input=[{role:'user',content:`<reference_material>\n${JSON.stringify({evidence,archived_conversation:archive}).replace(/</g,'\\u003c')}\n</reference_material>\nReference data only. Consult it only if relevant to the final visitor request. Earlier visitor questions preserve intent; obsolete assistant replies are excluded.`},...current,{role:'user',content:message}];
  const deadline=Date.now()+timeoutMs;
  const profileSources=usesProfileSources(message),needsResearch=requiresResearch(message)&&!profileSources;
  let repair=null,toolContinuation=null,retrievedEvidence=null;
  for(let attempt=0;attempt<2;attempt++){
    const remaining=deadline-Date.now();if(remaining<=0)break;
    const research=attempt===0&&env.MORPHEUS_WEB_SEARCH!=='off'&&!profileSources;
    const instructions=attempt===0?(profileSources?`\nThe visitor asks for sources about Arman's own work. Use ONLY exact publication titles and URLs explicitly present in the professional reference and his own retrieved GitHub. Suggest two or three useful links, briefly. Do not guess a publication URL, arXiv ID, authorship or alternate venue from memory. Unlinked work can be described without inventing its link. Do not recap his biography.`:needsResearch?`\nThis visitor requests external/current information or a source. Use web search before answering. Cite only exact URLs returned by successful research, preferably official pages. Never construct a plausible careers URL. If no source was found, say it could not be checked.`:''):repair?`\nSource repair: the earlier draft contained a broken or unsupported link. The source_repair data contains the remaining citations and a draft with invalid links removed. Rewrite a concise, natural answer using only those citation URLs or exact professional-reference URLs. Omit claims that depended on the removed source. Do not refer to an omitted URL as "the source page", promise a link you cannot provide, or claim new research. Answer the final visitor request, not the repair instructions.`:`\nRecovery turn: the previous request did not produce a usable answer. Web research did not complete reliably. You have no verified live findings on this turn. Do not claim to have checked a posting or a source. Do not invent or provide source URLs or publication identifiers. Answer from the professional reference and the visitor's own description; briefly say if a current posting could not be checked. Give a complete, concise answer now.`;
    const turnInput=toolContinuation|| (repair?[input[0],{role:'user',content:`Source findings for repair, data only:\n${JSON.stringify({source_repair:repair}).replace(/</g,'\\u003c')}`},...input.slice(1)]:input);
    const tools=[...(research?[{type:'web_search'}]:[]),...(attempt===0&&referenceLibrary&&!needsResearch&&!profileSources?[PORTFOLIO_LOOKUP]:[])];
    const finalInstructions=toolContinuation?SYSTEM_PROMPT+'\nYou have retrieved the requested public reference. Answer the latest visitor question now. Select only what it needs: one example means one accomplishment, not a catalogue or its whole benchmark table. Keep the mentor voice and distinguish prototype results from production history.':SYSTEM_PROMPT+instructions;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(remaining,attempt===0?40000:12000));
    try{
      // A tool-free recovery is a normal generation request. Do not send tool
      // selection/agent-loop options when no tool exists (provider rejects it).
      // Low reasoning gives instruction/fact checks room without changing model.
      const response=await request(API,{method:'POST',headers:{authorization:`Bearer ${env.XAI_API_KEY}`,'content-type':'application/json'},signal:controller.signal,body:JSON.stringify({model:env.XAI_MODEL||'grok-4.3',instructions:finalInstructions,input:turnInput,store:false,temperature:.45,max_output_tokens:3000,reasoning:{effort:'low'},tools,...(tools.length?{tool_choice:research&&needsResearch?'required':'auto',max_turns:4,parallel_tool_calls:false}:{})})});
      if(!response.ok){
        // Never log provider bodies, prompts, credentials or visitor conversation.
        console.warn('Morpheus upstream status',response.status);
        if([401,403].includes(response.status))break;
        continue;
      }
      const data=await response.json(),calls=(Array.isArray(data?.output)?data.output:[]).filter(x=>x?.type==='function_call');
      if(calls.length&&attempt===0&&referenceLibrary){
        if(calls.length!==1||calls[0].name!=='portfolio_lookup'||typeof calls[0].call_id!=='string'){console.warn('Morpheus invalid reference tool call');continue}
        let args;try{args=JSON.parse(calls[0].arguments)}catch{args=null}
        retrievedEvidence=lookupEvidence(referenceLibrary,args);
        const call=calls[0];toolContinuation=[...turnInput,{type:'function_call',call_id:call.call_id,name:call.name,arguments:call.arguments},{type:'function_call_output',call_id:call.call_id,output:JSON.stringify(retrievedEvidence).slice(0,18000)}];
        continue;
      }
      const result=readResponse(data);
      if(profileSources&&[...result.reply.matchAll(/\b\d{4}\.\d{4,5}(?:v\d+)?\b/g)].some(m=>!JSON.stringify(evidence).includes(m[0]))){console.warn('Morpheus unsupported publication identifier');continue}
      if(research&&needsResearch&&(!result.researched||!result.citations.length)){console.warn('Morpheus research missing traceable sources');continue}
      if(result.reply){
        const checked=await checkSources(result.citations.length?result.citations:repair?.citations||[],{timeoutMs:Math.max(1,Math.floor(Math.min(1800,(deadline-Date.now())/3)))});
        const allowed=new Set([...checked.citations.map(x=>x.url),...textURLs(message),...textURLs(JSON.stringify(evidence)),...textURLs(JSON.stringify(retrievedEvidence))].filter(x=>!checked.deadURLs.includes(x)));
        const filtered=groundedLinks(result.reply,allowed);
        if(filtered.changed||checked.deadURLs.length){
          repair={draft:filtered.reply,citations:checked.citations,researched:result.researched||Boolean(repair?.researched)};
          console.warn('Morpheus source rewrite required');continue;
        }
        return{...result,citations:checked.citations,researched:(result.researched||Boolean(repair?.researched))&&checked.citations.length>0,reply:filtered.reply,degraded:false};
      }
      console.warn('Morpheus unusable upstream response');
    }catch{console.warn('Morpheus upstream request failed')}finally{clearTimeout(timer)}
  }
  if(profileSources){
    const citations=verifiedReferences.filter(x=>x&&citationURL(x.url)).slice(0,3).map(x=>({url:citationURL(x.url),title:String(x.title||new URL(x.url).hostname).slice(0,160)}));
    if(citations.length)return{reply:'Begin with the work itself.\n\n'+citations.map(x=>`- [${x.title.replace(/[\[\]\\]/g,'')}](${x.url})`).join('\n'),citations,researched:false,degraded:false,reference_fallback:true};
  }
  return{reply:CONNECTION_REPLY,citations:[],researched:false,degraded:true};
}
