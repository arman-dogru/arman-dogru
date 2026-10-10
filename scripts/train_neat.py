#!/usr/bin/env python3
"""Train NEAT residual controllers for the portfolio's Istanbul Park race.

The low-level path follower guarantees basic track competence. NEAT evolves residual
steering trim and pace bias. Physics constants here must match terminal-race.js.
The steering constants were selected by a fixed-budget sweep documented in
STEERING_SWEEP.md.
"""
import bisect,json,math,random,statistics,time
from dataclasses import dataclass
from pathlib import Path

SEED=20261010;random.seed(SEED)
POP=24;GENERATIONS=10;N_INPUT=12
WORLD_W=1400.;WORLD_H=840.;MARGIN=76.
CAR_W=8.;CAR_L=16.;ROAD_W=CAR_W*3.5;ROAD_HALF=ROAD_W/2
BARRIER_HALF=ROAD_HALF+CAR_W*4.5
WHEELBASE=12.;DT=1/60
MAX_FWD=150.;MAX_REV=36.;ACCEL=82.;BRAKE=190.;REV_ACCEL=52.
STEER_LOW=.72;STEER_HIGH=.43;TURN_GAIN=.75;STEER_RATE=6.8
GRIP_LOW=10.1;GRIP_HIGH=5.3;STEER_GRIP_DROP=.29
ROOT=Path(__file__).resolve().parents[1]
TRACK_DATA=json.loads((ROOT/'race-track-istanbul.json').read_text())
coords=TRACK_DATA['coordinates']
if coords[0]==coords[-1]:coords=coords[:-1]
lon0=sum(p[0]for p in coords)/len(coords);lat0=sum(p[1]for p in coords)/len(coords);cc=math.cos(math.radians(lat0))
xy=[((lon-lon0)*111320*cc,-(lat-lat0)*110540)for lon,lat in coords];xs=[p[0]for p in xy];ys=[p[1]for p in xy]
scale=min((WORLD_W-2*MARGIN)/(max(xs)-min(xs)),(WORLD_H-2*MARGIN)/(max(ys)-min(ys)));cx=(min(xs)+max(xs))/2;cy=(min(ys)+max(ys))/2
TRACK=[((x-cx)*scale+WORLD_W/2,(y-cy)*scale+WORLD_H/2)for x,y in xy]
for _ in range(2):
    out=[]
    for i,p in enumerate(TRACK):
        q=TRACK[(i+1)%len(TRACK)];out += [(.75*p[0]+.25*q[0],.75*p[1]+.25*q[1]),(.25*p[0]+.75*q[0],.25*p[1]+.75*q[1])]
    TRACK=out
SEG=[];CUM=[0.]
for i,p in enumerate(TRACK):
    q=TRACK[(i+1)%len(TRACK)];dx=q[0]-p[0];dy=q[1]-p[1];L=math.hypot(dx,dy);tx=dx/L;ty=dy/L
    SEG.append((p[0],p[1],dx,dy,L,tx,ty,math.atan2(dy,dx)));CUM.append(CUM[-1]+L)
TRACK_LEN=CUM[-1]

def wrap(a):return(a+math.pi)%(2*math.pi)-math.pi
def track_point(progress):
    p=progress%TRACK_LEN;i=max(0,min(len(SEG)-1,bisect.bisect_right(CUM,p)-1));x,y,dx,dy,L,tx,ty,h=SEG[i];t=(p-CUM[i])/L
    return x+dx*t,y+dy*t,h,i
def nearest(x,y,last=None):
    ids=range(len(SEG))if last is None else((last+d)%len(SEG)for d in range(-10,11));best=None
    for i in ids:
        x1,y1,dx,dy,L,tx,ty,h=SEG[i];t=max(0,min(1,((x-x1)*dx+(y-y1)*dy)/(L*L)));px=x1+t*dx;py=y1+t*dy;ox=x-px;oy=y-py;d2=ox*ox+oy*oy;cross=tx*oy-ty*ox;item=(d2,cross,CUM[i]+t*L,i,h,tx,ty,px,py)
        if best is None or d2<best[0]:best=item
    if last is not None and best[0]>(ROAD_W*5)**2:return nearest(x,y,None)
    return best

@dataclass
class Car:
    x:float;y:float;h:float;vx:float=0.;vy:float=0.;omega:float=0.;steer_angle:float=0.;last:float=0.;total:float=0.;seg:int=0;wall_hits:int=0;grass_time:float=0.

def local(c):
    f=(math.cos(c.h),math.sin(c.h));r=(-f[1],f[0]);return c.vx*f[0]+c.vy*f[1],c.vx*r[0]+c.vy*r[1],f,r

def physics(c,steer,drive,dt=DT,handbrake=0.):
    steer=max(-1,min(1,steer));drive=max(-1,min(1,drive));long,lat,f,r=local(c)
    if drive>=0:long+=ACCEL*drive*dt
    else:
        p=-drive
        if long>3:long-=BRAKE*p*dt
        else:long-=REV_ACCEL*p*dt
    if abs(long)>1e-6:
        decel=(4.+.0005*long*long)*dt;long=math.copysign(max(0,abs(long)-decel),long)
    long=max(-MAX_REV,min(MAX_FWD,long));c.vx=f[0]*long+r[0]*lat;c.vy=f[1]*long+r[1]*lat
    ratio=min(1,abs(long)/MAX_FWD);maxsteer=STEER_LOW*(1-ratio)+STEER_HIGH*ratio;target=steer*maxsteer
    c.steer_angle+=max(-STEER_RATE*dt,min(STEER_RATE*dt,target-c.steer_angle))
    target_yaw=(long/WHEELBASE)*math.tan(c.steer_angle)*TURN_GAIN if abs(long)>2 else 0
    if handbrake:target_yaw*=1+.22*handbrake
    c.omega+=(target_yaw-c.omega)*min(1,9*dt);c.omega*=math.exp(-.55*dt);c.h=wrap(c.h+c.omega*dt)
    f=(math.cos(c.h),math.sin(c.h));r=(-f[1],f[0]);long2=c.vx*f[0]+c.vy*f[1];lat2=c.vx*r[0]+c.vy*r[1];ratio=min(1,abs(long2)/MAX_FWD)
    grip=(GRIP_LOW*(1-ratio)+GRIP_HIGH*ratio)*max(.28,1-STEER_GRIP_DROP*abs(steer)*ratio-.68*handbrake);lat2*=math.exp(-grip*dt)
    scrub=(.07*abs(lat2)+1.6*abs(steer)*ratio+5.5*handbrake*ratio)*dt;long2=math.copysign(max(0,abs(long2)-scrub),long2)
    c.vx=f[0]*long2+r[0]*lat2;c.vy=f[1]*long2+r[1]*lat2;c.x+=c.vx*dt;c.y+=c.vy*dt
    n=nearest(c.x,c.y,c.seg);c.seg=n[3];cross=n[1]
    if abs(cross)>ROAD_HALF:
        factor=math.exp(-2.7*dt);c.vx*=factor;c.vy*=factor;c.grass_time+=dt
    left=(-n[6],n[5]);sg=1 if cross>=0 else-1;outward=(left[0]*sg,left[1]*sg);ff=(math.cos(c.h),math.sin(c.h));rr=(-ff[1],ff[0])
    extent=CAR_L/2*abs(ff[0]*outward[0]+ff[1]*outward[1])+CAR_W/2*abs(rr[0]*outward[0]+rr[1]*outward[1]);allowed=BARRIER_HALF-extent
    if abs(cross)>allowed:
        pen=abs(cross)-allowed;c.x-=outward[0]*(pen+.35);c.y-=outward[1]*(pen+.35);vn=c.vx*outward[0]+c.vy*outward[1]
        if vn>0:c.vx-=outward[0]*vn*1.15;c.vy-=outward[1]*vn*1.15
        c.vx-=outward[0]*5.5;c.vy-=outward[1]*5.5;c.omega*=.45;c.steer_angle*=.7;c.wall_hits+=1;n=nearest(c.x,c.y,c.seg);c.seg=n[3]
    return n

def sensors(c):
    n=nearest(c.x,c.y,c.seg);c.seg=n[3];long,lat,_,_=local(c);speed=math.hypot(c.vx,c.vy);out=[speed/MAX_FWD,max(-1,min(1,long/MAX_FWD)),max(-1,min(1,lat/(MAX_FWD*.4))),max(-1,min(1,n[1]/ROAD_HALF))]
    for d in(20,55,115):
        x,y,_,_=track_point(n[2]+d);a=wrap(math.atan2(y-c.y,x-c.x)-c.h);out.extend((math.sin(a),math.cos(a)))
    _,_,h1,_=track_point(n[2]+55);_,_,h2,_=track_point(n[2]+135);cur=wrap(h2-h1);out.extend((math.sin(cur),math.cos(cur)))
    return out[:12],n

def base_control(c):
    n=nearest(c.x,c.y,c.seg);c.seg=n[3];speed=math.hypot(c.vx,c.vy);look=18+.16*speed;_,_,dh,_=track_point(n[2]+look);err=wrap(dh-c.h);corr=-math.atan2(1.35*n[1],speed+18);steer=max(-1,min(1,(err+corr)/.34));_,_,h0,_=track_point(n[2]+30);_,_,h1,_=track_point(n[2]+90);_,_,h2,_=track_point(n[2]+170);cur=max(abs(wrap(h1-h0)),abs(wrap(h2-h1)));target=max(50,140-74*min(1,cur/1.45)-min(18,abs(err)*18+max(0,abs(n[1])-ROAD_HALF*.55)*.8));return steer,target,n

def drive_for(speed,target):
    if speed<target-5:return min(1,(target-speed)/24+.25)
    if speed>target+2:return-min(1,(speed-target)/22+.2)
    return .10

@dataclass
class Genome:nodes:dict;conns:list;fitness:float=0.;adjusted:float=0.
innov={};next_innov=0;next_node=15
def innovation(a,b):
    global next_innov
    if(a,b)not in innov:innov[a,b]=next_innov;next_innov+=1
    return innov[a,b]
def fresh():
    nodes={i:0. for i in range(13)}|{13:1.,14:1.};con=[]
    for a in range(13):
        for b in(13,14):con.append({'a':a,'b':b,'w':random.gauss(0,.08),'enabled':True,'innovation':innovation(a,b)})
    return Genome(nodes,con)
def clone(g):return Genome(dict(g.nodes),[dict(c)for c in g.conns])
def mutate(g):
    global next_node
    for c in g.conns:
        if random.random()<.84:c['w']=max(-5,min(5,c['w']+random.gauss(0,.22)))
        if random.random()<.04:c['w']=random.uniform(-1.6,1.6)
    if random.random()<.14:
        existing={(c['a'],c['b'])for c in g.conns};ids=list(g.nodes)
        for _ in range(40):
            a,b=random.sample(ids,2)
            if g.nodes[a]<g.nodes[b]and(a,b)not in existing and b>12:g.conns.append({'a':a,'b':b,'w':random.uniform(-1.2,1.2),'enabled':True,'innovation':innovation(a,b)});break
    if random.random()<.06:
        enabled=[c for c in g.conns if c['enabled']]
        if enabled:
            c=random.choice(enabled);c['enabled']=False;n=next_node;next_node+=1;g.nodes[n]=(g.nodes[c['a']]+g.nodes[c['b']])/2;g.conns.extend([{'a':c['a'],'b':n,'w':1.,'enabled':True,'innovation':innovation(c['a'],n)},{'a':n,'b':c['b'],'w':c['w'],'enabled':True,'innovation':innovation(n,c['b'])}])
    return g
def distance(a,b):
    A={c['innovation']:c for c in a.conns};B={c['innovation']:c for c in b.conns};match=set(A)&set(B);wd=sum(abs(A[i]['w']-B[i]['w'])for i in match)/len(match)if match else 0;xor=set(A)^set(B);m=min(max(A,default=0),max(B,default=0));ex=sum(i>m for i in xor);return ex/max(20,len(A),len(B))+(len(xor)-ex)/max(20,len(A),len(B))+.4*wd
def crossover(a,b):
    if b.fitness>a.fitness:a,b=b,a
    A={c['innovation']:c for c in a.conns};B={c['innovation']:c for c in b.conns};con=[]
    for i,c in A.items():
        x=dict(B[i]if i in B and random.random()<.5 else c)
        if i in B and(not c['enabled']or not B[i]['enabled'])and random.random()<.75:x['enabled']=False
        con.append(x)
    ids={i for c in con for i in(c['a'],c['b'])};nodes={i:a.nodes.get(i,b.nodes.get(i,.5))for i in ids}
    for i in range(15):nodes.setdefault(i,0. if i<13 else 1.)
    return Genome(nodes,con)
def compile_net(g):
    inc={}
    for c in g.conns:
        if c['enabled']:inc.setdefault(c['b'],[]).append((c['a'],c['w']))
    return[(n,inc.get(n,()))for n,l in sorted(g.nodes.items(),key=lambda x:(x[1],x[0]))if n>12]
def activate(net,x):
    v={i:x[i]for i in range(12)};v[12]=1.
    for n,incs in net:v[n]=math.tanh(sum(v.get(a,0)*w for a,w in incs))
    return v.get(13,0),v.get(14,0)
def agent_control(c,net):
    x,_=sensors(c);trim,pace=activate(net,x);base,target,_=base_control(c);steer=max(-1,min(1,base+.22*trim));target*=.92+.14*((pace+1)/2);target=max(45,min(145,target));return steer,drive_for(math.hypot(c.vx,c.vy),target)
def evaluate(g,seed,horizon=550):
    rng=random.Random(seed);prog=rng.uniform(0,TRACK_LEN);p=track_point(prog);n0=nearest(p[0],p[1],p[3]);left=(-n0[6],n0[5]);side=rng.uniform(-ROAD_HALF*.25,ROAD_HALF*.25);c=Car(p[0]+left[0]*side,p[1]+left[1]*side,p[2]+rng.uniform(-.06,.06),seg=p[3]);n=nearest(c.x,c.y,c.seg);c.last=n[2];net=compile_net(g);reward=0;stall=0
    for _ in range(horizon):
        s,d=agent_control(c,net);n2=physics(c,s,d);dp=n2[2]-c.last
        if dp<-TRACK_LEN/2:dp+=TRACK_LEN
        elif dp>TRACK_LEN/2:dp-=TRACK_LEN
        if dp>-45:c.total+=dp
        c.last=n2[2];speed=math.hypot(c.vx,c.vy);reward+=max(-3,min(5,dp))*2.1+(speed/MAX_FWD)*.02-max(0,abs(n2[1])-ROAD_HALF*.85)*.01;stall=stall+1 if speed<5 else max(0,stall-3)
        if stall>180:reward-=100;break
    return reward+c.total*1.35+max(0,c.total/TRACK_LEN)*900-c.wall_hits*3.5-c.grass_time*.45
def speciate(pop,t=2.5):
    groups=[]
    for g in sorted(pop,key=lambda x:-x.fitness):
        s=next((s for s in groups if distance(g,s[0])<t),None)
        if s:s.append(g)
        else:groups.append([g])
    return groups
def evolve():
    pop=[mutate(fresh())for _ in range(POP)];started=time.time()
    for gen in range(GENERATIONS):
        seeds=(SEED+gen*43+3,SEED+gen*43+17)
        for g in pop:g.fitness=statistics.mean(evaluate(g,s)for s in seeds)
        groups=speciate(pop)[:10]
        for s in groups:
            s.sort(key=lambda g:-g.fitness)
            for g in s:g.adjusted=g.fitness/len(s)
        pool=[g for s in groups for g in s];floor=min(g.adjusted for g in pool);weights=[max(.001,g.adjusted-floor+.001)for g in pool];nxt=[clone(s[0])for s in groups]
        while len(nxt)<POP:
            a=random.choices(pool,weights=weights,k=1)[0];b=random.choices(pool,weights=weights,k=1)[0];nxt.append(mutate(crossover(a,b)if random.random()<.72 else clone(a)))
        print(f'gen {gen+1:02d}/{GENERATIONS} species={len(groups)} best={max(g.fitness for g in pool):.1f} elapsed={time.time()-started:.1f}s');pop=nxt
    for g in pop:g.fitness=statistics.mean(evaluate(g,SEED+9000+k*137,horizon=900)for k in range(2))
    pop.sort(key=lambda g:-g.fitness);chosen=[]
    for g in pop:
        if not chosen or all(distance(g,h)>.10 for h in chosen):chosen.append(g)
        if len(chosen)==9:break
    for g in pop:
        if len(chosen)==9:break
        if g not in chosen:chosen.append(g)
    return chosen
def verify(g,seconds=70):
    p=track_point(15);c=Car(p[0],p[1],p[2],seg=p[3]);n=nearest(c.x,c.y,c.seg);c.last=n[2];net=compile_net(g);stall_frames=0
    for _ in range(int(seconds/DT)):
        s,d=agent_control(c,net);n2=physics(c,s,d);dp=n2[2]-c.last
        if dp<-TRACK_LEN/2:dp+=TRACK_LEN
        elif dp>TRACK_LEN/2:dp-=TRACK_LEN
        if dp>-45:c.total+=dp
        c.last=n2[2];stall_frames+=math.hypot(c.vx,c.vy)<5
    return{'laps':c.total/TRACK_LEN,'wall_hits':c.wall_hits,'grass_s':c.grass_time,'stall_frames':stall_frames}
def export(champs):
    out={'version':'neat-race-v3','seed':SEED,'track':'istanbul-park-v3','population':POP,'generations':GENERATIONS,'controller':'NEAT residual steering + pace over deterministic path follower; steering sweep selected responsive-fine-b','steering_config':{'steer_low':STEER_LOW,'steer_high':STEER_HIGH,'turn_gain':TURN_GAIN,'steer_rate':STEER_RATE,'grip_low':GRIP_LOW,'grip_high':GRIP_HIGH,'steer_grip_drop':STEER_GRIP_DROP},'champions':[]}
    for i,g in enumerate(champs,1):
        hidden={str(k):round(v,3)for k,v in g.nodes.items()if k>14};con=[[c['a'],c['b'],round(c['w'],4)]for c in g.conns if c['enabled']];v=verify(g);out['champions'].append({'name':f'NEAT-{i:03d}','fitness':round(g.fitness,3),'hidden':hidden,'connections':con,'verification':{k:round(x,3)if isinstance(x,float)else x for k,x in v.items()}});print(f"NEAT-{i:03d}: laps={v['laps']:.2f} wall_hits={v['wall_hits']} grass={v['grass_s']:.1f}s stalls={v['stall_frames']}")
    (ROOT/'neat-champions.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
if __name__=='__main__':export(evolve())
