// Corpus-wide discovery, never a scope classifier. Only reviewed INTERNAL
// records participate; web snippets, visitor state and the board cannot rank
// themselves into Arman's identity or achievements.
export const CANONICAL_SECTIONS=['profile','experience','projects','research','skills','education','race'];
export function evidenceWithoutMeasurements(value){
  if(Array.isArray(value))return value.map(evidenceWithoutMeasurements);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='facts'&&Array.isArray(item)?item.filter(fact=>typeof fact!=='string'||!/\b\d[\d,.]*(?:\s+\d+)*\s*(?:%|ms\b|s\b|seconds?\b|m\b|km\b|MHz\b|GHz\b|buildings?\b|triangles?\b|agents?\b|jobs?\b|records?\b|tiles?\b)/i.test(fact)):evidenceWithoutMeasurements(item)]));
}
const STOP=new Set('a an the and or to of in on at by for from with as is are was were be been being it its this that these those he him his she they their them arman dogru i me my we us our you your what which who where when how why can could would should do does did have has had will about tell give find show looking someone help work works experience project projects research skill skills career portfolio fit hire hiring engineer engineering documented actual relevant build building need needs all every everything full complete entire list only anything else more none nothing other additional already mentioned'.split(' '));
export function searchTerms(value){
  return [...new Set((String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().match(/[\p{L}\p{N}+#]+/gu)||[]).filter(word=>word.length>1&&!STOP.has(word)).map(word=>word.length>4&&word.endsWith('s')&&!word.endsWith('ss')?word.slice(0,-1):word))];
}
const strings=value=>typeof value==='string'?value:Array.isArray(value)?value.map(strings).join(' '):value&&typeof value==='object'?Object.values(value).map(strings).join(' '):'';
function records(library){
  const documents=[];
  const add=(section,evidence,source,prefix='')=>{
    const items=Array.isArray(evidence)?evidence:[evidence];
    for(const [index,record] of items.entries()){
      if(!record||typeof record!=='object')continue;
      const title=record.title||record.name||[record.organization,record.role].filter(Boolean).join(' · ')||record.institution||`${section}${prefix}`;
      documents.push({id:`${section}${prefix}:${index}`,section,title,provenance:'INTERNAL',source,evidence:record});
    }
  };
  for(const section of CANONICAL_SECTIONS){
    const envelope=library?.[section];if(envelope?.provenance!=='INTERNAL')continue;
    if(section==='projects'&&envelope.evidence?.documented_projects){
      add(section,envelope.evidence.documented_projects,envelope.source);
      const supplement=envelope.evidence.portfolio_supplement;
      if(supplement?.provenance==='INTERNAL')add(section,supplement.projects,supplement.source,':supplement');
    }else if(section==='race'){
      // Do not ingest visitor-authored leaderboard entries under an INTERNAL envelope.
      add(section,envelope.evidence?.implementation,envelope.source);
    }else add(section,envelope.evidence,envelope.source);
  }
  return documents;
}
export function knowledgeIndex(library){
  return records(library).slice(0,96).map(({id,section,title,evidence})=>({id,section,title,summary:String(evidence.facts?.[0]||'').slice(0,220)}));
}
// This portfolio is small enough to inspect its whole reviewed record. Lexical
// ranking is a navigation aid, not a semantic gate: a company-fit question may
// share no tokens with the relevant experience. Keep all facts and provenance;
// brevity belongs in the answer, not in destructive evidence filtering.
export function canonicalCorpus(library,{limit=64,surfaced_ids=[]}={}){
  const documents=records(library),size=Math.max(1,Math.min(96,limit)),surfaced=new Set(surfaced_ids);
  return{coverage:{total_records:documents.length,returned_records:Math.min(size,documents.length),truncated:documents.length>size},records:documents.slice(0,size).map(doc=>({...doc,previously_surfaced:surfaced.has(doc.id)}))};
}
// Recognition marks an example as discussed, not exhausted: a paper and an
// implementation of the same effort may still provide different useful facets.
export function surfacedEvidence(library,history=[]){
  const normalize=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const replies=history.filter(item=>item?.role==='assistant').slice(-5).map(item=>normalize(item.content));
  return records(library).filter(doc=>{
    const labels=[doc.evidence.name,doc.evidence.title,doc.evidence.organization,doc.evidence.institution].filter(value=>typeof value==='string'&&normalize(value).length>=5);
    return labels.some(label=>replies.some(reply=>{
      if(` ${reply} `.includes(` ${normalize(label)} `))return true;
      const terms=searchTerms(label),spoken=new Set(searchTerms(reply));
      return terms.length>=3&&terms.filter(term=>spoken.has(term)).length/terms.length>=.8;
    }));
  }).map(doc=>doc.id);
}
export function searchKnowledge(library,{query='',related_queries=[],limit=6,mode='focused',offset=0,surfaced_ids=[]}={}){
  const documents=records(library),primary=searchTerms(String(query).slice(0,1000)).slice(0,48),expanded=searchTerms((Array.isArray(related_queries)?related_queries:[]).filter(x=>typeof x==='string').slice(0,4).map(x=>x.slice(0,200)).join(' ')).filter(term=>!primary.includes(term));
  const terms=[...primary,...expanded],indexed=documents.map(doc=>({...doc,titleTerms:searchTerms(doc.title),bodyTerms:searchTerms(strings(doc.evidence))}));
  const frequency=new Map(terms.map(term=>[term,indexed.filter(doc=>doc.bodyTerms.includes(term)).length]));
  const scored=indexed.map(doc=>{
    const matched_terms=primary.filter(term=>doc.bodyTerms.includes(term)),expanded_terms=expanded.filter(term=>doc.bodyTerms.includes(term));
    const weight=term=>Math.log(1+(documents.length+.5)/((frequency.get(term)||0)+.5))*(doc.titleTerms.includes(term)?3:1);
    // Primary-subject coverage dominates expanded-topic recall. Expanded queries
    // improve discovery, not credentials or the model's final fit classification.
    const score=matched_terms.length*8+matched_terms.reduce((n,t)=>n+weight(t),0)+expanded_terms.reduce((n,t)=>n+weight(t)*.35,0);
    const {titleTerms,bodyTerms,...record}=doc;
    return{...record,relevance:{score:Math.round(score*100)/100,matched_terms,expanded_terms,match_kind:matched_terms.length?'primary_query':'expanded_query'}};
  }).filter(doc=>doc.relevance.score>0).sort((a,b)=>b.relevance.score-a.relevance.score||a.id.localeCompare(b.id));
  const exhaustive=mode==='exhaustive',start=Math.max(0,Math.floor(Number(offset)||0)),size=exhaustive?64:Math.max(1,Math.min(12,Number(limit)||6));
  const surfaced=new Set(Array.isArray(surfaced_ids)?surfaced_ids:[]),matches=scored.slice(start,start+size).map(doc=>({...doc,previously_surfaced:surfaced.has(doc.id)}));
  const checked_sections=CANONICAL_SECTIONS.filter(section=>library?.[section]?.provenance==='INTERNAL'),next=start+matches.length;
  return{checked_sections,records_checked:documents.length,query:String(query).slice(0,1000),related_queries:Array.isArray(related_queries)?related_queries.filter(x=>typeof x==='string').slice(0,4).map(x=>x.slice(0,200)):[],mode:exhaustive?'exhaustive':'focused',coverage:{matched_records:scored.length,returned_records:matches.length,offset:start,truncated:next<scored.length,complete_within_query:start===0&&next>=scored.length,next_offset:next<scored.length?next:null,previously_surfaced_ids:[...surfaced].filter(id=>documents.some(doc=>doc.id===id))},matches,interpretation:'Search matches are discovery evidence, not proof of direct expertise. Compare their actual facts: direct work before adjacent work, transfer before speculation. Complete coverage means all lexical matches for these queries in the checked internal sections, not semantic certainty or a universal absence claim. Expand terminology for exhaustive or negative claims. Previously surfaced means mentioned in the dialogue, not that every facet was explained. Group related projects/publications without losing their distinct evidence. No match means this search found none, not that Arman lacks ability or cannot learn.'};
}
