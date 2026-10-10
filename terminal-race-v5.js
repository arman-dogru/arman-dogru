import{TRACKS,WORLD_W,WORLD_H,CAR_W,CAR_L,ROAD_W,ROAD_HALF,RUNOFF_HALF,WHEELBASE,DT,MAX_FWD,MAX_REV,ACCEL,BRAKE,REV_ACCEL,STEER_LOW,STEER_HIGH,TURN_GAIN,STEER_RATE,GRIP_LOW,GRIP_HIGH,STEER_GRIP_DROP,LAPS,RACERS,VERSION,DRIVER_VERSION,GLOBAL_TRACK,AI_INPUTS,AI_BIAS,CAMERA_ZOOM,COLORS,LANES,clamp,wrap,esc,fmt,scoreFor,apiBase,skillFor,validateName,normalizeGeo,makeTrack,nearest,trackPoint,compile,activate,basis,radius,collide}from'./race-engine-v5.js';

export function createRace({canvas,overlay,modeEl,clockEl,lapEl,posEl,standingsEl,leaderboardEl,trackSelect,log,onBoard}){
  const ctx=canvas.getContext('2d'),keys=new Set();
  let track=null,trackKey='istanbul',agents=[],cars=[],state='idle',startAt=0,last=0,acc=0,raf=0,paused=false,board=[],playerName=localStorage.getItem('arman.raceName')||'',raceNo=0;
  const camera={x:WORLD_W/2,y:WORLD_H/2,zoom:1};

  async function loadAgents(){
    if(agents.length)return;
    const j=await fetch('./neat-champions-v5.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error(`agents HTTP ${r.status}`)));
    if(j.input_count!==AI_INPUTS||j.bias_node!==AI_BIAS)throw new Error('driver/controller schema mismatch');
    const raw=j.drivers||[];
    agents=raw.map((d,i)=>({...d,rating:Number(d.rating||86),generation:Number(d.generation||0),net:compile(d),poolIndex:i}));
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
  async function load(){await Promise.all([loadAgents(),loadTrack(trackKey)]);spawn();draw()}
  function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.floor(r.width*d));canvas.height=Math.max(1,Math.floor(r.height*d));ctx.setTransform(d,0,0,d,0,0);draw()}
  function spawn(){
    cars=[];const grid=pickGrid();raceNo++;
    for(let i=0;i<RACERS;i++){
      const slot=i===0?RACERS-1:i-1,row=Math.floor(slot/2),laneIndex=slot%LANES.length,back=row*42,p=trackPoint(track,26-back),left={x:-p.ty,y:p.tx},lane=LANES[laneIndex],off=lane*ROAD_HALF*.88,d=i?grid[(i-1)%grid.length]:null;
      cars.push({name:d?.name||'YOU',rating:d?.rating||null,generation:d?.generation||null,player:!i,brain:d?.net||null,color:COLORS[i],x:p.x+left.x*off,y:p.y+left.y*off,h:p.heading,vx:0,vy:0,omega:0,steerAngle:0,lastProgress:p.progress,totalProgress:-back,seg:p.i,lap:0,finished:false,finishMs:null,skids:[],slip:0,laneIndex,lane,skill:d?skillFor(d.rating):1,near:null,contacts:0});
    }
    const p=cars[0];camera.x=p?.x??WORLD_W/2;camera.y=p?.y??WORLD_H/2;camera.zoom=1;
  }
  async function start(){
    try{
      if(!track||!agents.length)await load();spawn();keys.clear();state='countdown';paused=false;startAt=performance.now()+3000;last=performance.now();acc=0;overlay.innerHTML='<div class="countdown">3</div>';canvas.focus();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);log?.(`${track.meta.name} // ${RACERS} cars // planner + NEAT residual grid`,'cyan');
    }catch(e){overlay.innerHTML=`<div class="race-dialog"><h2>RACE BOOT FAILED</h2><p>${esc(e.message)}</p></div>`}
  }

  function progressGap(a,b){return((b.lastProgress-a.lastProgress)%track.len+track.len)%track.len}
  function trafficFeatures(c){
    const b=basis(c);let frontA=Infinity,frontS=0,closing=0,leftPressure=0,rightPressure=0,rear=0;
    for(const o of cars){if(o===c)continue;const dx=o.x-c.x,dy=o.y-c.y,a=dx*b.f.x+dy*b.f.y,s=dx*b.r.x+dy*b.r.y;if(a>0&&a<96&&Math.abs(s)<ROAD_HALF*1.1&&a<frontA){frontA=a;frontS=s;closing=b.long-basis(o).long}if(a>-24&&a<36&&Math.abs(s)<CAR_W*3.1){const w=Math.max(0,1-Math.abs(a)/36)*Math.max(0,1-Math.abs(s)/(CAR_W*3.1));if(s<0)leftPressure=Math.max(leftPressure,w);else rightPressure=Math.max(rightPressure,w)}if(a<0&&a>-55&&Math.abs(s)<CAR_W*2.4)rear=Math.max(rear,Math.max(0,1-(-a)/55))}
    return[Number.isFinite(frontA)?clamp(1-frontA/96,0,1):0,Number.isFinite(frontA)?clamp(frontS/(ROAD_HALF*1.1),-1,1):0,Number.isFinite(frontA)?clamp(closing/MAX_FWD,-1,1):0,leftPressure,rightPressure,rear];
  }
  function sensors(c,n){
    const b=basis(c),speed=Math.hypot(c.vx,c.vy),out=[speed/MAX_FWD,clamp(b.long/MAX_FWD,-1,1),clamp(b.lat/(MAX_FWD*.35),-1,1),clamp(n.cross/ROAD_HALF,-1.3,1.3)];
    for(const d of[18,42,82,142]){const p=trackPoint(track,n.progress+d),a=wrap(Math.atan2(p.y-c.y,p.x-c.x)-c.h);out.push(Math.sin(a),Math.cos(a))}
    const h0=trackPoint(track,n.progress+35).heading,h1=trackPoint(track,n.progress+90).heading,h2=trackPoint(track,n.progress+165).heading;out.push(Math.sin(wrap(h1-h0)),Math.sin(wrap(h2-h1)),...trafficFeatures(c));return out.slice(0,AI_INPUTS);
  }
  const driveFor=(speed,target)=>speed<target-3?Math.min(1,.30+(target-speed)/22):speed>target+1?-Math.min(1,.45+(speed-target)/11):.08;
  function aiControl(c,n){
    const x=sensors(c,n),[trim,pace]=activate(c.brain,x),speed=Math.hypot(c.vx,c.vy),hs=[24,58,105,165,220].map(d=>trackPoint(track,n.progress+d).heading),curv=Math.max(...hs.slice(0,-1).map((h,i)=>Math.abs(wrap(hs[i+1]-h)))),curve=clamp(curv/1.22,0,1);
    const targetLane=LANES[c.laneIndex]*(1-.48*curve);c.lane+=clamp(targetLane-c.lane,-.8*DT,.8*DT);
    const p=trackPoint(track,n.progress+20+.16*speed),left={x:-p.ty,y:p.tx},lanePx=c.lane*ROAD_HALF*.88,tx=p.x+left.x*lanePx,ty=p.y+left.y*lanePx,err=wrap(Math.atan2(ty-c.y,tx-c.x)-c.h),crossErr=n.cross-lanePx,corr=-Math.atan2(2*crossErr,speed+18);
    let steer=clamp((err+corr)/.35+.055*trim,-1,1),target=142-94*curve-Math.min(25,Math.abs(err)*24+Math.max(0,Math.abs(crossErr)-ROAD_HALF*.60)*.7);target=clamp(target,44,142)*c.skill*(.985+.03*((pace+1)/2));
    let front=null,best=Infinity;for(const o of cars){if(o===c||o.laneIndex!==c.laneIndex)continue;const gap=progressGap(c,o);if(gap>1&&gap<track.len/2&&gap<best){front=o;best=gap}}
    if(front){const fv=Math.max(0,basis(front).long),safe=CAR_L+26+speed*.78,rel=Math.max(0,speed-fv),ttc=rel>0?best/Math.max(1,rel):99;if(best<safe*2.8)target=Math.min(target,Math.max(6,fv+(best-safe)*.78));if(best<safe||ttc<1.55)target=Math.min(target,Math.max(0,fv-(safe-best)*2))}
    for(const o of cars){if(o===c||!o.near)continue;const gap=((o.near.progress-n.progress)%track.len+track.len)%track.len;if(gap>0&&gap<70&&Math.abs(o.near.cross-n.cross)<CAR_W*1.55){const ov=Math.max(0,basis(o).long),safe2=CAR_L+22+speed*.48;target=Math.min(target,Math.max(0,ov+(gap-safe2)*.65));if(gap<safe2*.78)target=Math.min(target,Math.max(0,ov-18))}}
    return{steer,drive:driveFor(speed,target),handbrake:0};
  }
  function control(c,n){if(!c.player)return aiControl(c,n);return{steer:(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),drive:(keys.has('ArrowUp')||keys.has('w'))?1:(keys.has('ArrowDown')||keys.has('s'))?-1:0,handbrake:keys.has(' ')||keys.has('Spacebar')?1:0}}

  function updatePhysics(c,steer,drive,handbrake=0){
    steer=clamp(steer,-1,1);drive=clamp(drive,-1,1);handbrake=clamp(handbrake,0,1);let b=basis(c),long=b.long,lat=b.lat;
    if(drive>=0)long+=ACCEL*drive*DT;else if(long>3)long-=BRAKE*(-drive)*DT;else long-=REV_ACCEL*(-drive)*DT;
    if(Math.abs(long)>1e-6){const decel=(3.8+.00042*long*long)*DT;long=Math.sign(long)*Math.max(0,Math.abs(long)-decel)}long=clamp(long,-MAX_REV,MAX_FWD);c.vx=b.f.x*long+b.r.x*lat;c.vy=b.f.y*long+b.r.y*lat;
    const ratio=Math.min(1,Math.abs(long)/MAX_FWD),maxSteer=STEER_LOW*(1-ratio)+STEER_HIGH*ratio,target=steer*maxSteer;c.steerAngle+=clamp(target-c.steerAngle,-STEER_RATE*DT,STEER_RATE*DT);let targetYaw=Math.abs(long)>2?(long/WHEELBASE)*Math.tan(c.steerAngle)*TURN_GAIN:0;if(handbrake)targetYaw*=1+.22*handbrake;c.omega+=(targetYaw-c.omega)*Math.min(1,10*DT);c.omega*=Math.exp(-.48*DT);c.h=wrap(c.h+c.omega*DT);
    b=basis(c);let long2=b.long,lat2=b.lat;const ratio2=Math.min(1,Math.abs(long2)/MAX_FWD),grip=(GRIP_LOW*(1-ratio2)+GRIP_HIGH*(ratio2))*Math.max(.35,1-STEER_GRIP_DROP*Math.abs(steer)*ratio2-.68*handbrake);lat2*=Math.exp(-grip*DT);const scrub=(.05*Math.abs(lat2)+1.15*Math.abs(steer)*ratio2+5.5*handbrake*ratio2)*DT;long2=Math.sign(long2||1)*Math.max(0,Math.abs(long2)-scrub);c.vx=b.f.x*long2+b.r.x*lat2;c.vy=b.f.y*long2+b.r.y*lat2;c.x+=c.vx*DT;c.y+=c.vy*DT;c.slip=Math.atan2(Math.abs(lat2),Math.abs(long2)+1);
    if(c.slip>.14&&Math.hypot(c.vx,c.vy)>48&&Math.random()<.14)c.skids.push({x:c.x-b.f.x*CAR_L*.35,y:c.y-b.f.y*CAR_L*.35,t:1});for(const s of c.skids)s.t-=.008;c.skids=c.skids.filter(s=>s.t>0).slice(-180);
    let n=nearest(track,c.x,c.y,c.seg);c.seg=n.i;const crossTrack=n.cross;
    if(Math.abs(crossTrack)>ROAD_HALF){const factor=Math.exp(-2.2*DT);c.vx*=factor;c.vy*=factor}
    const left={x:-n.ty,y:n.tx},sg=crossTrack>=0?1:-1,outward={x:left.x*sg,y:left.y*sg},allowed=RUNOFF_HALF-radius(c,outward);
    if(Math.abs(crossTrack)>allowed){const pen=Math.abs(crossTrack)-allowed;c.x-=outward.x*(pen+.08);c.y-=outward.y*(pen+.08);const vn=c.vx*outward.x+c.vy*outward.y;if(vn>0){c.vx-=outward.x*vn*1.15;c.vy-=outward.y*vn*1.15}c.vx*=.75;c.vy*=.75;c.omega*=.45;n=nearest(track,c.x,c.y,c.seg);c.seg=n.i}
    return n;
  }
  function updateCar(c){let n=c.near||nearest(track,c.x,c.y,c.seg);c.seg=n.i;const cmd=control(c,n);n=updatePhysics(c,cmd.steer,cmd.drive,cmd.handbrake);let dp=n.progress-c.lastProgress;if(dp<-track.len/2)dp+=track.len;else if(dp>track.len/2)dp-=track.len;if(state==='running'&&dp>-55)c.totalProgress+=dp;c.lastProgress=n.progress;c.lap=Math.max(0,Math.floor(c.totalProgress/track.len));if(!c.finished&&c.totalProgress>=LAPS*track.len){c.finished=true;c.finishMs=Math.max(1,performance.now()-startAt);if(c.player)finish(c)}}
  function step(){if(state!=='running'||paused)return;for(const c of cars)c.near=nearest(track,c.x,c.y,c.seg);cars.forEach(updateCar);for(let pass=0;pass<2;pass++)for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++)if(collide(cars[i],cars[j])){cars[i].contacts++;cars[j].contacts++}hud()}
  function position(c){return[...cars].sort((a,b)=>(b.finished?1:0)-(a.finished?1:0)||b.totalProgress-a.totalProgress).indexOf(c)+1}
  function hud(){const p=cars[0];if(!p)return;clockEl.textContent=fmt(state==='running'?performance.now()-startAt:p.finishMs||0);lapEl.textContent=`LAP ${Math.min(LAPS,p.lap+1)}/${LAPS}`;posEl.textContent=`P${position(p)} / ${RACERS}`;const pace=Math.round(Math.hypot(p.vx,p.vy)/MAX_FWD*100),drift=p.slip>.14&&Math.hypot(p.vx,p.vy)>48?' // DRIFT':'';modeEl.textContent=`${track.meta.short} // ${pace}% PACE${drift}`;standingsEl.innerHTML=[...cars].sort((a,b)=>b.totalProgress-a.totalProgress).map((c,i)=>`<div class="race-standing ${c.player?'me':''}"><span><i style="background:${c.color}"></i>${i+1}. ${esc(c.name)}${c.rating?` <small>${c.rating}</small>`:''}</span><span>${c.finished?fmt(c.finishMs):`L${Math.min(LAPS,c.lap+1)}`}</span></div>`).join('')}
  function loop(now){const d=Math.min(.05,(now-last)/1000);last=now;if(state==='countdown'){const left=startAt-now;if(left<=0){state='running';overlay.innerHTML=''}else overlay.innerHTML=`<div class="countdown">${Math.ceil(left/1000)}</div>`}acc+=d;while(acc>=DT){step();acc-=DT}draw();raf=requestAnimationFrame(loop)}

  function path(){ctx.beginPath();ctx.moveTo(...track.points[0]);for(let i=1;i<track.points.length;i++)ctx.lineTo(...track.points[i]);ctx.closePath()}
  function drawTrack(){ctx.save();ctx.lineJoin='round';ctx.lineCap='round';path();ctx.strokeStyle='#111813';ctx.lineWidth=RUNOFF_HALF*2;ctx.stroke();path();ctx.strokeStyle='#7b2e34';ctx.lineWidth=ROAD_W+5;ctx.setLineDash([14,14]);ctx.stroke();ctx.lineDashOffset=14;path();ctx.strokeStyle='#e9e4d4';ctx.stroke();ctx.setLineDash([]);ctx.lineDashOffset=0;path();ctx.strokeStyle='#1a1d22';ctx.lineWidth=ROAD_W;ctx.stroke();path();ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=1;ctx.stroke();const p=trackPoint(track,0),left={x:-p.ty,y:p.tx};for(let i=-2;i<2;i++){ctx.strokeStyle=i%2?'#101010':'#f1f1ed';ctx.lineWidth=CAR_W*.48;ctx.beginPath();ctx.moveTo(p.x+left.x*i*CAR_W*.5,p.y+left.y*i*CAR_W*.5);ctx.lineTo(p.x+left.x*(i+1)*CAR_W*.5,p.y+left.y*(i+1)*CAR_W*.5);ctx.stroke()}ctx.restore()}
  function drawCar(c){for(const s of c.skids){ctx.fillStyle=`rgba(1,2,3,${s.t*.32})`;ctx.fillRect(s.x-.9,s.y-.9,1.8,1.8)}ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.h);ctx.shadowBlur=c.player?8:5;ctx.shadowColor=c.color;ctx.fillStyle=c.color;ctx.fillRect(-CAR_L/2+2,-CAR_W/2,CAR_L-4,CAR_W);ctx.fillRect(-CAR_L/2,-CAR_W/2-1,3,CAR_W+2);ctx.fillRect(CAR_L/2-3,-CAR_W/2-1,3,CAR_W+2);ctx.shadowBlur=0;ctx.fillStyle='#080b10';ctx.fillRect(-2.8,-CAR_W/2+1.3,5.6,CAR_W-2.6);ctx.fillStyle='#dce4ff';ctx.fillRect(CAR_L/2-4,-CAR_W/2+1,1.4,2);ctx.fillRect(CAR_L/2-4,CAR_W/2-3,1.4,2);if(c.player){ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(-CAR_L/2-1,-CAR_W/2-2,CAR_L+2,CAR_W+4)}ctx.restore()}
  function drawMinimap(cw,ch){if(!track||!(state==='running'||state==='countdown'))return;const mw=184,mh=116,mx=cw-mw-14,my=ch-mh-14,s=Math.min((mw-18)/WORLD_W,(mh-20)/WORLD_H),ox=(mw-WORLD_W*s)/2,oy=(mh-WORLD_H*s)/2+3;ctx.save();ctx.translate(mx,my);ctx.fillStyle='rgba(8,10,14,.88)';ctx.fillRect(0,0,mw,mh);ctx.strokeStyle='rgba(137,220,235,.38)';ctx.strokeRect(.5,.5,mw-1,mh-1);ctx.fillStyle='rgba(205,214,244,.72)';ctx.font='9px ui-monospace,monospace';ctx.fillText('ISTANBUL // MINIMAP',8,12);ctx.translate(ox,oy);ctx.scale(s,s);path();ctx.strokeStyle='#5f6674';ctx.lineWidth=ROAD_W*.65;ctx.stroke();path();ctx.strokeStyle='#161a20';ctx.lineWidth=ROAD_W*.38;ctx.stroke();for(const c of cars){ctx.beginPath();ctx.fillStyle=c.player?'#ffffff':c.color;ctx.arc(c.x,c.y,c.player?6:4,0,Math.PI*2);ctx.fill()}ctx.restore()}
  function draw(){const r=canvas.getBoundingClientRect(),cw=r.width,ch=r.height;if(!cw||!ch)return;ctx.clearRect(0,0,cw,ch);ctx.fillStyle='#09110c';ctx.fillRect(0,0,cw,ch);if(!track)return;const fullScale=Math.min((cw-30)/WORLD_W,(ch-28)/WORLD_H),follow=(state==='running'||state==='countdown')&&cars[0],targetZoom=follow?CAMERA_ZOOM:1,targetX=follow?cars[0].x:WORLD_W/2,targetY=follow?cars[0].y:WORLD_H/2;camera.zoom+=(targetZoom-camera.zoom)*.09;camera.x+=(targetX-camera.x)*.12;camera.y+=(targetY-camera.y)*.12;const scale=fullScale*camera.zoom,ox=cw/2-camera.x*scale,oy=ch/2-camera.y*scale;ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.fillStyle='rgba(110,150,105,.06)';for(let y=20;y<WORLD_H;y+=28)for(let x=(y/28)%2?16:2;x<WORLD_W;x+=32)ctx.fillRect(x,y,2,2);drawTrack();cars.forEach(drawCar);ctx.restore();drawMinimap(cw,ch);ctx.fillStyle='rgba(205,214,244,.56)';ctx.font='11px ui-monospace,monospace';ctx.fillText(`${track.meta.name.toUpperCase()} // ${DRIVER_VERSION} // no asphalt force-field`,16,ch-13)}

  function localRows(){try{return JSON.parse(localStorage.getItem('arman.raceResults.v4')||'[]')}catch{return[]}}
  function saveLocal(row){const rows=localRows().filter(x=>x&&Number.isFinite(+x.score));rows.push(row);rows.sort((a,b)=>b.score-a.score||a.elapsed_ms-b.elapsed_ms);localStorage.setItem('arman.raceResults.v4',JSON.stringify(rows.slice(0,12)))}
  function finish(c){
    state='finished';keys.clear();modeEl.textContent=`${track.meta.short} // FINISHED`;const pos=position(c),ms=Math.round(c.finishMs),score=scoreFor(ms,pos),key=`arman.raceBest.${track.meta.id}`,old=+(localStorage.getItem(key)||0),isPB=score>old;localStorage.setItem(key,String(Math.max(old,score)));
    overlay.innerHTML=`<div class="race-dialog"><h2>${pos===1?'YOU BEAT THE GRID.':'FINISH // P'+pos}</h2><p>${esc(track.meta.name)}<br>Time <b>${fmt(ms)}</b> · Score <b>${score.toLocaleString()}</b>${isPB?' · NEW PB':''}</p><p>Save the result directly to the paddock board.</p><div><input id="raceName" maxlength="18" placeholder="display name" value="${esc(playerName)}"><button class="primary" id="submitScore">SAVE SCORE</button><button id="raceAgain">RACE AGAIN</button></div><small id="nameError"></small></div>`;
    document.querySelector('#raceAgain').onclick=start;document.querySelector('#raceName')?.focus();document.querySelector('#submitScore').onclick=()=>submit(score,ms,pos);loadLeaderboard();
  }
  async function submit(score,ms,pos){
    const input=document.querySelector('#raceName'),err=document.querySelector('#nameError'),v=validateName(input?.value||'');if(!v.ok){err.textContent=v.error;return}
    playerName=v.name;localStorage.setItem('arman.raceName',playerName);const payload={game_version:VERSION,track:GLOBAL_TRACK,score,elapsed_ms:ms,position:pos,display_name:playerName};const base=apiBase();if(!base){saveLocal({...payload,stamp:Date.now()});err.textContent='Saved locally. Global board is offline.';loadLeaderboard();return}err.textContent='Saving…';
    try{const res=await fetch(new URL('leaderboard',base),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);err.textContent='Saved to the global paddock board.';await loadLeaderboard()}catch(e){saveLocal({...payload,stamp:Date.now()});err.textContent=`Global board unavailable; saved locally (${e.message}).`;await loadLeaderboard()}
  }
  async function loadLeaderboard(){
    const base=apiBase();board=[];if(base){try{const res=await fetch(new URL('leaderboard',base),{cache:'no-store'}),j=await res.json();if(res.ok)board=j.entries||[]}catch{}}
    if(!board.length)board=localRows();const best=+(localStorage.getItem(`arman.raceBest.${GLOBAL_TRACK}`)||0);leaderboardEl.innerHTML=`<div class="leaderboard-row"><span>—</span><b>YOUR PB</b><time>${best?best.toLocaleString():'none'}</time></div>`+(board.length?board.slice(0,10).map((e,i)=>`<div class="leaderboard-row"><span>${i+1}</span><b>${esc(e.display_name||e.name||'driver')}</b><time>${Number(e.score).toLocaleString()}</time></div>`).join(''):`<div class="leaderboard-note">Finish a race to seed the paddock board.</div>`);onBoard?.(board.slice(0,10));return board;
  }
  async function setTrack(key){cancelAnimationFrame(raf);state='idle';overlay.innerHTML='<div class="race-dialog"><h2>LOADING CIRCUIT</h2></div>';await loadTrack(key);spawn();overlay.innerHTML='<div class="race-dialog"><h2>READY</h2><p>Istanbul Park · shared vehicle physics · trajectory planning + adaptive cruise + NEAT residual policy · no hidden asphalt correction.</p><button class="primary" id="startRace">START RACE</button></div>';document.querySelector('#startRace').onclick=start;draw()}

  addEventListener('keydown',e=>{const t=e.target,editing=t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement||t instanceof HTMLSelectElement||t?.isContentEditable;if(editing)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d',' '].includes(e.key)){keys.add(e.key);if(document.activeElement===canvas)e.preventDefault()}const raceActive=document.querySelector('[data-view="race"]')?.classList.contains('active');if((e.key==='r'||e.key==='R')&&raceActive)start();if((e.key==='p'||e.key==='P')&&state==='running'&&raceActive)paused=!paused});
  addEventListener('keyup',e=>{const t=e.target,editing=t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement||t instanceof HTMLSelectElement||t?.isContentEditable;if(!editing)keys.delete(e.key)});addEventListener('blur',()=>keys.clear());addEventListener('resize',resize);canvas.addEventListener('pointerdown',()=>canvas.focus());trackSelect?.addEventListener('change',()=>setTrack(trackSelect.value));
  return{load,start,resize,setTrack,loadLeaderboard,getBoard:()=>board.slice(),get state(){return state},get trackName(){return track?.meta?.name||'Istanbul Park'}};
}
