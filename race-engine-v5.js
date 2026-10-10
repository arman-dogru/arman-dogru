/*
 * NEAT Grand Prix v5 runtime primitives.
 * No AI-only asphalt clamp or hidden grass force-field. Cars are governed by
 * the same vehicle physics; competence comes from a trajectory planner,
 * adaptive cruise, and a small NEAT residual policy.
 */
export const TRACKS={istanbul:{name:'Intercity Istanbul Park',short:'ISTANBUL PARK',id:'istanbul-park-v4',local:'./race-track-istanbul.json',global:true}};
export const WORLD_W=1400,WORLD_H=840,MARGIN=76;
export const CAR_W=8,CAR_L=16,ROAD_W=CAR_W*5.4,ROAD_HALF=ROAD_W/2,RUNOFF_HALF=ROAD_HALF+CAR_W*3.4;
export const WHEELBASE=12,DT=1/120,MAX_FWD=154,MAX_REV=32,ACCEL=86,BRAKE=205,REV_ACCEL=45;
export const STEER_LOW=.79,STEER_HIGH=.49,TURN_GAIN=.84,STEER_RATE=8.2;
export const GRIP_LOW=10.8,GRIP_HIGH=5.8,STEER_GRIP_DROP=.24;
export const LAPS=3,RACERS=10,VERSION='neat-race-v4',DRIVER_VERSION='neat-driver-v5',GLOBAL_TRACK='istanbul-park-v4';
export const AI_INPUTS=20,AI_BIAS=20,AI_OUT_STEER=21,AI_OUT_PACE=22;
export const CAMERA_ZOOM=1.62;
export const COLORS=['#a6e3a1','#cba6f7','#89dceb','#fab387','#f38ba8','#89b4fa','#f9e2af','#94e2d5','#f5c2e7','#74c7ec'];
export const LANES=[-.62,0,.62];
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const wrap=a=>(a+Math.PI)%(2*Math.PI)-Math.PI;
export const dot=(a,b)=>a.x*b.x+a.y*b.y;
export const cross=(a,b)=>a.x*b.y-a.y*b.x;
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
export const fmt=ms=>{ms=Math.max(0,ms||0);const m=Math.floor(ms/60000),s=Math.floor(ms/1000)%60,z=Math.floor(ms%1000);return`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(z).padStart(3,'0')}`};
export const scoreFor=(ms,pos)=>Math.max(0,Math.round(1_500_000-ms*8+(RACERS-pos)*20_000));
export const apiBase=()=>String(window.ARMAN_CHAT_ENDPOINT||localStorage.getItem('arman.chatEndpoint')||'').replace(/\/?$/,'/');
export const skillFor=r=>.98+clamp((r-72)/(98-72),0,1)*.035;
export function cleanName(v){return String(v||'').normalize('NFKC').replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim()}
export function validateName(v){const n=cleanName(v);if(n.length<2||n.length>18)return{ok:false,error:'Use 2–18 characters.'};if(!/^[\p{L}\p{N} _.-]+$/u.test(n))return{ok:false,error:'Letters, numbers, spaces, _, -, and . only.'};if(!/[\p{L}\p{N}]/u.test(n))return{ok:false,error:'Include a letter or number.'};if(/(.)\1{4,}/u.test(n))return{ok:false,error:'Too many repeated characters.'};if(/https?|www|github|admin|moderator/i.test(n))return{ok:false,error:'Reserved/link-like names are not accepted.'};return{ok:true,name:n}}
export function chaikin(points,it=2){let p=points.slice();for(let k=0;k<it;k++){const out=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];out.push([.75*a[0]+.25*b[0],.75*a[1]+.25*b[1]],[.25*a[0]+.75*b[0],.25*a[1]+.75*b[1]])}p=out}return p}
export function normalizeGeo(coords){const a=coords.slice();if(a.length>1&&Math.hypot(a[0][0]-a.at(-1)[0],a[0][1]-a.at(-1)[1])<1e-8)a.pop();const lon0=a.reduce((s,p)=>s+p[0],0)/a.length,lat0=a.reduce((s,p)=>s+p[1],0)/a.length,c=Math.cos(lat0*Math.PI/180);const xy=a.map(([lon,lat])=>[(lon-lon0)*111320*c,-(lat-lat0)*110540]),xs=xy.map(p=>p[0]),ys=xy.map(p=>p[1]),scale=Math.min((WORLD_W-2*MARGIN)/(Math.max(...xs)-Math.min(...xs)),(WORLD_H-2*MARGIN)/(Math.max(...ys)-Math.min(...ys))),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;return chaikin(xy.map(([x,y])=>[(x-cx)*scale+WORLD_W/2,(y-cy)*scale+WORLD_H/2]),2)}
export function makeTrack(points,meta){const seg=[],cum=[0];for(let i=0;i<points.length;i++){const[x1,y1]=points[i],[x2,y2]=points[(i+1)%points.length],dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy),tx=dx/L,ty=dy/L;seg.push({x1,y1,dx,dy,L,tx,ty,a:Math.atan2(dy,dx)});cum.push(cum.at(-1)+L)}return{points,seg,cum,len:cum.at(-1),meta}}
export function nearest(track,x,y,last=null){const ids=last===null?track.seg.keys():Array.from({length:29},(_,k)=>(last+k-14+track.seg.length)%track.seg.length);let best=null;for(const i of ids){const s=track.seg[i],t=clamp(((x-s.x1)*s.dx+(y-s.y1)*s.dy)/(s.L*s.L),0,1),px=s.x1+t*s.dx,py=s.y1+t*s.dy,ox=x-px,oy=y-py,d2=ox*ox+oy*oy,item={d2,cross:s.tx*oy-s.ty*ox,progress:track.cum[i]+t*s.L,i,heading:s.a,tx:s.tx,ty:s.ty,px,py};if(!best||d2<best.d2)best=item}if(last!==null&&best.d2>(ROAD_W*6)**2)return nearest(track,x,y,null);return best}
export function trackPoint(track,progress){const p=((progress%track.len)+track.len)%track.len;let i=0;while(i<track.seg.length-1&&p>track.cum[i+1])i++;const s=track.seg[i],t=(p-track.cum[i])/s.L;return{x:s.x1+s.dx*t,y:s.y1+s.dy*t,heading:s.a,tx:s.tx,ty:s.ty,i,progress:p}}
export function compile(g){const layers={};for(let i=0;i<=AI_BIAS;i++)layers[i]=0;layers[AI_OUT_STEER]=1;layers[AI_OUT_PACE]=1;for(const[id,l]of Object.entries(g.hidden||{}))layers[+id]=+l;const nodes=Object.entries(layers).map(([id,l])=>[+id,l]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]),incoming=new Map;for(const[a,b,w]of g.connections||[]){if(!incoming.has(b))incoming.set(b,[]);incoming.get(b).push({a,w})}return{...g,nodes,incoming}}
export function activate(g,ins){const v=new Map([[AI_BIAS,1]]);for(let i=0;i<AI_INPUTS;i++)v.set(i,ins[i]||0);for(const[id]of g.nodes){if(v.has(id))continue;let s=0;for(const c of g.incoming.get(id)||[])s+=(v.get(c.a)||0)*c.w;v.set(id,Math.tanh(s))}return[v.get(AI_OUT_STEER)||0,v.get(AI_OUT_PACE)||0]}
export function basis(c){const f={x:Math.cos(c.h),y:Math.sin(c.h)},r={x:-f.y,y:f.x};return{f,r,long:c.vx*f.x+c.vy*f.y,lat:c.vx*r.x+c.vy*r.y}}
export function support(c,n){const{f,r}=basis(c),sx=dot(f,n)>=0?CAR_L/2:-CAR_L/2,sy=dot(r,n)>=0?CAR_W/2:-CAR_W/2;return{x:c.x+f.x*sx+r.x*sy,y:c.y+f.y*sx+r.y*sy}}
export function radius(c,n){const{f,r}=basis(c);return CAR_L/2*Math.abs(dot(f,n))+CAR_W/2*Math.abs(dot(r,n))}
export function impulse(c,j,r){c.vx+=j.x;c.vy+=j.y;c.omega+=cross(r,j)/((CAR_L*CAR_L+CAR_W*CAR_W)/12)}
export function collide(a,b){const ba=basis(a),bb=basis(b),d={x:b.x-a.x,y:b.y-a.y};let overlap=Infinity,N=null;for(let n of[ba.f,ba.r,bb.f,bb.r]){const L=Math.hypot(n.x,n.y);n={x:n.x/L,y:n.y/L};const o=radius(a,n)+radius(b,n)-Math.abs(dot(d,n));if(o<=0)return false;if(o<overlap){overlap=o;N=dot(d,n)<0?{x:-n.x,y:-n.y}:n}}const corr=(overlap+.02)*.505;a.x-=N.x*corr;a.y-=N.y*corr;b.x+=N.x*corr;b.y+=N.y*corr;const pa=support(a,N),pb=support(b,{x:-N.x,y:-N.y}),p={x:(pa.x+pb.x)/2,y:(pa.y+pb.y)/2},rA={x:p.x-a.x,y:p.y-a.y},rB={x:p.x-b.x,y:p.y-b.y},vA={x:a.vx-a.omega*rA.y,y:a.vy+a.omega*rA.x},vB={x:b.vx-b.omega*rB.y,y:b.vy+b.omega*rB.x},rv={x:vB.x-vA.x,y:vB.y-vA.y},vn=dot(rv,N);if(vn<0){const I=(CAR_L*CAR_L+CAR_W*CAR_W)/12,den=2+cross(rA,N)**2/I+cross(rB,N)**2/I,j=-.72*vn/den,J={x:N.x*j,y:N.y*j};impulse(a,{x:-J.x,y:-J.y},rA);impulse(b,J,rB)}a.omega*=.76;b.omega*=.76;return true}
