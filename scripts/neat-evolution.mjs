import {rng} from './race-evaluation.mjs';

export function evolution(seed){
  const random=rng(seed),innovations=new Map(),splits=new Map();let nextInnovation=0,nextNode=23,nextId=0;
  const gaussian=()=>Math.sqrt(-2*Math.log(Math.max(1e-9,random())))*Math.cos(2*Math.PI*random());
  const pick=a=>a[Math.floor(random()*a.length)];
  const innovation=(a,b)=>{const key=`${a}:${b}`;if(!innovations.has(key))innovations.set(key,nextInnovation++);return innovations.get(key)};
  const gene=(a,b,w)=>({a,b,w,enabled:true,innovation:innovation(a,b)});
  function fresh(){return{id:nextId++,generation:0,hidden:{},genes:Array.from({length:42},(_,i)=>gene(Math.floor(i/2),21+i%2,gaussian()*.06)),fitness:0}}
  function copy(g){return{...g,id:nextId++,hidden:{...g.hidden},genes:g.genes.map(c=>({...c})),fitness:0}}
  const levels=g=>({...Object.fromEntries(Array.from({length:21},(_,i)=>[i,0])),21:1,22:1,...g.hidden});
  function mutate(g){
    for(const c of g.genes){if(random()<.85)c.w=Math.max(-4,Math.min(4,c.w+gaussian()*.12));if(random()<.008)c.w=gaussian()*.5}
    if(random()<.18&&Object.keys(g.hidden).length<8){
      const old=pick(g.genes.filter(c=>c.enabled));if(old){old.enabled=false;
        if(!splits.has(old.innovation))splits.set(old.innovation,nextNode++);const node=splits.get(old.innovation),ls=levels(g);
        g.hidden[node]=(ls[old.a]+ls[old.b])/2;
        for(const c of [gene(old.a,node,1),gene(node,old.b,old.w)]){const existing=g.genes.find(x=>x.innovation===c.innovation);if(existing)existing.enabled=true;else g.genes.push(c)}
      }
    }
    if(random()<.3){const ls=levels(g),ids=Object.keys(ls).map(Number);for(let attempt=0;attempt<60;attempt++){const a=pick(ids),b=pick(ids);if(ls[a]<ls[b]&&!g.genes.some(c=>c.a===a&&c.b===b)){g.genes.push(gene(a,b,gaussian()*.2));break}}}
    return g;
  }
  function distance(a,b){const B=new Map(b.genes.map(c=>[c.innovation,c]));let unmatched=0,delta=0,matched=0;for(const c of a.genes){const other=B.get(c.innovation);if(other){matched++;delta+=Math.abs(c.w-other.w);B.delete(c.innovation)}else unmatched++}return 1.5*(unmatched+B.size)/Math.max(a.genes.length,b.genes.length)+.7*delta/Math.max(1,matched)}
  function crossover(a,b){if(b.fitness>a.fitness)[a,b]=[b,a];const child=copy(a),B=new Map(b.genes.map(c=>[c.innovation,c]));child.hidden={...b.hidden,...a.hidden};child.genes=a.genes.map(c=>{const other=B.get(c.innovation),chosen=other&&random()<.5?other:c;return{...chosen,enabled:!other||c.enabled&&other.enabled?chosen.enabled:random()>.75}});return child}
  function species(population,threshold=.5){const groups=[];for(const g of population){let group=groups.find(s=>distance(g,s[0])<threshold);if(!group){group=[];groups.push(group)}group.push(g)}return groups}
  function breed(population,generation){
    const groups=species(population),min=Math.min(...population.map(g=>g.fitness)),weights=groups.map(s=>s.reduce((n,g)=>n+Math.max(1,g.fitness-min+1),0)/s.length);
    const chooseGroup=()=>{let dart=random()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<groups.length;i++){dart-=weights[i];if(dart<=0)return groups[i]}return groups.at(-1)};
    const children=[];
    for(const group of groups){group.sort((a,b)=>b.fitness-a.fitness);children.push(copy(group[0]))}
    population.sort((a,b)=>b.fitness-a.fitness);children.push(copy(population[0]));
    while(children.length<population.length){const selected=chooseGroup(),group=selected.slice(0,Math.max(2,Math.ceil(selected.length*.5)));const a=pick(group),b=pick(group);children.push(mutate(random()<.7?crossover(a,b):copy(a)))}
    return children.slice(0,population.length).map(g=>({...g,generation}));
  }
  const exportGenome=g=>({name:`genome-${g.id}`,rating:90,generation:g.generation,hidden:{...g.hidden},connections:g.genes.filter(c=>c.enabled).map(c=>[c.a,c.b,+c.w.toFixed(7)]),fitness:g.fitness});
  return{fresh,mutate,breed,species,exportGenome,random};
}
