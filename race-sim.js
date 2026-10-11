import {CAR_W,CAR_L,ROAD_HALF,RUNOFF_HALF,WHEELBASE,DT,MAX_FWD,MAX_REV,ACCEL,BRAKE,REV_ACCEL,STEER_LOW,STEER_HIGH,TURN_GAIN,STEER_RATE,GRIP_LOW,GRIP_HIGH,STEER_GRIP_DROP,LAPS,clamp,wrap,nearest,trackPoint,basis,radius,collide,activate,compile} from './race-engine-v5.js';

// Browser, training and validation all call this exact physics implementation.
// The controller only produces the same steering, drive and handbrake inputs as the player.
export function updatePhysics(track,c,{steer=0,drive=0,handbrake=0},dt=DT){
  steer=clamp(steer,-1,1);drive=clamp(drive,-1,1);handbrake=clamp(handbrake,0,1);
  let b=basis(c),long=b.long,lat=b.lat;
  if(drive>=0)long+=ACCEL*drive*dt;else if(long>3)long-=BRAKE*(-drive)*dt;else long-=REV_ACCEL*(-drive)*dt;
  if(Math.abs(long)>1e-6)long=Math.sign(long)*Math.max(0,Math.abs(long)-(3.8+.00042*long*long)*dt);
  long=clamp(long,-MAX_REV,MAX_FWD);c.vx=b.f.x*long+b.r.x*lat;c.vy=b.f.y*long+b.r.y*lat;
  const ratio=Math.min(1,Math.abs(long)/MAX_FWD),maxSteer=STEER_LOW*(1-ratio)+STEER_HIGH*ratio;
  c.steerAngle+=clamp(steer*maxSteer-c.steerAngle,-STEER_RATE*dt,STEER_RATE*dt);
  let yaw=Math.abs(long)>2?long/WHEELBASE*Math.tan(c.steerAngle)*TURN_GAIN:0;
  yaw*=1+.22*handbrake;c.omega+=(yaw-c.omega)*Math.min(1,10*dt);c.omega*=Math.exp(-.48*dt);c.h=wrap(c.h+c.omega*dt);
  b=basis(c);let long2=b.long,lat2=b.lat;const r2=Math.min(1,Math.abs(long2)/MAX_FWD);
  const grip=(GRIP_LOW*(1-r2)+GRIP_HIGH*r2)*Math.max(.35,1-STEER_GRIP_DROP*Math.abs(steer)*r2-.68*handbrake);
  lat2*=Math.exp(-grip*dt);long2=Math.sign(long2||1)*Math.max(0,Math.abs(long2)-(.05*Math.abs(lat2)+1.15*Math.abs(steer)*r2+5.5*handbrake*r2)*dt);
  c.vx=b.f.x*long2+b.r.x*lat2;c.vy=b.f.y*long2+b.r.y*lat2;c.x+=c.vx*dt;c.y+=c.vy*dt;c.slip=Math.atan2(Math.abs(lat2),Math.abs(long2)+1);
  let n=nearest(track,c.x,c.y,c.seg);c.seg=n.i;
  if(Math.abs(n.cross)>ROAD_HALF){const drag=Math.exp(-2.2*dt);c.vx*=drag;c.vy*=drag;c.metrics.grass+=dt}
  const sg=n.cross>=0?1:-1,out={x:-n.ty*sg,y:n.tx*sg},allowed=RUNOFF_HALF-radius(c,out);
  // This is the outside circuit wall, shared by every car. Asphalt is never a position constraint.
  if(Math.abs(n.cross)>allowed){const pen=Math.abs(n.cross)-allowed;c.x-=out.x*(pen+.08);c.y-=out.y*(pen+.08);const vn=c.vx*out.x+c.vy*out.y;if(vn>0){c.vx-=out.x*vn*1.15;c.vy-=out.y*vn*1.15}c.vx*=.75;c.vy*=.75;c.omega*=.45;c.metrics.walls++;n=nearest(track,c.x,c.y,c.seg);c.seg=n.i}
  c.near=n;return n;
}

const lines=new WeakMap();
export function racingLine(track){
  if(lines.has(track))return lines.get(track);
  const count=Math.ceil(track.len/5),ds=track.len/count,points=Array.from({length:count},(_,i)=>trackPoint(track,i*ds));
  const speed=points.map((_,i)=>{
    const a=points[(i-3+count)%count],b=points[i],c=points[(i+3)%count];
    const ab=Math.hypot(a.x-b.x,a.y-b.y),bc=Math.hypot(c.x-b.x,c.y-b.y),ac=Math.hypot(c.x-a.x,c.y-a.y);
    const k=Math.abs(2*((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/Math.max(1,ab*bc*ac));
    return Math.min(MAX_FWD,Math.sqrt(85/Math.max(.0001,k)));
  });
  for(let pass=0;pass<3;pass++)for(let i=count-1;i>=0;i--)speed[i]=Math.min(speed[i],Math.sqrt(speed[(i+1)%count]**2+2*BRAKE*.52*ds));
  const value={speed,ds,count};lines.set(track,value);return value;
}
function plannedSpeed(track,s){const line=racingLine(track),i=Math.floor(((s%track.len)+track.len)%track.len/line.ds);return line.speed[i%line.count]}
export function createCar(track,{driver=null,player=false,progress=0,offset=0,speed=0,headingOffset=0,...other}={}){
  const p=trackPoint(track,progress),h=p.heading+headingOffset;
  return{...other,player,name:driver?.name||'YOU',rating:driver?.rating||null,generation:driver?.generation||null,brain:driver?compile(driver):null,x:p.x-p.ty*offset,y:p.y+p.tx*offset,h,vx:Math.cos(h)*speed,vy:Math.sin(h)*speed,omega:0,steerAngle:0,seg:p.i,lastProgress:p.progress,totalProgress:progress,lap:0,finished:false,finishMs:null,near:null,lane:offset,desiredLane:offset,command:{steer:0,drive:0},controlTick:0,stalled:0,skids:[],slip:0,contacts:0,stationary:0,metrics:{grass:0,walls:0,contacts:0,impacts:0,stall:0,max_stall:0,backward:0},...other};
}
function features(track,c,cars){
  const n=c.near,b=basis(c),v=Math.hypot(c.vx,c.vy),out=[v/MAX_FWD,b.long/MAX_FWD,clamp(b.lat/(MAX_FWD*.35),-1,1),clamp(n.cross/ROAD_HALF,-1.3,1.3)];
  for(const d of [18,42,82,142]){const p=trackPoint(track,n.progress+d),a=wrap(Math.atan2(p.y-c.y,p.x-c.x)-c.h);out.push(Math.sin(a),Math.cos(a))}
  const h0=trackPoint(track,n.progress+35).heading,h1=trackPoint(track,n.progress+90).heading,h2=trackPoint(track,n.progress+165).heading;
  out.push(Math.sin(wrap(h1-h0)),Math.sin(wrap(h2-h1)));
  let front=Infinity,side=0,closing=0,lp=0,rp=0,rear=0;
  for(const o of cars){if(o===c)continue;const dx=o.x-c.x,dy=o.y-c.y,a=dx*b.f.x+dy*b.f.y,s=dx*b.r.x+dy*b.r.y;if(a>0&&a<96&&Math.abs(s)<ROAD_HALF&&a<front){front=a;side=s;closing=b.long-basis(o).long}if(Math.abs(a)<32&&Math.abs(s)<24){const pressure=(1-Math.abs(a)/32)*(1-Math.abs(s)/24);if(s<0)lp=Math.max(lp,pressure);else rp=Math.max(rp,pressure)}if(a<0&&a>-55&&Math.abs(s)<16)rear=Math.max(rear,1+a/55)}
  return[...out,Number.isFinite(front)?1-front/96:0,side/ROAD_HALF,closing/MAX_FWD,lp,rp,rear];
}
export function driverControl(track,c,cars,dt=DT){
  const n=c.near||nearest(track,c.x,c.y,c.seg),b=basis(c),speed=Math.hypot(c.vx,c.vy),[trim,pace]=c.brain?activate(c.brain,features(track,c,cars)):[0,0];
  const headingError=Math.abs(wrap(c.h-n.heading));
  // Hysteresis keeps a half-completed turn from alternating between the
  // recovery goal and cruise. Finish turning before resuming the racing line.
  c.reorienting=headingError>1.3||!!c.reorienting&&headingError>.45;
  // Choose an open trajectory by checking predicted separation. This moves the steering target only.
  const stopped=cars.some(o=>{if(o===c||!o.near||!o.player)return false;const gap=wrapProgress(track,o.near.progress-n.progress);return gap>-40&&gap<160&&Math.hypot(o.vx,o.vy)<8});
  const corridor=stopped?16:12,options=[-corridor,0,corridor],preview=.65+speed*.002,normal={x:-n.ty,y:n.tx};
  const passObstacle=cars.filter(o=>o!==c&&o.near&&o.player&&Math.hypot(o.vx,o.vy)<8).map(o=>({o,gap:wrapProgress(track,o.near.progress-n.progress)})).filter(x=>x.gap>0&&x.gap<160).sort((a,b)=>a.gap-b.gap)[0];
  if(c.passTarget){const gap=wrapProgress(track,c.passTarget.near.progress-n.progress);if(gap<-(CAR_L+4)||gap>200||Math.hypot(c.passTarget.vx,c.passTarget.vy)>16)c.passTarget=null}
  let best=Infinity,lane=c.desiredLane;
  for(const candidate of options){
    let cost=Math.abs(candidate)*.04+Math.abs(candidate-c.desiredLane)*.02;
    for(const o of cars){if(o===c||!o.near)continue;let gap=wrapProgress(track,o.near.progress-n.progress);const ov=Math.max(0,basis(o).long),predicted=gap+(ov-speed)*preview;
      if(gap<-CAR_L*.85&&Math.abs(o.near.cross-n.cross)<10)continue;
      if(gap>-CAR_L*2&&gap<Math.max(85,speed*1.2)){const futureCross=o.lane+clamp(o.desiredLane-o.lane,-12*preview,12*preview),side=Math.min(Math.abs(o.near.cross-candidate),Math.abs(futureCross-candidate)),clearance=radius(c,normal)+radius(o,normal)+2.5;if(side<clearance)cost+=(1-Math.max(0,gap)/200)*45+Math.max(0,1-Math.abs(predicted)/(CAR_L+36))*30}
    }
    if(cost<best){best=cost;lane=candidate}
  }
  if(!c.passTarget&&passObstacle){
    c.passTarget=passObstacle.o;const o=c.passTarget,s=o.near.progress,k=wrap(trackPoint(track,s+15).heading-trackPoint(track,s-15).heading)/30;
    // Plan clearance at the obstacle, where our car will follow its local
    // tangent. Using the approach-corner normal can make every lane appear
    // blocked and accidentally lock the pass target onto the occupied centre.
    const obstacleNormal={x:-o.near.ty,y:o.near.tx};
    const available=[-16,0,16].filter(x=>Math.abs(x-o.near.cross)>CAR_W/2+radius(o,obstacleNormal)+2);
    c.passLane=available.sort((a,b)=>(Math.abs(a-n.cross)+Math.abs(a)*.3+(k*a>.3?100:0))-(Math.abs(b-n.cross)+Math.abs(b)*.3+(k*b>.3?100:0)))[0]??lane;
  }
  if(c.passTarget)lane=c.passLane;
  c.desiredLane=lane;c.lane+=clamp(lane-c.lane,-12*dt,12*dt);
  const look=18+speed*.19,p=trackPoint(track,n.progress+look);
  const pathCurvature=wrap(trackPoint(track,p.progress+10).heading-trackPoint(track,p.progress-10).heading)/20;
  const offset=pathCurvature*c.lane>.4?Math.sign(c.lane)*.4/Math.abs(pathCurvature):c.lane;
  const tx=p.x-p.ty*offset,ty=p.y+p.tx*offset,dx=tx-c.x,dy=ty-c.y;
  const slipAngle=speed>10?Math.atan2(b.lat,Math.max(1,b.long)):0;
  const alpha=wrap(Math.atan2(dy,dx)-c.h-.7*slipAngle),distance=Math.max(8,Math.hypot(dx,dy)),curvature=2*Math.sin(alpha)/distance;
  const maxSteer=STEER_LOW*(1-Math.min(1,speed/MAX_FWD))+STEER_HIGH*Math.min(1,speed/MAX_FWD);
  let steer=clamp(Math.atan(curvature*WHEELBASE/TURN_GAIN)/maxSteer+.02*trim,-1,1);
  // Give evolution real pace authority instead of confining it to a cautious
  // +/-11% trim. The network can attack corners or lift; physics is unchanged.
  let target=plannedSpeed(track,n.progress+8)*(.6+3.4*(pace+1)/2);
  target*=Math.min(1,Math.sqrt(Math.max(.4,1-pathCurvature*offset)));
  target=Math.min(MAX_FWD,target);target*=clamp(1-Math.abs(alpha)*.28,.45,1);
  for(const o of cars){if(o===c||!o.near)continue;const gap=wrapProgress(track,o.near.progress-n.progress),side=Math.abs(o.near.cross-n.cross);
    if(gap>0&&gap<110&&side<radius(c,normal)+radius(o,normal)+1){const ov=Math.max(0,basis(o).long),separation=CAR_L+8+speed*.25;target=Math.min(target,Math.max(0,ov+(gap-separation)*1.3))}
    const dx=o.x-c.x,dy=o.y-c.y,a=dx*b.f.x+dy*b.f.y,l=dx*b.r.x+dy*b.r.y;
    const closingSide=(o.vx-c.vx)*b.r.x+(o.vy-c.vy)*b.r.y,predictedSide=l+closingSide*.45,clear=radius(c,b.r)+radius(o,b.r)+2;
    if(gap>0&&a>0&&a<110&&Math.min(Math.abs(l),Math.abs(predictedSide))<clear){const ov=o.vx*b.f.x+o.vy*b.f.y;target=Math.min(target,Math.max(0,ov+(a-(CAR_L+8+speed*.35))*1.4))}
  }
  // Recovery uses ordinary reverse/steering commands, including when the player blocks the racing line.
  if(speed<7)c.stalled+=dt;else c.stalled=Math.max(0,c.stalled-2*dt);
  if(c.maneuverTime>0){c.maneuverTime-=dt;return c.maneuver}
  if(c.reorienting){
    if(speed>12)return{steer:0,drive:b.long<0?1:b.long>3?-1:0,handbrake:0};
    c.maneuver=searchManeuver(track,c,cars);c.maneuverTime=c.maneuver.duration||.35;c.stalled=0;
    return c.maneuver;
  }
  if(c.stalled>.6&&(target<8||Math.abs(alpha)>1.6)){
    c.maneuver=searchManeuver(track,c,cars);c.maneuverTime=c.maneuver.duration||.7;c.stalled=0;
    if(c.maneuver.drive===0&&c.passTarget){c.passLane=-c.passLane;c.maneuverTime=.8}
    return c.maneuver;
  }
  if(Math.abs(alpha)>1.6&&speed<35)return{steer:Math.sign(alpha),drive:0,handbrake:0};
  // Brake against signed forward velocity. Using absolute speed here turns a
  // small backwards roll into full reverse acceleration when waiting in traffic.
  return{steer,drive:driveForVelocity(target,b.long),handbrake:0};
}
export function driveForVelocity(target,forward){
  const error=target-forward;
  if(error>.5)return clamp(error/16,.08,1);
  // Below this threshold a negative pedal is reverse, not a brake.
  if(error<-.5&&forward>3)return-clamp(-error/12,.08,1);
  return 0;
}
function overlaps(a,b,margin=1){
  if(Math.abs(a.x-b.x)>Math.hypot(CAR_L,CAR_W)+margin||Math.abs(a.y-b.y)>Math.hypot(CAR_L,CAR_W)+margin)return false;
  const ba=basis(a),bb=basis(b),dx=b.x-a.x,dy=b.y-a.y;
  return[ba.f,ba.r,bb.f,bb.r].every(axis=>Math.abs(dx*axis.x+dy*axis.y)<radius(a,axis)+radius(b,axis)+margin);
}
// A short, collision-checked search supplies ordinary controls when cruise is
// deadlocked. It never moves the real car or grants extra grip/steering.
function searchManeuver(track,c,cars){
  const n=c.near,wrongWay=c.reorienting||Math.abs(wrap(c.h-n.heading))>1.3;
  const p=trackPoint(track,n.progress+(wrongWay?18:38)),goal={x:p.x-p.ty*c.lane,y:p.y+p.tx*c.lane};
  // A backwards-facing car must turn around, not optimize track progress by
  // driving a whole lap in reverse. Heading dominates the short recovery goal.
  const cost=a=>Math.hypot(a.x-goal.x,a.y-goal.y)+(wrongWay?48:8)*Math.abs(wrap(a.h-p.heading));
  let best=Infinity,command={steer:0,drive:0,handbrake:0};
  for(const horizon of [.4,.8,1.6])for(const drive of [.22,.4,-.4])for(const steer of [-1,-.5,0,.5,1]){
    const a={...c,metrics:{...c.metrics}},input={steer,drive,handbrake:0};let safe=true;
    for(let step=1;step<=Math.round(horizon/DT);step++){
      const near=updatePhysics(track,a,input),time=step*DT;
      if(a.metrics.walls>c.metrics.walls||Math.abs(near.cross)>Math.max(ROAD_HALF,Math.abs(n.cross)+1)){safe=false;break}
      if(step%4===0&&cars.some(o=>o!==c&&overlaps(a,{...o,x:o.x+o.vx*time,y:o.y+o.vy*time}))){safe=false;break}
    }
    const score=cost(a)+(drive<0?6:0);
    if(safe&&score<best){best=score;command={...input,duration:Math.min(.7,horizon-.05)}}
  }
  return command;
}
export const wrapProgress=(track,gap)=>((gap+track.len/2)%track.len+track.len)%track.len-track.len/2;

export function stepSimulation(track,cars,{dt=DT,elapsed=0,playerCommand={steer:0,drive:0,handbrake:0}}={}){
  for(const c of cars)if(!c.near)c.near=nearest(track,c.x,c.y,c.seg);
  // Controls share one position/velocity snapshot; front cars declare lane intent first.
  const intended=new Map();
  for(const c of [...cars].sort((a,b)=>b.totalProgress-a.totalProgress))intended.set(c,c.player?playerCommand:driverControl(track,c,cars,dt));
  const commands=cars.map(c=>intended.get(c));
  for(let i=0;i<cars.length;i++){
    const c=cars[i],n=updatePhysics(track,c,commands[i],dt);let dp=wrapProgress(track,n.progress-c.lastProgress);
    c.totalProgress+=dp;c.lastProgress=n.progress;c.lap=Math.max(0,Math.floor(c.totalProgress/track.len));
    if(elapsed>2&&Math.hypot(c.vx,c.vy)<5){c.metrics.stall+=dt;c.stationary+=dt;c.metrics.max_stall=Math.max(c.metrics.max_stall,c.stationary)}else c.stationary=0;
    if(dp<-.01)c.metrics.backward-=dp;
    if(!c.finished&&c.totalProgress>=LAPS*track.len){c.finished=true;c.finishMs=(elapsed+dt)*1000}
  }
  const contacts=new Set;
  for(let pass=0;pass<2;pass++)for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){
    if(Math.abs(cars[i].x-cars[j].x)>CAR_L*2||Math.abs(cars[i].y-cars[j].y)>CAR_L*2)continue;
    const relativeSpeed=Math.hypot(cars[i].vx-cars[j].vx,cars[i].vy-cars[j].vy);
    if(collide(cars[i],cars[j])){const pair=`${i}:${j}`;contacts.add(pair);if(!track.contacts?.has(pair)&&pass===0){cars[i].metrics.contacts++;cars[j].metrics.contacts++;cars[i].contacts++;cars[j].contacts++;if(relativeSpeed>12){cars[i].metrics.impacts++;cars[j].metrics.impacts++}}}
  }
  track.contacts=contacts;
}
