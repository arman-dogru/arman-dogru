/*
 * NEAT Grand Prix v3
 * Gameplay target: braking and racing-line discipline like Ultimate Racing 2D.
 * Vehicle-dynamics concepts are independently adapted from MIT-licensed
 * topdown-2d-car-engine and vroom. Circuit geometry: bacinger/f1-circuits (MIT).
 */
const TRACKS = {
  istanbul: { name: 'Intercity Istanbul Park', short: 'ISTANBUL PARK', id: 'istanbul-park-v3', local: './race-track-istanbul.json', global: true },
  monza: { name: 'Autodromo Nazionale Monza', short: 'MONZA', id: 'monza-practice-v2', url: 'https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits/it-1922.geojson' },
  spa: { name: 'Circuit de Spa-Francorchamps', short: 'SPA-FRANCORCHAMPS', id: 'spa-practice-v2', url: 'https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits/be-1925.geojson' },
  monaco: { name: 'Circuit de Monaco', short: 'MONACO', id: 'monaco-practice-v2', url: 'https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits/mc-1929.geojson' }
};

const WORLD_W = 1400, WORLD_H = 840, MARGIN = 76;
const CAR_W = 8, CAR_L = 16, ROAD_W = CAR_W * 3.5, ROAD_HALF = ROAD_W / 2;
const RUNOFF_HALF = ROAD_HALF + CAR_W * 4.5;
const WHEELBASE = 12, DT = 1 / 120;
const MAX_FWD = 150, MAX_REV = 36, ACCEL = 82, BRAKE = 190, REV_ACCEL = 52;
const STEER_LOW = .58, STEER_HIGH = .29, TURN_GAIN = .54;
const LAPS = 3, RACERS = 10, VERSION = 'neat-race-v3', GLOBAL_TRACK = 'istanbul-park-v3';
const COLORS = ['#a6e3a1','#cba6f7','#89dceb','#fab387','#f38ba8','#89b4fa','#f9e2af','#94e2d5','#f5c2e7','#74c7ec'];
const LANE_BIAS = [0,-.20,.14,-.08,.22,0,.08,-.16,.18,-.04];
const SKILL = [1,1.02,1,.98,1.04,.97,1.01,.99,1.03,.96];
const clamp = (x,a,b) => Math.max(a, Math.min(b,x));
const wrap = a => (a + Math.PI) % (2 * Math.PI) - Math.PI;
const dot = (a,b) => a.x*b.x + a.y*b.y;
const cross = (a,b) => a.x*b.y - a.y*b.x;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function formatMs(ms) {
  ms = Math.max(0, ms || 0);
  const m = Math.floor(ms/60000), s = Math.floor(ms/1000)%60, z = Math.floor(ms%1000);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(z).padStart(3,'0')}`;
}
function scoreFor(ms,pos) { return Math.max(0, Math.round(1_500_000 - ms*8 + (RACERS-pos)*20_000)); }
function cleanName(v) { return String(v||'').normalize('NFKC').replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim(); }
function validateName(v) {
  const n = cleanName(v);
  if (n.length < 2 || n.length > 18) return {ok:false,error:'Use 2–18 characters.'};
  if (!/^[\p{L}\p{N} _.-]+$/u.test(n)) return {ok:false,error:'Letters, numbers, spaces, _, -, and . only.'};
  if (!/[\p{L}\p{N}]/u.test(n)) return {ok:false,error:'Include a letter or number.'};
  if (/(.)\1{4,}/u.test(n)) return {ok:false,error:'Too many repeated characters.'};
  if (/https?|www|github|admin|moderator/i.test(n)) return {ok:false,error:'Reserved/link-like names are not accepted.'};
  return {ok:true,name:n};
}

function chaikin(points, iterations=2) {
  let p = points.slice();
  for (let k=0;k<iterations;k++) {
    const out=[];
    for (let i=0;i<p.length;i++) {
      const a=p[i], b=p[(i+1)%p.length];
      out.push([.75*a[0]+.25*b[0], .75*a[1]+.25*b[1]], [.25*a[0]+.75*b[0], .25*a[1]+.75*b[1]]);
    }
    p=out;
  }
  return p;
}
function normalizeGeo(coords) {
  const a=coords.slice();
  if (a.length>1 && Math.hypot(a[0][0]-a.at(-1)[0],a[0][1]-a.at(-1)[1])<1e-8) a.pop();
  const lon0=a.reduce((s,p)=>s+p[0],0)/a.length, lat0=a.reduce((s,p)=>s+p[1],0)/a.length;
  const c=Math.cos(lat0*Math.PI/180);
  const xy=a.map(([lon,lat])=>[(lon-lon0)*111320*c,-(lat-lat0)*110540]);
  const xs=xy.map(p=>p[0]), ys=xy.map(p=>p[1]);
  const scale=Math.min((WORLD_W-2*MARGIN)/(Math.max(...xs)-Math.min(...xs)), (WORLD_H-2*MARGIN)/(Math.max(...ys)-Math.min(...ys)));
  const cx=(Math.min(...xs)+Math.max(...xs))/2, cy=(Math.min(...ys)+Math.max(...ys))/2;
  return chaikin(xy.map(([x,y])=>[(x-cx)*scale+WORLD_W/2,(y-cy)*scale+WORLD_H/2]),2);
}
function makeTrack(points,meta) {
  const seg=[],cum=[0];
  for (let i=0;i<points.length;i++) {
    const [x1,y1]=points[i], [x2,y2]=points[(i+1)%points.length];
    const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy),tx=dx/L,ty=dy/L;
    seg.push({x1,y1,dx,dy,L,tx,ty,a:Math.atan2(dy,dx)}); cum.push(cum.at(-1)+L);
  }
  return {points,seg,cum,len:cum.at(-1),meta};
}
function nearest(track,x,y,last=null) {
  const ids=last===null?track.seg.keys():Array.from({length:21},(_,k)=>(last+k-10+track.seg.length)%track.seg.length);
  let best=null;
  for (const i of ids) {
    const s=track.seg[i], t=clamp(((x-s.x1)*s.dx+(y-s.y1)*s.dy)/(s.L*s.L),0,1);
    const px=s.x1+t*s.dx,py=s.y1+t*s.dy,ox=x-px,oy=y-py,d2=ox*ox+oy*oy;
    const item={d2,cross:s.tx*oy-s.ty*ox,progress:track.cum[i]+t*s.L,i,heading:s.a,tx:s.tx,ty:s.ty,px,py};
    if (!best || d2<best.d2) best=item;
  }
  if (last!==null && best.d2>(ROAD_W*5)**2) return nearest(track,x,y,null);
  return best;
}
function trackPoint(track,progress) {
  const p=((progress%track.len)+track.len)%track.len;
  let i=0; while(i<track.seg.length-1 && p>track.cum[i+1]) i++;
  const s=track.seg[i], t=(p-track.cum[i])/s.L;
  return {x:s.x1+s.dx*t,y:s.y1+s.dy*t,heading:s.a,tx:s.tx,ty:s.ty,i,progress:p};
}

function compile(g) {
  const layers={}; for(let i=0;i<13;i++) layers[i]=0; layers[13]=1; layers[14]=1;
  for(const[id,l] of Object.entries(g.hidden||{})) layers[+id]=l;
  const nodes=Object.entries(layers).map(([id,l])=>[+id,l]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  const incoming=new Map;
  for(const[a,b,w] of g.connections){if(!incoming.has(b))incoming.set(b,[]);incoming.get(b).push({a,w});}
  return {...g,nodes,incoming};
}
function activate(g,ins) {
  const v=new Map([[12,1]]); for(let i=0;i<12;i++)v.set(i,ins[i]);
  for(const[id] of g.nodes){if(v.has(id))continue;let s=0;for(const c of g.incoming.get(id)||[])s+=(v.get(c.a)||0)*c.w;v.set(id,Math.tanh(s));}
  return [v.get(13)||0,v.get(14)||0];
}

function bodyBasis(c) {
  const f={x:Math.cos(c.h),y:Math.sin(c.h)}, r={x:-f.y,y:f.x};
  return {f,r,long:c.vx*f.x+c.vy*f.y,lat:c.vx*r.x+c.vy*r.y};
}
function support(c,n) {
  const {f,r}=bodyBasis(c), sx=dot(f,n)>=0?CAR_L/2:-CAR_L/2, sy=dot(r,n)>=0?CAR_W/2:-CAR_W/2;
  return {x:c.x+f.x*sx+r.x*sy,y:c.y+f.y*sx+r.y*sy};
}
function radius(c,n) { const {f,r}=bodyBasis(c); return CAR_L/2*Math.abs(dot(f,n))+CAR_W/2*Math.abs(dot(r,n)); }
function impulse(c,j,r) { c.vx+=j.x;c.vy+=j.y;c.omega+=cross(r,j)/((CAR_L*CAR_L+CAR_W*CAR_W)/12); }
function collide(a,b) {
  const ba=bodyBasis(a),bb=bodyBasis(b),d={x:b.x-a.x,y:b.y-a.y}; let overlap=Infinity,N=null;
  for(let n of [ba.f,ba.r,bb.f,bb.r]){
    const L=Math.hypot(n.x,n.y);n={x:n.x/L,y:n.y/L};const o=radius(a,n)+radius(b,n)-Math.abs(dot(d,n));
    if(o<=0)return false;if(o<overlap){overlap=o;N=dot(d,n)<0?{x:-n.x,y:-n.y}:n;}
  }
  const corr=(overlap+.04)*.51;a.x-=N.x*corr;a.y-=N.y*corr;b.x+=N.x*corr;b.y+=N.y*corr;
  const pa=support(a,N),pb=support(b,{x:-N.x,y:-N.y}),p={x:(pa.x+pb.x)/2,y:(pa.y+pb.y)/2};
  const rA={x:p.x-a.x,y:p.y-a.y},rB={x:p.x-b.x,y:p.y-b.y};
  const vA={x:a.vx-a.omega*rA.y,y:a.vy+a.omega*rA.x},vB={x:b.vx-b.omega*rB.y,y:b.vy+b.omega*rB.x};
  const rv={x:vB.x-vA.x,y:vB.y-vA.y},vn=dot(rv,N);
  if(vn<0){
    const I=(CAR_L*CAR_L+CAR_W*CAR_W)/12,den=2+cross(rA,N)**2/I+cross(rB,N)**2/I,j=-(1.08)*vn/den,J={x:N.x*j,y:N.y*j};
    impulse(a,{x:-J.x,y:-J.y},rA);impulse(b,J,rB);
    const tr={x:rv.x-vn*N.x,y:rv.y-vn*N.y},tl=Math.hypot(tr.x,tr.y);
    if(tl>.001){const t={x:tr.x/tl,y:tr.y/tl},denT=2+cross(rA,t)**2/I+cross(rB,t)**2/I,jt=clamp(-dot(rv,t)/denT,-j*.24,j*.24),F={x:t.x*jt,y:t.y*jt};impulse(a,{x:-F.x,y:-F.y},rA);impulse(b,F,rB);}
  }
  return true;
}

export function createRace({canvas,overlay,modeEl,clockEl,lapEl,posEl,standingsEl,leaderboardEl,trackSelect,log}) {
  const ctx=canvas.getContext('2d'), keys=new Set();
  let track=null,trackKey='istanbul',agents=[],cars=[],state='idle',startAt=0,last=0,acc=0,raf=0,paused=false,board=[],playerName=localStorage.getItem('arman.raceName')||'';

  async function loadAgents(){
    if(agents.length)return;
    const j=await fetch('./neat-champions.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error(`agents HTTP ${r.status}`)));
    agents=j.champions.map(compile);
  }
  async function loadTrack(key='istanbul'){
    trackKey=TRACKS[key]?key:'istanbul'; const meta=TRACKS[trackKey]; modeEl.textContent=`${meta.short} // LOADING`;
    let coords;
    if(meta.local){const j=await fetch(meta.local,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error(`track HTTP ${r.status}`)));coords=j.coordinates;}
    else{const geo=await fetch(meta.url).then(r=>r.ok?r.json():Promise.reject(new Error(`track HTTP ${r.status}`)));coords=geo.features[0].geometry.coordinates;}
    track=makeTrack(normalizeGeo(coords),meta);trackSelect.value=trackKey;modeEl.textContent=`${meta.short} // READY`;await loadLeaderboard();resize();
  }
  async function load(){await Promise.all([loadAgents(),loadTrack(trackKey)]);spawn();draw();}
  function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.floor(r.width*d));canvas.height=Math.max(1,Math.floor(r.height*d));ctx.setTransform(d,0,0,d,0,0);draw();}
  function spawn(){
    cars=[];
    for(let i=0;i<RACERS;i++){
      const slot=i===0?RACERS-1:i-1,row=Math.floor(slot/2),side=slot%2?1:-1,back=row*22,p=trackPoint(track,20-back),left={x:-p.ty,y:p.tx};
      cars.push({name:i?`NEAT-${String(i).padStart(3,'0')}`:'YOU',player:!i,brain:i?agents[(i-1)%agents.length]:null,color:COLORS[i],x:p.x+left.x*side*4.2,y:p.y+left.y*side*4.2,h:p.heading,vx:0,vy:0,omega:0,steerAngle:0,lastProgress:p.progress,totalProgress:-back,seg:p.i,lap:0,finished:false,finishMs:null,skids:[],slip:0,stuck:0,recovery:0,lane:LANE_BIAS[i]||0,skill:SKILL[i]||1});
    }
  }
  async function start(){
    try{if(!track||!agents.length)await load();spawn();state='countdown';paused=false;startAt=performance.now()+3000;last=performance.now();acc=0;overlay.innerHTML='<div class="countdown">3</div>';canvas.focus();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);log?.(`${track.meta.name} // ${RACERS} cars // ${LAPS} laps // 120 Hz physics`,'cyan');}
    catch(e){overlay.innerHTML=`<div class="race-dialog"><h2>RACE BOOT FAILED</h2><p>${esc(e.message)}</p></div>`;}
  }

  function sensors(c,n){
    const b=bodyBasis(c),speed=Math.hypot(c.vx,c.vy),out=[speed/MAX_FWD,clamp(b.long/MAX_FWD,-1,1),clamp(b.lat/(MAX_FWD*.4),-1,1),clamp(n.cross/ROAD_HALF,-1,1)];
    for(const d of [20,55,115]){const p=trackPoint(track,n.progress+d),a=wrap(Math.atan2(p.y-c.y,p.x-c.x)-c.h);out.push(Math.sin(a),Math.cos(a));}
    const p1=trackPoint(track,n.progress+55),p2=trackPoint(track,n.progress+135),cur=wrap(p2.heading-p1.heading);out.push(Math.sin(cur),Math.cos(cur));return out.slice(0,12);
  }
  function baseControl(c,n){
    const speed=Math.hypot(c.vx,c.vy),look=18+.16*speed,p=trackPoint(track,n.progress+look),lanePx=c.lane*ROAD_HALF,left={x:-p.ty,y:p.tx};
    const tx=p.x+left.x*lanePx,ty=p.y+left.y*lanePx,err=wrap(Math.atan2(ty-c.y,tx-c.x)-c.h),crossErr=n.cross-lanePx,corr=-Math.atan2(1.35*crossErr,speed+18);
    const steer=clamp((err+corr)/.34,-1,1),h0=trackPoint(track,n.progress+30).heading,h1=trackPoint(track,n.progress+90).heading,h2=trackPoint(track,n.progress+170).heading;
    const cur=Math.max(Math.abs(wrap(h1-h0)),Math.abs(wrap(h2-h1))),target=Math.max(50,140-74*Math.min(1,cur/1.45)-Math.min(18,Math.abs(err)*18+Math.max(0,Math.abs(crossErr)-ROAD_HALF*.55)*.8));
    return {steer,target};
  }
  function traffic(c){
    const b=bodyBasis(c);let slow=0,avoid=0;
    for(const o of cars){if(o===c)continue;const dx=o.x-c.x,dy=o.y-c.y,a=dx*b.f.x+dy*b.f.y,s=dx*b.r.x+dy*b.r.y;if(a>0&&a<44&&Math.abs(s)<CAR_W*1.9){const w=(44-a)/44;slow=Math.max(slow,w);avoid+=(s>0?-1:1)*w*.20;}}
    return {slow,avoid:clamp(avoid,-.28,.28)};
  }
  function driveFor(speed,target){if(speed<target-5)return Math.min(1,(target-speed)/24+.25);if(speed>target+2)return-Math.min(1,(speed-target)/22+.2);return.10;}
  function control(c,n){
    if(c.player){return {steer:(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),drive:(keys.has('ArrowUp')||keys.has('w'))?1:(keys.has('ArrowDown')||keys.has('s'))?-1:0,handbrake:keys.has(' ')||keys.has('Spacebar')?1:0};}
    const base=baseControl(c,n),[trim,pace]=activate(c.brain,sensors(c,n)),t=traffic(c),speed=Math.hypot(c.vx,c.vy);
    let steer=clamp(base.steer+.22*trim+t.avoid,-1,1),target=clamp(base.target*c.skill*(.92+.14*((pace+1)/2))-t.slow*42,38,145),drive=driveFor(speed,target);
    c.stuck=speed<4?c.stuck+DT:Math.max(0,c.stuck-3*DT);if(c.stuck>1.4&&c.recovery<=0){c.recovery=1;c.stuck=0;}
    if(c.recovery>0){if(c.recovery>.55){steer=0;drive=-1;}else{steer=base.steer;drive=.75;}c.recovery-=DT;}
    return {steer,drive,handbrake:0};
  }

  function updatePhysics(c,steer,drive,handbrake){
    steer=clamp(steer,-1,1);drive=clamp(drive,-1,1);handbrake=clamp(handbrake||0,0,1);
    let b=bodyBasis(c),long=b.long,lat=b.lat;
    if(drive>=0)long+=ACCEL*drive*DT;else if(long>3)long-=BRAKE*(-drive)*DT;else long-=REV_ACCEL*(-drive)*DT;
    if(Math.abs(long)>1e-6){const decel=(4+.0005*long*long)*DT;long=Math.sign(long)*Math.max(0,Math.abs(long)-decel);}
    long=clamp(long,-MAX_REV,MAX_FWD);c.vx=b.f.x*long+b.r.x*lat;c.vy=b.f.y*long+b.r.y*lat;
    const ratio=Math.min(1,Math.abs(long)/MAX_FWD),maxSteer=STEER_LOW*(1-ratio)+STEER_HIGH*ratio,target=steer*maxSteer,rate=4.4;
    c.steerAngle+=clamp(target-c.steerAngle,-rate*DT,rate*DT);
    let targetYaw=Math.abs(long)>2?(long/WHEELBASE)*Math.tan(c.steerAngle)*TURN_GAIN:0;if(handbrake)targetYaw*=1+.22*handbrake;
    c.omega+=(targetYaw-c.omega)*Math.min(1,9*DT);c.omega*=Math.exp(-.55*DT);c.h=wrap(c.h+c.omega*DT);
    b=bodyBasis(c);let long2=b.long,lat2=b.lat;const ratio2=Math.min(1,Math.abs(long2)/MAX_FWD);
    const grip=(9.5*(1-ratio2)+4.6*ratio2)*Math.max(.28,1-.34*Math.abs(steer)*ratio2-.68*handbrake);lat2*=Math.exp(-grip*DT);
    const scrub=(.07*Math.abs(lat2)+1.6*Math.abs(steer)*ratio2+5.5*handbrake*ratio2)*DT;long2=Math.sign(long2||1)*Math.max(0,Math.abs(long2)-scrub);
    c.vx=b.f.x*long2+b.r.x*lat2;c.vy=b.f.y*long2+b.r.y*lat2;c.x+=c.vx*DT;c.y+=c.vy*DT;c.slip=Math.atan2(Math.abs(lat2),Math.abs(long2)+1);
    if(c.slip>.14&&Math.hypot(c.vx,c.vy)>48&&Math.random()<.17)c.skids.push({x:c.x-b.f.x*CAR_L*.35,y:c.y-b.f.y*CAR_L*.35,t:1});
    for(const s of c.skids)s.t-=.008;c.skids=c.skids.filter(s=>s.t>0).slice(-220);
    let n=nearest(track,c.x,c.y,c.seg);c.seg=n.i;const crossTrack=n.cross;
    if(Math.abs(crossTrack)>ROAD_HALF){const factor=Math.exp(-2.7*DT);c.vx*=factor;c.vy*=factor;}
    const left={x:-n.ty,y:n.tx},sg=crossTrack>=0?1:-1,outward={x:left.x*sg,y:left.y*sg},allowed=RUNOFF_HALF-radius(c,outward);
    if(Math.abs(crossTrack)>allowed){
      const pen=Math.abs(crossTrack)-allowed;c.x-=outward.x*(pen+.35);c.y-=outward.y*(pen+.35);const vn=c.vx*outward.x+c.vy*outward.y;
      if(vn>0){c.vx-=outward.x*vn*1.15;c.vy-=outward.y*vn*1.15;}c.vx-=outward.x*5.5;c.vy-=outward.y*5.5;c.omega*=.45;c.steerAngle*=.7;n=nearest(track,c.x,c.y,c.seg);c.seg=n.i;
    }
    return n;
  }
  function updateCar(c){
    let n=nearest(track,c.x,c.y,c.seg);c.seg=n.i;const cmd=control(c,n);n=updatePhysics(c,cmd.steer,cmd.drive,cmd.handbrake);
    let dp=n.progress-c.lastProgress;if(dp<-track.len/2)dp+=track.len;else if(dp>track.len/2)dp-=track.len;
    if(state==='running'&&dp>-45)c.totalProgress+=dp;c.lastProgress=n.progress;c.lap=Math.max(0,Math.floor(c.totalProgress/track.len));
    if(!c.finished&&c.totalProgress>=LAPS*track.len){c.finished=true;c.finishMs=Math.max(1,performance.now()-startAt);if(c.player)finish(c);}
  }
  function step(){if(state!=='running'||paused)return;cars.forEach(updateCar);for(let pass=0;pass<2;pass++)for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++)collide(cars[i],cars[j]);hud();}
  function position(c){return [...cars].sort((a,b)=>(b.finished?1:0)-(a.finished?1:0)||b.totalProgress-a.totalProgress).indexOf(c)+1;}
  function hud(){
    const p=cars[0];if(!p)return;clockEl.textContent=formatMs(state==='running'?performance.now()-startAt:p.finishMs||0);lapEl.textContent=`LAP ${Math.min(LAPS,p.lap+1)}/${LAPS}`;posEl.textContent=`P${position(p)} / ${RACERS}`;
    const pace=Math.round(Math.hypot(p.vx,p.vy)/MAX_FWD*100),drift=p.slip>.14&&Math.hypot(p.vx,p.vy)>48?' // DRIFT':'';modeEl.textContent=`${track.meta.short} // ${pace}% PACE${drift}`;
    standingsEl.innerHTML=[...cars].sort((a,b)=>b.totalProgress-a.totalProgress).map((c,i)=>`<div class="race-standing ${c.player?'me':''}"><span><i style="background:${c.color}"></i>${i+1}. ${esc(c.name)}</span><span>${c.finished?formatMs(c.finishMs):`L${Math.min(LAPS,c.lap+1)}`}</span></div>`).join('');
  }
  function loop(now){const d=Math.min(.05,(now-last)/1000);last=now;if(state==='countdown'){const left=startAt-now;if(left<=0){state='running';overlay.innerHTML='';}else overlay.innerHTML=`<div class="countdown">${Math.ceil(left/1000)}</div>`;}acc+=d;while(acc>=DT){step();acc-=DT;}draw();raf=requestAnimationFrame(loop);}

  function path(){ctx.beginPath();ctx.moveTo(...track.points[0]);for(let i=1;i<track.points.length;i++)ctx.lineTo(...track.points[i]);ctx.closePath();}
  function drawTrack(){
    ctx.save();ctx.lineJoin='round';ctx.lineCap='round';path();ctx.strokeStyle='#111813';ctx.lineWidth=RUNOFF_HALF*2;ctx.stroke();
    path();ctx.strokeStyle='#7b2e34';ctx.lineWidth=ROAD_W+5;ctx.setLineDash([14,14]);ctx.stroke();ctx.lineDashOffset=14;path();ctx.strokeStyle='#e9e4d4';ctx.stroke();ctx.setLineDash([]);ctx.lineDashOffset=0;
    path();ctx.strokeStyle='#1a1d22';ctx.lineWidth=ROAD_W;ctx.stroke();path();ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=1;ctx.stroke();
    const p=trackPoint(track,0),left={x:-p.ty,y:p.tx};for(let i=-2;i<2;i++){ctx.strokeStyle=i%2?'#101010':'#f1f1ed';ctx.lineWidth=CAR_W*.48;ctx.beginPath();ctx.moveTo(p.x+left.x*i*CAR_W*.5,p.y+left.y*i*CAR_W*.5);ctx.lineTo(p.x+left.x*(i+1)*CAR_W*.5,p.y+left.y*(i+1)*CAR_W*.5);ctx.stroke();}ctx.restore();
  }
  function drawCar(c){
    for(const s of c.skids){ctx.fillStyle=`rgba(1,2,3,${s.t*.32})`;ctx.fillRect(s.x-.9,s.y-.9,1.8,1.8);}ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.h);ctx.shadowBlur=c.player?8:5;ctx.shadowColor=c.color;ctx.fillStyle=c.color;
    ctx.fillRect(-CAR_L/2+2,-CAR_W/2,CAR_L-4,CAR_W);ctx.fillRect(-CAR_L/2,-CAR_W/2-1,3,CAR_W+2);ctx.fillRect(CAR_L/2-3,-CAR_W/2-1,3,CAR_W+2);ctx.shadowBlur=0;ctx.fillStyle='#080b10';ctx.fillRect(-2.8,-CAR_W/2+1.3,5.6,CAR_W-2.6);ctx.fillStyle='#dce4ff';ctx.fillRect(CAR_L/2-4,-CAR_W/2+1,1.4,2);ctx.fillRect(CAR_L/2-4,CAR_W/2-3,1.4,2);if(c.player){ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(-CAR_L/2-1,-CAR_W/2-2,CAR_L+2,CAR_W+4);}ctx.restore();
  }
  function draw(){
    const r=canvas.getBoundingClientRect(),cw=r.width,ch=r.height;if(!cw||!ch)return;ctx.clearRect(0,0,cw,ch);ctx.fillStyle='#09110c';ctx.fillRect(0,0,cw,ch);if(!track)return;
    const scale=Math.min((cw-30)/WORLD_W,(ch-28)/WORLD_H),ox=(cw-WORLD_W*scale)/2,oy=(ch-WORLD_H*scale)/2;ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.fillStyle='rgba(110,150,105,.06)';for(let y=20;y<WORLD_H;y+=28)for(let x=(y/28)%2?16:2;x<WORLD_W;x+=32)ctx.fillRect(x,y,2,2);drawTrack();cars.forEach(drawCar);ctx.restore();ctx.fillStyle='rgba(205,214,244,.46)';ctx.font='10px ui-monospace,monospace';ctx.fillText(`${track.meta.name.toUpperCase()} // road 3.5× car width // GP geometry`,16,ch-12);
  }

  function finish(c){
    state='finished';modeEl.textContent=`${track.meta.short} // FINISHED`;const pos=position(c),score=scoreFor(Math.round(c.finishMs),pos),key=`arman.raceBest.${track.meta.id}`,old=+(localStorage.getItem(key)||0),isPB=score>old;localStorage.setItem(key,String(Math.max(old,score)));const global=!!track.meta.global;
    overlay.innerHTML=`<div class="race-dialog"><h2>${pos===1?'YOU BEAT THE GRID.':'FINISH // P'+pos}</h2><p>${esc(track.meta.name)}<br>Time <b>${formatMs(c.finishMs)}</b> · Score <b>${score.toLocaleString()}</b>${isPB?' · NEW PB':''}</p><p>${global?'Global scores are validated by GitHub Actions and published back to the profile.':'Practice track. The published global board uses Istanbul Park.'}</p><div>${global?`<input id="raceName" maxlength="18" placeholder="display name" value="${esc(playerName)}"><button class="primary" id="submitScore">SUBMIT GLOBAL SCORE</button>`:''}<button id="raceAgain">RACE AGAIN</button></div><small id="nameError"></small></div>`;
    document.querySelector('#raceAgain').onclick=start;if(global)document.querySelector('#submitScore').onclick=()=>submit(score,Math.round(c.finishMs),pos);loadLeaderboard();
  }
  function submit(score,ms,pos){
    const v=validateName(document.querySelector('#raceName')?.value||''),err=document.querySelector('#nameError');if(!v.ok){err.textContent=v.error;return;}playerName=v.name;localStorage.setItem('arman.raceName',playerName);
    const body=[`game_version: ${VERSION}`,`track: ${GLOBAL_TRACK}`,`score: ${score}`,`elapsed_ms: ${ms}`,`position: ${pos}`,`display_name: ${playerName}`,'','Generated by the public race client. GitHub Actions recomputes the score and applies private display-name moderation.'].join('\n');
    window.open(`https://github.com/arman-dogru/arman-dogru/issues/new?title=${encodeURIComponent(`[RACE SCORE] ${score}`)}&body=${encodeURIComponent(body)}`,'_blank','noopener');
  }
  async function loadLeaderboard(){
    try{const j=await fetch(`https://raw.githubusercontent.com/arman-dogru/arman-dogru/main/leaderboard.json?t=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(r.status));board=j.entries||[];}catch{board=[];}
    const meta=track?.meta||TRACKS.istanbul,best=+(localStorage.getItem(`arman.raceBest.${meta.id}`)||0);leaderboardEl.innerHTML=`<div class="leaderboard-head">${meta.global?'ISTANBUL // GLOBAL':'PRACTICE // LOCAL'}</div><div class="leaderboard-row"><span>—</span><b>YOUR PB</b><time>${best?best.toLocaleString():'none'}</time></div>`+(meta.global?(board.length?board.slice(0,8).map((e,i)=>`<div class="leaderboard-row"><span>${i+1}</span><b>${esc(e.display_name||e.github)}</b><time>${Number(e.score).toLocaleString()}</time></div>`).join(''):`<div class="leaderboard-row"><span>1</span><b>BE THE FIRST</b><time>—</time></div>`):`<div class="leaderboard-note">Switch to Istanbul Park for the published GitHub leaderboard.</div>`);
  }
  async function setTrack(key){cancelAnimationFrame(raf);state='idle';overlay.innerHTML='<div class="race-dialog"><h2>LOADING CIRCUIT</h2></div>';await loadTrack(key);spawn();overlay.innerHTML='<div class="race-dialog"><h2>READY</h2><p>GP circuit geometry · 3.5-car-wide road · grass/runoff · 120 Hz car physics.</p><button class="primary" id="startRace">START RACE</button></div>';document.querySelector('#startRace').onclick=start;draw();}

  addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d',' '].includes(e.key)){keys.add(e.key);if(document.activeElement===canvas)e.preventDefault();}if((e.key==='r'||e.key==='R')&&document.querySelector('[data-view="race"]')?.classList.contains('active'))start();if((e.key==='p'||e.key==='P')&&state==='running')paused=!paused;});
  addEventListener('keyup',e=>keys.delete(e.key));addEventListener('resize',resize);canvas.addEventListener('pointerdown',()=>canvas.focus());trackSelect?.addEventListener('change',()=>setTrack(trackSelect.value));
  return {load,start,resize,setTrack,loadLeaderboard,get state(){return state;}};
}
