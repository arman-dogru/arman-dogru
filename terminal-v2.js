import{PROFILE,JOURNEY,PROJECTS,RESEARCH}from'./terminal-data.js';
import{createJourneyMap}from'./terminal-map.js';
import{createRace}from'./terminal-race-v5.js';
import{createAI}from'./terminal-ai-v2.js';

const $=q=>document.querySelector(q),$$=q=>[...document.querySelectorAll(q)],terminal=$('#terminal'),form=$('#commandForm'),input=$('#commandInput'),footerMode=$('#footerMode'),history=[];
let historyIndex=0,activeView='experience',boardState=[],relaySources=[];
const escapeHtml=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const addLine=(html='',cls='')=>{const e=document.createElement('div');e.className=`term-line ${cls}`;e.innerHTML=html;terminal.appendChild(e);terminal.scrollTop=terminal.scrollHeight;return e};
const addBlock=html=>{const e=document.createElement('div');e.className='term-block';e.innerHTML=html;terminal.appendChild(e);terminal.scrollTop=terminal.scrollHeight;return e};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const journey=createJourneyMap({container:$('#journeyMap'),journey:JOURNEY,log:addLine,sleep});
const race=createRace({canvas:$('#raceCanvas'),overlay:$('#raceOverlay'),modeEl:$('#raceMode'),clockEl:$('#raceClock'),lapEl:$('#raceLap'),posEl:$('#racePos'),standingsEl:$('#raceStandings'),leaderboardEl:$('#leaderboard'),trackSelect:$('#trackSelect'),log:addLine,onBoard:rows=>{boardState=rows;renderSources()}});
const ai=createAI({addLine,addBlock,escapeHtml,chatWindow:$('#chatWindow'),chatForm:$('#chatForm'),chatInput:$('#chatInput'),contextProvider:()=>publicPageContext(),onSources:s=>{relaySources=s;renderSources()}});

function identity(){
  $('#identityCard').innerHTML=`<div class="portrait-grid"><div class="ascii-portrait">╔══════════╗<br>║ ARMAN.D  ║<br>║ AI / SYS ║<br>╚══════════╝</div><div><b>${PROFILE.name}</b><span>${PROFILE.role}</span><small>${PROFILE.location}</small></div></div><dl><dt>focus</dt><dd>digital twins · CV · MARL · agents</dd><dt>research</dt><dd>GLOBECOM '25 + '26 · patent pending</dd><dt>shell</dt><dd>portfolio-os / public mode</dd></dl>`;
}
function renderViews(){
  $('#experienceView').innerHTML=`<h1 class="doc-title"># Experience</h1>${JOURNEY.slice().reverse().map(e=>`<article class="experience"><div class="experience-year">${e.year}</div><div><h2>${e.title}</h2><div class="experience-place">${e.place}</div><p><b>What I did.</b> ${e.achievement}</p><p><b>What it taught me.</b> ${e.lesson}</p></div></article>`).join('')}`;
  $('#projectsView').innerHTML=`<h1 class="doc-title"># Projects</h1><p class="doc-copy">Selected public work. Click a card or run <b>open &lt;alias&gt;</b>.</p><div class="project-grid">${PROJECTS.map(p=>`<article class="project-card" data-project="${p.alias}"><span>${p.tag}</span><h3>${p.name}</h3><p>${p.desc}</p><code>${p.stack}</code></article>`).join('')}</div>`;
  $$('[data-project]').forEach(e=>e.onclick=()=>openProject(e.dataset.project));
  $('#researchView').innerHTML=`<h1 class="doc-title"># Research</h1>${RESEARCH.map(r=>`<article class="paper"><span>${r.venue}</span><h3>${r.title}</h3><p>${r.org}</p></article>`).join('')}<h2 class="doc-sub">Research directions</h2><p class="doc-copy">Semantic edge-cloud communication · digital twins · computer vision · MARL/MAPF · RF geolocation · reliable multi-agent LLM systems.</p>`;
}
function renderSources(){
  const el=$('#sourceList');if(!el)return;
  const rows=[
    ['PROFILE KB','bundled','portfolio-context.json'],
    ['PAGE STATE','live',activeView.toUpperCase()],
    ['GITHUB','relay','public metadata + targeted README'],
    ['PADDOCK','live',`${boardState.length} public entries`],
    ['LINKEDIN','link only','no scraping'],
    ['PRIVATE ENV','blocked','no shell / secrets / private DOM']
  ];
  el.innerHTML=rows.map(([name,state,detail])=>`<div class="source-row"><span>${name}</span><b class="${state==='live'||state==='bundled'?'ok':''}">${state}</b><small>${detail}</small></div>`).join('');
  const relay=$('#relayState');if(relay)relay.textContent=relaySources.length?`relay returned: ${relaySources.join(' · ')}`:'relay sources appear here after a chat request';
}
function publicPageContext(){
  const i=journey.current?.()??JOURNEY.length-1,e=JOURNEY[i]||null;
  return{
    schema:'portfolio-client-state-v1',
    active_view:activeView,
    active_timeline_event:e?{year:e.year,title:e.title,place:e.place,kind:e.kind}:null,
    race:{state:race.state,track:race.trackName,driver_stack:'trajectory planner + adaptive cruise + NEAT residual'},
    terminal:{cwd:'/home/arman/research',theme:document.body.dataset.theme||'catppuccin'},
    paddock:boardState.slice(0,8).map(x=>({display_name:x.display_name||x.name||'driver',score:Number(x.score)||0})),
    page_capabilities:['experience','projects','career map','NEAT Grand Prix','research','Morpheus public-professional Q&A']
  };
}
function switchTab(name){
  activeView=name;$$('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));$$('[data-view]').forEach(v=>v.classList.toggle('active',v.dataset.view===name));footerMode.textContent=name.toUpperCase();if(name==='journey')journey.resize();if(name==='race'){race.resize();race.load()}if(name==='chat')setTimeout(()=>ai.focus(),50);renderSources();
}
$$('[data-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
function openProject(alias){const p=PROJECTS.find(p=>p.alias===String(alias||'').toLowerCase());if(!p)return addLine(`project not found: ${escapeHtml(alias||'')} // try projects`,'error');addLine(`opening <span class="cyan">${escapeHtml(p.name)}</span>`);window.open(p.url,'_blank','noopener')}
async function scan(){
  addLine('querying public GitHub metadata…','cyan');
  try{const[u,repos]=await Promise.all([fetch('https://api.github.com/users/arman-dogru').then(r=>r.json()),fetch('https://api.github.com/users/arman-dogru/repos?per_page=100&sort=pushed').then(r=>r.json())]),orig=repos.filter(r=>!r.fork&&r.name!=='arman-dogru'),recent=orig.filter(r=>Date.now()-new Date(r.pushed_at)<90*86400000);addBlock(`<b>PUBLIC GITHUB</b><br>repos          ${u.public_repos}<br>followers      ${u.followers}<br>active / 90d   ${recent.length}<br>latest         ${escapeHtml(orig[0]?.name||'n/a')}<br><span class="dim">source: api.github.com</span>`)}catch(e){addLine(`GitHub scan unavailable: ${escapeHtml(e.message)}`,'error')}
}
function showHelp(){addBlock(`<b>COMMAND INDEX</b><br><span class="cyan">whoami</span>               public profile<br><span class="cyan">experience</span>            career notes<br><span class="cyan">journey</span>               animate career map<br><span class="cyan">trace &lt;query&gt;</span>         fly to an event<br><span class="cyan">projects</span>              project registry<br><span class="cyan">open &lt;alias&gt;</span>          open project repo<br><span class="cyan">research</span>              papers + patent<br><span class="cyan">race</span>                  Istanbul Park agent Grand Prix<br><span class="cyan">leaderboard</span>           paddock board<br><span class="cyan">chat [question]</span>       open Morpheus / optionally ask<br><span class="cyan">sources</span>               show agent data boundary<br><span class="cyan">scan</span>                  live public GitHub metadata<br><span class="cyan">theme &lt;name&gt;</span>          switch terminal theme`)}
function showSources(){switchTab('chat');addBlock(`<b>MORPHEUS DATA BOUNDARY</b><br>canonical profile KB      portfolio-context.json<br>public GitHub             live metadata; targeted public README retrieval<br>page / terminal state     active tab, timeline selection, race state, theme<br>scoreboard                public paddock entries<br>LinkedIn                  link only; not scraped<br>private environment       unavailable<br><br><span class="dim">The model gets curated public context, not arbitrary browser or shell access.</span>`)}
function cmd(raw){
  const line=raw.trim();if(!line)return;history.push(line);historyIndex=history.length;addLine(`<span class="cmd-prompt">[arman@dogru:~]$</span> ${escapeHtml(line)}`,'term-command');const [name,...rest]=line.split(/\s+/),arg=rest.join(' '),n=name.toLowerCase();
  if(n==='help')return showHelp();if(n==='whoami')return addBlock(`<b>${PROFILE.name}</b><br>${PROFILE.role}<br>${PROFILE.location}<br><br><span class="cyan">GitHub</span> ${PROFILE.github}<br><span class="cyan">LinkedIn</span> ${PROFILE.linkedin}<br><span class="cyan">Scholar</span> ${PROFILE.scholar}`);if(n==='experience')return switchTab('experience');if(n==='projects')return switchTab('projects');if(n==='journey'){switchTab('journey');return journey.animate()}if(n==='trace'){switchTab('journey');return journey.trace(arg)}if(n==='next'&&document.querySelector('[data-view="journey"]')?.classList.contains('active'))return journey.next();if(n==='prev'&&document.querySelector('[data-view="journey"]')?.classList.contains('active'))return journey.prev();if(n==='research')return switchTab('research');if(n==='race'){switchTab('race');return race.start()}if(n==='leaderboard'){switchTab('race');return race.loadLeaderboard()}if(n==='scan')return scan();if(n==='open')return openProject(arg);if(n==='chat'){switchTab('chat');return arg?ai.chat(arg,{fromTerminal:true}):undefined}if(n==='sources')return showSources();if(n==='connect-chat'){if(!arg)return addLine('usage: connect-chat <url>','yellow');localStorage.setItem('arman.chatEndpoint',arg);return addLine(`chat relay set // ${escapeHtml(arg)}`,'green')}if(n==='theme'){const b=document.querySelector(`[data-set-theme="${arg.toLowerCase()}"]`);if(!b)return addLine('theme not found','error');b.click();return}if(n==='github'){window.open(PROFILE.github,'_blank','noopener');return}if(n==='linkedin'){window.open(PROFILE.linkedin,'_blank','noopener');return}if(n==='scholar'){window.open(PROFILE.scholar,'_blank','noopener');return}if(n==='email'){location.href=PROFILE.email;return}if(n==='date'){addLine(new Date().toString());return}if(n==='pwd'){addLine('/home/arman/research');return}if(n==='env')return addBlock(`<b>PUBLIC CLIENT ENV</b><br>view=${activeView}<br>theme=${document.body.dataset.theme}<br>race=${race.state}<br><span class="dim">No server secrets or private environment variables are exposed.</span>`);if(n==='uname'){addLine('portfolio-os 2026.10 // browser terminal');return}if(n==='sudo'){addLine('nice try.','yellow');return}if(n==='clear'){terminal.innerHTML='';return}return addLine(`unknown command: ${escapeHtml(name)} // try help`,'error');
}
form.addEventListener('submit',e=>{e.preventDefault();const v=input.value;input.value='';cmd(v)});
input.addEventListener('keydown',e=>{if(e.key==='ArrowUp'){e.preventDefault();if(historyIndex>0)input.value=history[--historyIndex]||''}if(e.key==='ArrowDown'){e.preventDefault();if(historyIndex<history.length-1)input.value=history[++historyIndex]||'';else{historyIndex=history.length;input.value=''}}});
addEventListener('keydown',e=>{if(document.querySelector('[data-view="journey"]')?.classList.contains('active')&&!/input|textarea|select/i.test(document.activeElement?.tagName||'')){if(e.key==='ArrowRight')journey.next();if(e.key==='ArrowLeft')journey.prev()}});
$$('[data-set-theme]').forEach(btn=>btn.onclick=()=>{$$('[data-set-theme]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.body.dataset.theme=btn.dataset.setTheme;localStorage.setItem('arman.theme',btn.dataset.setTheme);renderSources()});
$('#initialRaceStart')?.addEventListener('click',()=>race.start());
(function boot(){
  const t=localStorage.getItem('arman.theme');if(t&&document.body.dataset.theme!==t){document.body.dataset.theme=t;document.querySelector(`[data-set-theme="${t}"]`)?.classList.add('active');$$('[data-set-theme]').forEach(b=>{if(b.dataset.setTheme!==t)b.classList.remove('active')})}
  identity();renderViews();renderSources();showHelp();switchTab('experience');race.loadLeaderboard();
  const boots=['mounting public career graph','indexing project registry','loading Istanbul Park driver policy','binding Morpheus context bus','connecting paddock board'];(async()=>{for(const b of boots){addLine(`[boot] ${b.padEnd(42,' ')} OK`,'dim');await sleep(60)}addLine('Type <span class="green">help</span> or use the numbered tabs.','green')})();
  const proc=[['1337','bell-labs-twin -- semantic edge-cloud simulator','1.6G','11.0'],['1024','neat-gp -- planner + residual policy','2.1G','9.5'],['3030','morpheus -- public context retrieval','1.2G','8.6'],['2719','sionna-rt -- cellular digital twin build','3.0G','7.9'],['2048','scene-recon -- multimodal registration','980M','2.6'],['2929','kube-controller -- training jobs','768M','1.7'],['3141','research-index -- publications + profile','412M','1.1'],['4096','arxiv-reader -- keeping up','256M','0.4']];
  $('#processList').innerHTML=proc.map((p,i)=>`<div class="process-row ${i===1?'focus':''}"><span>${p[0]}</span><span>${p[1]}</span><span>${p[2]}</span><span>${p[3]}</span></div>`).join('');
  setInterval(()=>{const d=new Date();$('#localClock').textContent=d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});const cpu=34+Math.floor(Math.random()*22),mem=58+Math.floor(Math.random()*18);$('#cpuVal').textContent=`${cpu}%`;$('#memVal').textContent=`${mem}%`;$('#cpuBar').style.width=`${cpu}%`;$('#memBar').style.width=`${mem}%`},1000);
})();
