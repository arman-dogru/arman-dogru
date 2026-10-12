// Corpus-wide discovery, never a scope classifier. Only reviewed INTERNAL
// records participate; web snippets, visitor state and the board cannot rank
// themselves into Arman's identity or achievements.
export const CANONICAL_SECTIONS=['profile','experience','projects','research','skills','education','race'];
export function evidenceWithoutMeasurements(value){
  if(Array.isArray(value))return value.map(evidenceWithoutMeasurements);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='facts'&&Array.isArray(item)?item.filter(fact=>typeof fact!=='string'||!/\b\d[\d,.]*(?:\s+\d+)*\s*(?:%|ms\b|s\b|seconds?\b|m\b|km\b|MHz\b|GHz\b|buildings?\b|triangles?\b|agents?\b|jobs?\b|records?\b|tiles?\b)/i.test(fact)):evidenceWithoutMeasurements(item)]));
}
const STOP=new Set('a an the and or to of in on at by for from with as is are was were be been being it its this that these those he him his she they their them arman dogru i me my we us our you your what which who where when how why can could would should do does did have has had will about tell give find show looking someone help work works experience project projects research skill skills career portfolio fit hire hiring engineer engineering documented actual relevant build building need needs'.split(' '));
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
export function searchKnowledge(library,{query='',related_queries=[],limit=6}={}){
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
  return{checked_sections:CANONICAL_SECTIONS.filter(section=>library?.[section]?.provenance==='INTERNAL'),records_checked:documents.length,query:String(query).slice(0,1000),related_queries:Array.isArray(related_queries)?related_queries.filter(x=>typeof x==='string').slice(0,4).map(x=>x.slice(0,200)):[],matches:scored.slice(0,Math.max(1,Math.min(12,Number(limit)||6))),interpretation:'Relevance signals are search matches, not proof of direct expertise. Compare all returned evidence: direct work before adjacent work, transfer before speculation. No match means this search found none, not that Arman lacks ability or cannot learn.'};
}
