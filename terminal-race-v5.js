import{TRACKS,WORLD_W,WORLD_H,CAR_W,CAR_L,ROAD_W,RUNOFF_HALF,DT,MAX_FWD,LAPS,RACERS,GLOBAL_TRACK,AI_INPUTS,AI_BIAS,CAMERA_ZOOM,COLORS,esc,fmt,scoreFor,validateName,normalizeGeo,makeTrack,trackPoint}from'./race-engine-v5.js';

import {createLeaderboard} from './leaderboard-client.js';
import {createCar,stepSimulation} from './race-sim.js';
import {championRoster} from './race-roster.js';

export function createRace({canvas,overlay,modeEl,clockEl,lapEl,posEl,standingsEl,leaderboardEl,trackSelect,log,onBoard}){
  const ctx=canvas.getContext('2d'),keys=new Set();
  let track=null,trackKey='istanbul',agents=[],cars=[],state='idle',startAt=0,last=0,acc=0,raf=0,paused=false,board=[],playerName=localStorage.getItem('arman.raceName')||'',raceNo=0;
  const camera={x:WORLD_W/2,y:WORLD_H/2,zoom:1};
  const leaderboard=createLeaderboard();
  let loadPromise=null,elapsed=0;

  async function loadAgents(){
    if(agents.length)return;
    const j=await fetch('./neat-champions-v5.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error(`agents HTTP ${r.status}`)));
    if(j.input_count!==AI_INPUTS||j.bias_node!==AI_BIAS)throw new Error('driver/controller schema mismatch');
    const raw=j.drivers||[];
    agents=championRoster(raw,j.race_policy?.champion_name).map((d,i)=>({...d,rating:Number(d.rating||86),generation:Number(d.generation||0),poolIndex:i}));
    if(agents.length<9)throw new Error('race grid requires at least nine trained drivers');
  }
  function pickGrid(){
    const sorted=[...agents].sort((a,b)=>b.rating-a.rating),bands=[[0,1],[2,3],[4,5],[6,8],[9,11],[12,14],[15,17],[18,19],[20,21]];
    return bands.map((band,i)=>{const valid=band.filter(x=>x<sorted.length);return sorted[valid[(raceNo+i)%valid.length]??Math.min(i,sorted.length-1)]}).filter(Boolean).slice(0,9);
  }
  async function loadTrack(key='istanbul'){
    trackKey=TRACKS[key]?key:'istanbul';const meta=TRACKS[trackKey];modeEl.textContent=`${meta.short} // LOADING`;
    const j=await fetch(meta.local,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error(`track HTTP ${r.status}`)));
    track=makeTrack(normalizeGeo(j.coordinates),meta);trackSelect.value=trackKey;modeEl.textContent=`${meta.short} // READY`;await loadLeaderboard();resize();
  }
  async function load(){if(track&&agents.length){resize();return}if(!loadPromise)loadPromise=Promise.all([loadAgents(),loadTrack(trackKey)]).then(()=>{spawn();draw()}).finally(()=>{loadPromise=null});return loadPromise}
  function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.floor(r.width*d));canvas.height=Math.max(1,Math.floor(r.height*d));ctx.setTransform(d,0,0,d,0,0);draw()}
  function spawn(){
    cars=[];const grid=pickGrid();raceNo++;
    for(let i=0;i<RACERS;i++){
      const slot=i===0?RACERS-1:i-1,back=slot*24,d=i?grid[(i-1)%grid.length]:null;
      cars.push(createCar(track,{driver:d,player:!i,progress:26-back,offset:slot%2?12:-12,color:COLORS[i]}));
    }
    const p=cars[0];camera.x=p?.x??WORLD_W/2;camera.y=p?.y??WORLD_H/2;camera.zoom=1;
  }
  async function start(){
    try{
      if(!track||!agents.length)await load();spawn();keys.clear();state='countdown';paused=false;elapsed=0;startAt=performance.now()+3000;last=performance.now();acc=0;overlay.innerHTML='<div class="countdown">3</div>';canvas.focus();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);log?.(`${track.meta.name} // ${RACERS} cars // lights out`,'cyan');
    }catch(e){overlay.innerHTML=`<div class="race-dialog"><h2>RACE BOOT FAILED</h2><p>${esc(e.message)}</p></div>`}
  }

  function step(){
    if(state!=="running"||paused||document.hidden||!document.querySelector('[data-view="race"]')?.classList.contains("active"))return;
    const playerCommand={steer:(keys.has("ArrowRight")||keys.has("d")?1:0)-(keys.has("ArrowLeft")||keys.has("a")?1:0),drive:keys.has("ArrowUp")||keys.has("w")?1:keys.has("ArrowDown")||keys.has("s")?-1:0,handbrake:keys.has(" ")?1:0};
    stepSimulation(track,cars,{elapsed,playerCommand});elapsed+=DT;
    for(const c of cars){if(c.slip>.14&&Math.hypot(c.vx,c.vy)>48&&Math.random()<.14)c.skids.push({x:c.x,y:c.y,t:1});for(const skid of c.skids)skid.t-=.008;c.skids=c.skids.filter(x=>x.t>0).slice(-180)}
    if(cars[0]?.finished)finish(cars[0]);hud();
  }
  function raceOrder(a,b){return (b.finished?1:0)-(a.finished?1:0)||(a.finished&&b.finished?a.finishMs-b.finishMs:b.totalProgress-a.totalProgress)}
  function position(c){return[...cars].sort(raceOrder).indexOf(c)+1}
  function hud(){const p=cars[0];if(!p)return;clockEl.textContent=fmt(state==='running'?elapsed*1000:p.finishMs||0);lapEl.textContent=`LAP ${Math.min(LAPS,p.lap+1)}/${LAPS}`;posEl.textContent=`P${position(p)} / ${RACERS}`;const pace=Math.round(Math.hypot(p.vx,p.vy)/MAX_FWD*100),drift=p.slip>.14&&Math.hypot(p.vx,p.vy)>48?' // DRIFT':'';modeEl.textContent=`${track.meta.short} // ${pace}% PACE${drift}`;standingsEl.innerHTML=[...cars].sort(raceOrder).map((c,i)=>`<div class="race-standing ${c.player?'me':''}"><span><i style="background:${c.color}"></i>${i+1}. ${esc(c.name)}${c.rating?` <small>${c.rating}</small>`:''}</span><span>${c.finished?fmt(c.finishMs):`L${Math.min(LAPS,c.lap+1)}`}</span></div>`).join('')}
  function loop(now){const d=Math.min(.05,(now-last)/1000);last=now;if(state==='countdown'){const left=startAt-now;if(left<=0){state='running';overlay.innerHTML=''}else overlay.innerHTML=`<div class="countdown">${Math.ceil(left/1000)}</div>`}acc+=d;while(acc>=DT){step();acc-=DT}draw();raf=requestAnimationFrame(loop)}

  function path(){ctx.beginPath();ctx.moveTo(...track.points[0]);for(let i=1;i<track.points.length;i++)ctx.lineTo(...track.points[i]);ctx.closePath()}
  function drawTrack(){ctx.save();ctx.lineJoin='round';ctx.lineCap='round';path();ctx.strokeStyle='#111813';ctx.lineWidth=RUNOFF_HALF*2;ctx.stroke();path();ctx.strokeStyle='#7b2e34';ctx.lineWidth=ROAD_W+5;ctx.setLineDash([14,14]);ctx.stroke();ctx.lineDashOffset=14;path();ctx.strokeStyle='#e9e4d4';ctx.stroke();ctx.setLineDash([]);ctx.lineDashOffset=0;path();ctx.strokeStyle='#1a1d22';ctx.lineWidth=ROAD_W;ctx.stroke();path();ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=1;ctx.stroke();const p=trackPoint(track,0),left={x:-p.ty,y:p.tx};for(let i=-2;i<2;i++){ctx.strokeStyle=i%2?'#101010':'#f1f1ed';ctx.lineWidth=CAR_W*.48;ctx.beginPath();ctx.moveTo(p.x+left.x*i*CAR_W*.5,p.y+left.y*i*CAR_W*.5);ctx.lineTo(p.x+left.x*(i+1)*CAR_W*.5,p.y+left.y*(i+1)*CAR_W*.5);ctx.stroke()}ctx.restore()}
  function drawCar(c){for(const s of c.skids){ctx.fillStyle=`rgba(1,2,3,${s.t*.32})`;ctx.fillRect(s.x-.9,s.y-.9,1.8,1.8)}ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.h);ctx.shadowBlur=c.player?8:5;ctx.shadowColor=c.color;ctx.fillStyle=c.color;ctx.fillRect(-CAR_L/2+2,-CAR_W/2,CAR_L-4,CAR_W);ctx.fillRect(-CAR_L/2,-CAR_W/2-1,3,CAR_W+2);ctx.fillRect(CAR_L/2-3,-CAR_W/2-1,3,CAR_W+2);ctx.shadowBlur=0;ctx.fillStyle='#080b10';ctx.fillRect(-2.8,-CAR_W/2+1.3,5.6,CAR_W-2.6);ctx.fillStyle='#dce4ff';ctx.fillRect(CAR_L/2-4,-CAR_W/2+1,1.4,2);ctx.fillRect(CAR_L/2-4,CAR_W/2-3,1.4,2);if(c.player){ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(-CAR_L/2-1,-CAR_W/2-2,CAR_L+2,CAR_W+4)}ctx.restore()}
  function drawMinimap(cw,ch){if(!track||!(state==='running'||state==='countdown'))return;const mw=184,mh=116,mx=cw-mw-14,my=ch-mh-14,s=Math.min((mw-18)/WORLD_W,(mh-20)/WORLD_H),ox=(mw-WORLD_W*s)/2,oy=(mh-WORLD_H*s)/2+3;ctx.save();ctx.translate(mx,my);ctx.fillStyle='rgba(8,10,14,.88)';ctx.fillRect(0,0,mw,mh);ctx.strokeStyle='rgba(137,220,235,.38)';ctx.strokeRect(.5,.5,mw-1,mh-1);ctx.fillStyle='rgba(205,214,244,.72)';ctx.font='9px ui-monospace,monospace';ctx.fillText('ISTANBUL // MINIMAP',8,12);ctx.translate(ox,oy);ctx.scale(s,s);path();ctx.strokeStyle='#5f6674';ctx.lineWidth=ROAD_W*.65;ctx.stroke();path();ctx.strokeStyle='#161a20';ctx.lineWidth=ROAD_W*.38;ctx.stroke();for(const c of cars){ctx.beginPath();ctx.fillStyle=c.player?'#ffffff':c.color;ctx.arc(c.x,c.y,c.player?6:4,0,Math.PI*2);ctx.fill()}ctx.restore()}
  function draw(){const r=canvas.getBoundingClientRect(),cw=r.width,ch=r.height;if(!cw||!ch)return;ctx.clearRect(0,0,cw,ch);ctx.fillStyle='#09110c';ctx.fillRect(0,0,cw,ch);if(!track)return;const fullScale=Math.min((cw-30)/WORLD_W,(ch-28)/WORLD_H),follow=(state==='running'||state==='countdown')&&cars[0],targetZoom=follow?CAMERA_ZOOM:1,targetX=follow?cars[0].x:WORLD_W/2,targetY=follow?cars[0].y:WORLD_H/2;camera.zoom+=(targetZoom-camera.zoom)*.09;camera.x+=(targetX-camera.x)*.12;camera.y+=(targetY-camera.y)*.12;const scale=fullScale*camera.zoom,ox=cw/2-camera.x*scale,oy=ch/2-camera.y*scale;ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.fillStyle='rgba(110,150,105,.06)';for(let y=20;y<WORLD_H;y+=28)for(let x=(y/28)%2?16:2;x<WORLD_W;x+=32)ctx.fillRect(x,y,2,2);drawTrack();cars.forEach(drawCar);ctx.restore();drawMinimap(cw,ch);ctx.fillStyle='rgba(205,214,244,.56)';ctx.font='11px ui-monospace,monospace';ctx.fillText(`${track.meta.name.toUpperCase()} // GRAND PRIX`,16,ch-13)}

  function finish(c){
    state='finished';keys.clear();modeEl.textContent=`${track.meta.short} // FINISHED`;const pos=position(c),ms=Math.round(c.finishMs),score=scoreFor(ms,pos),key=`arman.raceBest.${track.meta.id}`,old=+(localStorage.getItem(key)||0),isPB=score>old;localStorage.setItem(key,String(Math.max(old,score)));
    overlay.innerHTML=`<div class="race-dialog"><h2>${pos===1?'YOU BEAT THE GRID.':'FINISH // P'+pos}</h2><p>${esc(track.meta.name)}<br>Time <b>${fmt(ms)}</b> · Score <b>${score.toLocaleString()}</b>${isPB?' · NEW PB':''}</p><form id="scoreForm"><input id="raceName" aria-label="Display name" maxlength="18" placeholder="display name" value="${esc(playerName)}"><button class="primary" id="submitScore" type="submit">SAVE SCORE</button><button id="raceAgain" type="button">RACE AGAIN</button></form><small id="nameError" role="status"></small></div>`;
    document.querySelector('#raceAgain').onclick=start;document.querySelector('#raceName')?.focus();document.querySelector('#scoreForm').onsubmit=e=>{e.preventDefault();submit(score,ms,pos)};loadLeaderboard();
  }
  async function submit(score,ms,pos){
    const input=document.querySelector('#raceName'),err=document.querySelector('#nameError'),v=validateName(input?.value||'');if(!v.ok){err.textContent=v.error;return}
    playerName=v.name;localStorage.setItem('arman.raceName',playerName);const button=document.querySelector('#submitScore');if(button.disabled)return;button.disabled=true;err.textContent='Saving…';
    const result=await leaderboard.save({display_name:playerName,elapsed_ms:ms,position:pos});
    err.textContent=!result.ok?result.error:result.pending?'Saved on this device. Global board unavailable; retry in paddock.log.':'Saved to the paddock board.';
    button.disabled=result.ok&&!result.pending;renderLeaderboard();
  }
  function renderLeaderboard(){
    board=leaderboard.rows();const best=+(localStorage.getItem(`arman.raceBest.${GLOBAL_TRACK}`)||0);
    leaderboardEl.innerHTML=`<div class="leaderboard-row"><span>—</span><b>YOUR PB</b><time>${best?best.toLocaleString():'none'}</time></div>`+(board.length?board.slice(0,10).map((e,i)=>`<div class="leaderboard-row"><span>${i+1}</span><b>${esc(e.display_name)}${e.pending?'<em>LOCAL</em>':''}</b><time>${Number(e.score).toLocaleString()}</time></div>`).join(''):'<div class="leaderboard-note">Finish a race to seed the paddock board.</div>')+(leaderboard.status==='offline'?`<div class="board-status">Board offline. ${leaderboard.pending?'Your result is saved on this device.':''}<button id="retryBoard">RETRY</button></div>`:'');
    document.querySelector('#retryBoard')?.addEventListener('click',async()=>{await leaderboard.retry();await loadLeaderboard()});onBoard?.(board.filter(x=>!x.pending).slice(0,10));
  }
  async function loadLeaderboard(){
    await leaderboard.load();renderLeaderboard();return board;
  }
  async function setTrack(key){cancelAnimationFrame(raf);state='idle';overlay.innerHTML='<div class="race-dialog"><h2>LOADING CIRCUIT</h2></div>';await loadTrack(key);spawn();overlay.innerHTML='<div class="race-dialog"><h2>READY</h2><p>Istanbul Park. Ten cars. Three laps.</p><button class="primary" id="startRace">START RACE</button></div>';document.querySelector('#startRace').onclick=start;draw()}

  addEventListener('keydown',e=>{const t=e.target,editing=t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement||t instanceof HTMLSelectElement||t?.isContentEditable;if(editing)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d',' '].includes(e.key)){keys.add(e.key);if(document.activeElement===canvas)e.preventDefault()}const raceActive=document.querySelector('[data-view="race"]')?.classList.contains('active');if((e.key==='r'||e.key==='R')&&raceActive)start();if((e.key==='p'||e.key==='P')&&state==='running'&&raceActive)paused=!paused});
  addEventListener('keyup',e=>keys.delete(e.key));addEventListener('blur',()=>keys.clear());addEventListener('resize',resize);canvas.addEventListener('pointerdown',()=>canvas.focus());trackSelect?.addEventListener('change',()=>setTrack(trackSelect.value));
  return{load,start,resize,setTrack,loadLeaderboard,getBoard:()=>board.slice(),get state(){return state},get trackName(){return track?.meta?.name||'Istanbul Park'}};
}
