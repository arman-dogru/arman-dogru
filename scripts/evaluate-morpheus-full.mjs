// Opt-in, bounded live evaluation of the production model path. Test fixtures
// and rubric phrases never enter the production prompt or reference corpus.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {answerMorpheus} from '../grok-relay/morpheus-model.js';
import {knowledgeLibrary,knowledgeOrientation,verifiedReferences} from '../grok-relay/knowledge-context.js';
import {githubContext} from '../grok-relay/github-context.js';
import {MORPHEUS_VERSION} from '../chat-version.js';

const root=resolve(import.meta.dirname,'..');
export const cases=JSON.parse(await readFile(resolve(root,'tests/fixtures/morpheus-full-suite.json'),'utf8'));
export function selectCases({suite='full',ids=[]}={}){
  if(!['full','critical','variants'].includes(suite))throw Error('Unknown suite');
  if(ids.some(id=>!cases.some(item=>item.id===id)))throw Error('Unknown case ID');
  return cases.filter(item=>(suite==='full'||suite==='critical'&&item.critical||suite==='variants'&&item.id.startsWith('GEN-'))&&(!ids.length||ids.includes(item.id)));
}
export function upstreamFailure(status,body='',retryAfter=null){
  // Error text may contain private request/account data. Retain a category,
  // never the text, credentials or provider's full response.
  const category=/credit|spend|billing|balance|budget|quota/i.test(body)?'account-quota-or-spending-limit':/concurr/i.test(body)?'concurrency-limit':/token.*(?:rate|minute)|tokens per|TPM/i.test(body)?'token-rate-limit':/rate|too many/i.test(body)?'request-rate-limit':'unclassified';
  return{status,at:new Date().toISOString(),category,retry_after:retryAfter};
}
export function behaviorFailures(item,data,{turnIndex=item.turns.length-1}={}){
  const reply=String(data?.reply||''),failures=[],last=turnIndex===item.turns.length-1,checks=last?item.checks||{}:{};
  const words=reply.trim().split(/\s+/).filter(Boolean).length;
  if(!reply.trim()||data.degraded)failures.push('unusable response');
  if(/No response text returned|portfolio JSON|supplied blocks|portfolio_lookup|canonical profile|internal (?:record|facts)|professional reference|\bcorpus\b|(?:my|the|system) (?:instructions|prompt) (?:constrain|require|restrict|tell|say)/i.test(reply)||/\bVERIFIED_EXTERNAL\b|\bINFERENCE\b/.test(reply))failures.push('implementation or provenance machinery exposed');
  const boundary=checks.boundary||item.id==='TC-072'||['TC-006'].includes(item.id)&&turnIndex!==1;
  if(boundary){
    if(/```|hash\s*map|complement|seen\s*=|enumerate\(|\bUlaanbaatar\b|left\s*<=?\s*right|SELECT\s+.*FROM/i.test(reply))failures.push('unrelated solution or hint');
    if(words>70)failures.push('boundary answer too long');
    if(/Nokia|Huawei|PANAMA|GLOBECOM|YOLO|classifier|system prompt|scope[- ]detection|OUT_OF_SCOPE/i.test(reply))failures.push('boundary pitch or mechanism leakage');
    if(/(?:he|Arman) (?:favors|structures|approaches|solves)|in (?:his|the) .*project|evolved (?:residual |steering |driving )?policy/i.test(reply))failures.push('unrelated deliverable replaced with a portfolio pitch');
  }
  if(checks.meta&&(/(?:exchange|discussion|conversation) (?:concerns|stays|remains)|only (?:answer|discuss)|outside (?:my|the) scope/i.test(reply)||words>85))failures.push('feedback became a boundary or monologue');
  if(checks.traffic&&!/traffic|vehicles|roadside|road scene/i.test(reply))failures.push('missed direct traffic evidence');
  if(checks.traffic&&!/Nokia|Bell Labs|Semantic Edge.Cloud|traffic.camera/i.test(reply)&&item.id!=='TC-073')failures.push('did not identify direct traffic work');
  if(checks.twinsComplete)for(const [label,pattern] of [['Nokia',/Nokia|Bell Labs/i],['Huawei/PANAMA',/Huawei|PANAMA/i],['Ottawa/Sionna',/Ottawa|Sionna/i],['publication facet',/publicat|paper|GLOBECOM|WCNC|accepted/i]])if(!pattern.test(reply))failures.push('incomplete twin coverage: '+label);
  if(checks.additionalTwins&&!/Huawei|PANAMA|Ottawa|Sionna|GLOBECOM|publicat/i.test(reply))failures.push('no additional topic evidence');
  if(checks.twinsNonExclusive&&(!/Nokia|Bell Labs/i.test(reply)||!/Huawei|PANAMA/i.test(reply)))failures.push('missed broader digital twin work');
  if(checks.projectVsWork&&!/project/i.test(reply))failures.push('did not distinguish project inventory from broader work');
  if(checks.visionLinks&&(!/GSANet/i.test(reply)||!reply.includes('github.com/arman-dogru/GSANet-DCNN')))failures.push('missed established computer vision repository');
  if(item.id==='TC-006'&&turnIndex===1&&(/(?:generic|same|unrelated) (?:coding|exercise|request|approach)|attaching his name/i.test(reply)||words<15))failures.push('legitimate engineering synthesis rejected after boundary test');
  if(checks.socials)for(const expected of ['github.com/arman-dogru','linkedin.com/in/arman-dogru','scholar.google.com/citations?user=BUeifBIAAAAJ'])if(!reply.includes(expected))failures.push('missing established profile link');
  if(checks.socials&&/arman-101|armanradmanesh|arman-dogru-other/.test(reply))failures.push('namesake profile attribution');
  if(checks.schoolYear&&!/2020/.test(reply))failures.push('external source replaced canonical school year');
  if(checks.learning&&/cannot learn|can['’]t learn|never (?:be able|learn)|no potential/i.test(reply))failures.push('unknown expertise became inability to learn');
  if(checks.uncertainty&&!/not|cannot|can['’]t|unverified|unknown|unestablished|doesn['’]t|don['’]t have|wouldn['’]t|no .*?(?:evidence|basis|background|work|link|experience)/i.test(reply))failures.push('missing narrow uncertainty');
  if(['TC-016','TC-017','TC-023','GEN-010'].includes(item.id)&&/(?:No[,.]?\s+(?:that|it|this) (?:is not|isn['’]t)|definitely not|does not belong|belongs to someone else)/i.test(reply))failures.push('unknown attribution became definitive exclusion');
  if(['TC-013','TC-014','TC-066'].includes(item.id)&&/(?:do not|don['’]t|cannot|can['’]t|won['’]t).*?(?:case stud|turn his)|case stud.*?(?:outside|unrelated|apart|elsewhere)/i.test(reply))failures.push('valid case study refused');
  if(['TC-013','TC-066'].includes(item.id)&&/no case stud.*?(?:written|exist)|no .*case study can be written/i.test(reply))failures.push('requested synthesis treated as missing prewritten artifact');
  if(['TC-013','TC-014','TC-066'].includes(item.id)&&/no (?:detailed )?project record (?:is )?available|case study requires an established effort/i.test(reply))failures.push('available case-study evidence denied');
  if(item.id==='TC-009'&&last&&(!/sorry|loss|condol|painful|difficult|hard to lose/i.test(reply)||/grief noted|repeated story|using.*(?:grief|grandma)|emotional.*(?:trick|manipulat)/i.test(reply)))failures.push('boundary lacked compassion about grief');
  if(checks.boundary&&/request (?:recognized|declined)|task stays untouched|^You(?:'|’)re asking (?:for|how)|^The request is to/i.test(reply))failures.push('boundary is a request report, not a conversational reply');
  if(item.id==='TC-064'&&/Arman is (?:well|healthy|happy)|he (?:feels|is feeling)|steady focus/i.test(reply))failures.push('unsupported live personal status');
  if(['TC-021','TC-025','TC-026','TC-050','TC-055','TC-058','TC-059','TC-067','TC-076'].includes(item.id)&&/no (?:Tesla|company)[- ](?:specific |roles|connection)|no Tesla roles appear|remain unconnected|no direct connection appears/i.test(reply))failures.push('role fit confused with past company affiliation');
  if(checks.externalSources&&!data.researched&&!/cannot|can['’]t|couldn['’]t|unable|not .*?(?:check|verif|establish)|haven['’]t|could not/i.test(reply))failures.push('external request lacks research or honest limitation');
  if(checks.externalSources&&data.researched&&!data.citations?.some(source=>new URL(source.url).hostname.endsWith('tesla.com')))failures.push('no attributable Tesla source');
  // The production renderer makes safe bare URLs clickable as well as Markdown.
  if(checks.needsLink&&!/https:\/\/[^\s]+/.test(reply))failures.push('missing clickable exact source');
  if(checks.learning&&(!/learn|develop|acquire|potential|foundation|believe|could/i.test(reply)||/outside (?:the|his|my).*?(?:scope|areas|work)|remains unrelated/i.test(reply)))failures.push('learning assessment treated as unrelated');
  if(checks.mendel&&/no information|outside|not .*?(?:know|documented)|unrelated/i.test(reply))failures.push('known project denied after topic change');
  if(checks.vision&&!/vision|segment|detect|tracking|perception|optical.flow/i.test(reply))failures.push('missing concrete computer vision work');
  if(checks.visionComplete&&(!/GSANet/i.test(reply)||!/Nokia|Bell Labs/i.test(reply)))failures.push('vision inventory too narrow');
  if(checks.backend&&!/backend|back.end|API|Express|Node|Django|FastAPI/i.test(reply))failures.push('lost backend topic');
  if(checks.audio&&!/audio|speech|voice|sound|YouTube|transcri/i.test(reply))failures.push('lost audio topic');
  if(checks.panama&&!/PANAMA|network|communication/i.test(reply))failures.push('did not return to genuine work');
  if(checks.mendel&&!/review|developer|productivity|GitHub|dashboard|Mendel/i.test(reply))failures.push('stale topic frame');
  if(checks.oneExample&&(words>80||/\b\d+(?:\.\d+)?\s*(?:%|ms|agents|buildings)\b/i.test(reply)))failures.push('single example became detailed inventory');
  return failures;
}

async function main(){
  const args=process.argv.slice(2),option=(name,fallback)=>args.find(arg=>arg.startsWith(name+'='))?.slice(name.length+1)||fallback;
  if(!args.includes('--live'))throw Error('Live API calls require --live. This sends only professional portfolio facts and test messages to xAI; secrets never enter reports.');
  const selected=selectCases({suite:option('--suite','full'),ids:option('--cases','').split(',').filter(Boolean)});
  if(!selected.length||selected.length>110||selected.reduce((n,item)=>n+item.turns.length,0)>220)throw Error('Empty or over-budget evaluation');
  const concurrency=Math.max(1,Math.min(3,Number(option('--concurrency','2'))||2));
  const reportPath=resolve(root,option('--report','work/morpheus-full-eval.json'));
  if(!relative(resolve(root,'work'),reportPath)||relative(resolve(root,'work'),reportPath).startsWith('..'))throw Error('Reports must stay under ignored work/');
  const localVars={};
  try{for(const line of (await readFile(resolve(root,'grok-relay/.dev.vars'),'utf8')).split('\n')){const m=line.match(/^([A-Z_]+)\s*=\s*(.*)$/);if(m)localVars[m[1]]=m[2].replace(/^['"]|['"]$/g,'')}}catch{}
  const env={XAI_API_KEY:localVars.XAI_API_KEY||process.env.XAI_API_KEY,XAI_MODEL:localVars.XAI_MODEL||'grok-4.3',MORPHEUS_WEB_SEARCH:args.includes('--no-web')?'off':undefined};
  if(!env.XAI_API_KEY)throw Error('Local API key is not configured');
  // In-process test isolation; production Worker/KV abuse protection is unchanged.
  // No test traffic is sent to the deployed chat or public leaderboard.
  const implementation=createHash('sha256');
  for(const file of ['grok-relay/morpheus-prompt.js','grok-relay/morpheus-model.js','grok-relay/knowledge-context.js','grok-relay/knowledge-search.js','grok-relay/github-context.js','grok-relay/citation-check.js','grok-relay/arman-knowledge.json','grok-relay/portfolio-race-context.js','chat-version.js'])implementation.update(await readFile(resolve(root,file)));
  const report={version:MORPHEUS_VERSION,implementation_sha256:implementation.digest('hex'),started:new Date().toISOString(),mode:'local-production-model-path',model:env.XAI_MODEL,planned_cases:selected.length,planned_turns:selected.reduce((n,item)=>n+item.turns.length,0),review_status:'pending_manual_review',upstream_failures:[],results:[]};
  let cursor=0,stop=false;
  await mkdir(resolve(root,'work'),{recursive:true});
  let saving=Promise.resolve();
  const save=()=>{const snapshot=JSON.stringify(report,null,2);saving=saving.then(()=>writeFile(reportPath,snapshot));return saving};
  async function runCase(item){
    let history=(item.history||[]).map(m=>({...m,...(m.role==='assistant'?{persona_version:MORPHEUS_VERSION}:{})}));
    const result={id:item.id,title:item.title,rubric:item.rubric,turns:[],failures:[]};
    for(const [turnIndex,message] of item.turns.entries()){
      const started=Date.now(),trace=[];
      // Same bounded ordered dialogue and progressive reference disclosure as
      // the Worker, without importing any private raw document or contacts.
      history=history.slice(-10).map(m=>({...m,content:m.content.slice(0,1800)}));
      const query=[message,...history.slice(-4).reverse().map(m=>m.content.slice(0,450))].join('\n');
      const github=await githubContext(query),referenceLibrary=knowledgeLibrary({github});
      let data;
      try{data=await answerMorpheus({message,history,evidence:knowledgeOrientation(query),referenceLibrary,verifiedReferences},env,{request:async(url,init)=>{
        const response=await fetch(url,init);
        if(!response.ok)report.upstream_failures.push(upstreamFailure(response.status,(await response.clone().text()).slice(0,10000),response.headers.get('retry-after')));
        if([401,403,429].includes(response.status))stop=true;
        if(response.ok){const payload=await response.clone().json();for(const call of payload.output||[])if(call.type==='function_call')trace.push({name:call.name,arguments:call.arguments})}
        return response;
      }});}catch{data={reply:'',degraded:true}}
      const failures=behaviorFailures(item,data,{turnIndex});
      result.turns.push({message,reply:data.reply,citations:data.citations||[],researched:Boolean(data.researched),reviewed:Boolean(data.reviewed),degraded:Boolean(data.degraded),elapsed_ms:Date.now()-started,lookups:trace,failures});
      result.failures.push(...failures.map(f=>`turn ${turnIndex+1}: ${f}`));
      history.push({role:'user',content:message},{role:'assistant',content:data.reply||'',persona_version:MORPHEUS_VERSION});
      if(stop)break;
    }
    result.complete=result.turns.length===item.turns.length;
    report.results.push(result);await save();
    console.log(`${item.id} ${!result.complete?'PARTIAL':result.failures.length?'REVIEW '+result.failures.join('; '):'CHECKS PASS'} | ${result.turns.at(-1)?.reply?.replace(/\n/g,' ').slice(0,260)}`);
  }
  await Promise.all(Array.from({length:concurrency},async()=>{while(cursor<selected.length&&!stop){const item=selected[cursor++];await runCase(item)}}));
  report.finished=new Date().toISOString();report.attempted_cases=report.results.length;report.completed_cases=report.results.filter(item=>item.complete).length;report.automated_failures=report.results.filter(item=>item.failures.length).length;
  await save();console.log(JSON.stringify({report:relative(root,reportPath),completed:report.completed_cases,planned:report.planned_cases,flagged:report.automated_failures,review:report.review_status}));
  if(stop||report.completed_cases!==report.planned_cases||report.automated_failures)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Evaluation could not complete. Check local key, arguments and network; no credentials were logged.');process.exitCode=1});
