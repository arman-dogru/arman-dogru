#!/usr/bin/env python3
"""
NEAT Grand Prix v3.2 trainer.

The low-level controller follows Istanbul Park. NEAT learns residual steering and
pace control from both track state and nearby traffic. Fitness is evaluated in
9-car packs so avoidance, clean passing and off-track discipline are trained,
not bolted on after training.
"""
import bisect, json, math, random, statistics, time
from dataclasses import dataclass, field
from pathlib import Path

SEED = 20261010
random.seed(SEED)
POP = 36
GENERATIONS = 24
PACK_SIZE = 9
PACK_ROUNDS = 1
N_INPUT = 16
BIAS_NODE = N_INPUT
OUT_STEER = N_INPUT + 1
OUT_PACE = N_INPUT + 2
FIRST_HIDDEN = N_INPUT + 3

WORLD_W, WORLD_H, MARGIN = 1400.0, 840.0, 76.0
CAR_W, CAR_L = 8.0, 16.0
ROAD_W, ROAD_HALF = CAR_W * 3.5, CAR_W * 3.5 / 2
BARRIER_HALF = ROAD_HALF + CAR_W * 4.5
WHEELBASE, DT = 12.0, 1/60

MAX_FWD, MAX_REV = 150.0, 36.0
ACCEL, BRAKE, REV_ACCEL = 82.0, 190.0, 52.0

# Slightly more steering than v3.1, while maintaining high-speed stability.
STEER_LOW, STEER_HIGH = .74, .445
TURN_GAIN, STEER_RATE = .78, 7.1
GRIP_LOW, GRIP_HIGH, STEER_GRIP_DROP = 10.2, 5.4, .285

ROOT = Path(__file__).resolve().parents[1]
TRACK_DATA = json.loads((ROOT / 'race-track-istanbul.json').read_text())
coords = TRACK_DATA['coordinates']
if coords[0] == coords[-1]:
    coords = coords[:-1]
lon0 = sum(p[0] for p in coords)/len(coords)
lat0 = sum(p[1] for p in coords)/len(coords)
cc = math.cos(math.radians(lat0))
xy = [((lon-lon0)*111320*cc, -(lat-lat0)*110540) for lon,lat in coords]
xs, ys = [p[0] for p in xy], [p[1] for p in xy]
scale = min((WORLD_W-2*MARGIN)/(max(xs)-min(xs)), (WORLD_H-2*MARGIN)/(max(ys)-min(ys)))
cx, cy = (min(xs)+max(xs))/2, (min(ys)+max(ys))/2
TRACK = [((x-cx)*scale+WORLD_W/2, (y-cy)*scale+WORLD_H/2) for x,y in xy]
for _ in range(2):
    out=[]
    for i,p in enumerate(TRACK):
        q=TRACK[(i+1)%len(TRACK)]
        out += [(.75*p[0]+.25*q[0],.75*p[1]+.25*q[1]),
                (.25*p[0]+.75*q[0],.25*p[1]+.75*q[1])]
    TRACK=out
SEG=[]; CUM=[0.0]
for i,p in enumerate(TRACK):
    q=TRACK[(i+1)%len(TRACK)]
    dx,dy=q[0]-p[0],q[1]-p[1]
    L=math.hypot(dx,dy); tx,ty=dx/L,dy/L
    SEG.append((p[0],p[1],dx,dy,L,tx,ty,math.atan2(dy,dx)))
    CUM.append(CUM[-1]+L)
TRACK_LEN=CUM[-1]

def clamp(x,a,b): return max(a,min(b,x))
def wrap(a): return (a+math.pi)%(2*math.pi)-math.pi

def track_point(progress):
    p=progress%TRACK_LEN
    i=max(0,min(len(SEG)-1,bisect.bisect_right(CUM,p)-1))
    x,y,dx,dy,L,tx,ty,h=SEG[i]
    t=(p-CUM[i])/L
    return x+dx*t,y+dy*t,h,i,tx,ty

def nearest(x,y,last=None):
    ids=range(len(SEG)) if last is None else ((last+d)%len(SEG) for d in range(-10,11))
    best=None
    for i in ids:
        x1,y1,dx,dy,L,tx,ty,h=SEG[i]
        t=clamp(((x-x1)*dx+(y-y1)*dy)/(L*L),0,1)
        px,py=x1+t*dx,y1+t*dy
        ox,oy=x-px,y-py
        d2=ox*ox+oy*oy
        cross_track=tx*oy-ty*ox
        item=(d2,cross_track,CUM[i]+t*L,i,h,tx,ty,px,py)
        if best is None or d2<best[0]: best=item
    if last is not None and best[0]>(ROAD_W*5)**2:
        return nearest(x,y,None)
    return best

@dataclass
class Car:
    genome: object
    net: object
    x: float
    y: float
    h: float
    vx: float=0.
    vy: float=0.
    omega: float=0.
    steer_angle: float=0.
    last: float=0.
    total: float=0.
    seg: int=0
    wall_hits: int=0
    grass_time: float=0.
    edge_cost: float=0.
    collisions: int=0
    recoveries: int=0
    assist_time: float=0.
    stall: float=0.
    recovery: float=0.
    start_rank: int=1
    lane: float=0.
    active: bool=True

def local(c):
    f=(math.cos(c.h),math.sin(c.h)); r=(-f[1],f[0])
    return c.vx*f[0]+c.vy*f[1], c.vx*r[0]+c.vy*r[1], f, r

def car_radius_axis(c,nx,ny):
    f=(math.cos(c.h),math.sin(c.h)); r=(-f[1],f[0])
    return CAR_L/2*abs(f[0]*nx+f[1]*ny)+CAR_W/2*abs(r[0]*nx+r[1]*ny)

def collide(a,b):
    fa=(math.cos(a.h),math.sin(a.h)); ra=(-fa[1],fa[0])
    fb=(math.cos(b.h),math.sin(b.h)); rb=(-fb[1],fb[0])
    dx,dy=b.x-a.x,b.y-a.y
    overlap=1e9; normal=None
    for nx,ny in (fa,ra,fb,rb):
        o=car_radius_axis(a,nx,ny)+car_radius_axis(b,nx,ny)-abs(dx*nx+dy*ny)
        if o<=0: return False
        if o<overlap:
            overlap=o
            if dx*nx+dy*ny<0: nx,ny=-nx,-ny
            normal=(nx,ny)
    nx,ny=normal
    corr=(overlap+.03)*.51
    a.x-=nx*corr; a.y-=ny*corr
    b.x+=nx*corr; b.y+=ny*corr
    rvx,rvy=b.vx-a.vx,b.vy-a.vy
    vn=rvx*nx+rvy*ny
    if vn<0:
        j=-(1.05)*vn/2
        a.vx-=nx*j; a.vy-=ny*j
        b.vx+=nx*j; b.vy+=ny*j
        # Mild tangential friction keeps side-to-side contact from becoming pinball.
        tx,ty=-ny,nx
        vt=rvx*tx+rvy*ty
        jt=clamp(-vt/2,-abs(j)*.22,abs(j)*.22)
        a.vx-=tx*jt; a.vy-=ty*jt
        b.vx+=tx*jt; b.vy+=ty*jt
    a.omega*=.82; b.omega*=.82
    return True

def physics(c,steer,drive,handbrake=0.,dt=DT):
    steer=clamp(steer,-1,1); drive=clamp(drive,-1,1); handbrake=clamp(handbrake,0,1)
    long,lat,f,r=local(c)
    if drive>=0:
        long+=ACCEL*drive*dt
    else:
        p=-drive
        if long>3: long-=BRAKE*p*dt
        else: long-=REV_ACCEL*p*dt
    if abs(long)>1e-6:
        decel=(4.+.0005*long*long)*dt
        long=math.copysign(max(0,abs(long)-decel),long)
    long=clamp(long,-MAX_REV,MAX_FWD)
    c.vx=f[0]*long+r[0]*lat; c.vy=f[1]*long+r[1]*lat
    ratio=min(1,abs(long)/MAX_FWD)
    maxsteer=STEER_LOW*(1-ratio)+STEER_HIGH*ratio
    target=steer*maxsteer
    c.steer_angle+=clamp(target-c.steer_angle,-STEER_RATE*dt,STEER_RATE*dt)
    target_yaw=(long/WHEELBASE)*math.tan(c.steer_angle)*TURN_GAIN if abs(long)>2 else 0
    if handbrake: target_yaw*=1+.22*handbrake
    c.omega+=(target_yaw-c.omega)*min(1,9*dt)
    c.omega*=math.exp(-.55*dt)
    c.h=wrap(c.h+c.omega*dt)

    f=(math.cos(c.h),math.sin(c.h)); r=(-f[1],f[0])
    long2=c.vx*f[0]+c.vy*f[1]; lat2=c.vx*r[0]+c.vy*r[1]
    ratio=min(1,abs(long2)/MAX_FWD)
    grip=(GRIP_LOW*(1-ratio)+GRIP_HIGH*ratio)*max(.28,1-STEER_GRIP_DROP*abs(steer)*ratio-.68*handbrake)
    lat2*=math.exp(-grip*dt)
    scrub=(.07*abs(lat2)+1.55*abs(steer)*ratio+5.5*handbrake*ratio)*dt
    long2=math.copysign(max(0,abs(long2)-scrub),long2)
    c.vx=f[0]*long2+r[0]*lat2; c.vy=f[1]*long2+r[1]*lat2
    c.x+=c.vx*dt; c.y+=c.vy*dt

    n=nearest(c.x,c.y,c.seg); c.seg=n[3]
    cross_track=n[1]
    edge=max(0,abs(cross_track)-ROAD_HALF*.68)
    c.edge_cost+=edge*dt
    # AI track-discipline guard: keep the whole car on asphalt. Fitness penalizes every intervention.
    ai_limit=ROAD_HALF-CAR_W*.55
    if abs(cross_track)>ai_limit:
        left=(-n[6],n[5]);sg=1 if cross_track>=0 else -1;outward=(left[0]*sg,left[1]*sg)
        excess=abs(cross_track)-ai_limit
        c.x-=outward[0]*(excess+.02);c.y-=outward[1]*(excess+.02)
        vn=c.vx*outward[0]+c.vy*outward[1]
        if vn>0:c.vx-=outward[0]*vn*1.08;c.vy-=outward[1]*vn*1.08
        c.vx-=outward[0]*.8;c.vy-=outward[1]*.8
        c.assist_time+=dt
        n=nearest(c.x,c.y,c.seg);c.seg=n[3];cross_track=n[1]
    if abs(cross_track)>ROAD_HALF:
        factor=math.exp(-2.9*dt)
        c.vx*=factor; c.vy*=factor
        c.grass_time+=dt
    left=(-n[6],n[5]); sg=1 if cross_track>=0 else -1
    outward=(left[0]*sg,left[1]*sg)
    ff=(math.cos(c.h),math.sin(c.h)); rr=(-ff[1],ff[0])
    extent=CAR_L/2*abs(ff[0]*outward[0]+ff[1]*outward[1])+CAR_W/2*abs(rr[0]*outward[0]+rr[1]*outward[1])
    allowed=BARRIER_HALF-extent
    if abs(cross_track)>allowed:
        pen=abs(cross_track)-allowed
        c.x-=outward[0]*(pen+.35); c.y-=outward[1]*(pen+.35)
        vn=c.vx*outward[0]+c.vy*outward[1]
        if vn>0:
            c.vx-=outward[0]*vn*1.15; c.vy-=outward[1]*vn*1.15
        c.vx-=outward[0]*5.5; c.vy-=outward[1]*5.5
        c.omega*=.45; c.steer_angle*=.7
        c.wall_hits+=1
        n=nearest(c.x,c.y,c.seg); c.seg=n[3]
    return n

def traffic_features(c,cars):
    _,_,f,r=local(c)
    front_a=999.; front_s=0.; closing=0.
    left_pressure=0.; right_pressure=0.
    own_long=local(c)[0]
    for o in cars:
        if o is c: continue
        dx,dy=o.x-c.x,o.y-c.y
        a=dx*f[0]+dy*f[1]
        s=dx*r[0]+dy*r[1]
        if 0<a<72 and abs(s)<ROAD_HALF*1.35 and a<front_a:
            front_a=a; front_s=s
            other_long=local(o)[0]
            closing=own_long-other_long
        if -18<a<24 and abs(s)<CAR_W*2.4:
            w=max(0,1-abs(a)/24)*max(0,1-abs(s)/(CAR_W*2.4))
            if s<0: left_pressure=max(left_pressure,w)
            else: right_pressure=max(right_pressure,w)
    prox=0. if front_a>=999 else clamp(1-front_a/72,0,1)
    lat=0. if front_a>=999 else clamp(front_s/(ROAD_HALF*1.25),-1,1)
    closing_n=0. if front_a>=999 else clamp(closing/MAX_FWD,-1,1)
    side=clamp(left_pressure-right_pressure,-1,1)
    return prox,lat,closing_n,side

def sensors(c,cars):
    n=nearest(c.x,c.y,c.seg); c.seg=n[3]
    long,lat,_,_=local(c); speed=math.hypot(c.vx,c.vy)
    out=[speed/MAX_FWD,clamp(long/MAX_FWD,-1,1),clamp(lat/(MAX_FWD*.4),-1,1),clamp(n[1]/ROAD_HALF,-1,1)]
    for d in (20,55,115):
        x,y,_,_,_,_=track_point(n[2]+d)
        a=wrap(math.atan2(y-c.y,x-c.x)-c.h)
        out.extend((math.sin(a),math.cos(a)))
    *_,h1,_,_,_=track_point(n[2]+55)
    *_,h2,_,_,_=track_point(n[2]+135)
    cur=wrap(h2-h1)
    out.extend((math.sin(cur),math.cos(cur)))
    out.extend(traffic_features(c,cars))
    return out[:N_INPUT],n

def base_control(c):
    n=nearest(c.x,c.y,c.seg); c.seg=n[3]
    speed=math.hypot(c.vx,c.vy)
    look=17+.17*speed
    px,py,_,_,tx,ty=track_point(n[2]+look)
    left=(-ty,tx); lane_px=c.lane*ROAD_HALF
    target_x,target_y=px+left[0]*lane_px,py+left[1]*lane_px
    err=wrap(math.atan2(target_y-c.y,target_x-c.x)-c.h)
    cross_err=n[1]-lane_px
    corr=-math.atan2(1.45*cross_err,speed+16)
    steer=clamp((err+corr)/.32,-1,1)
    _,_,h0,_,_,_=track_point(n[2]+28)
    _,_,h1,_,_,_=track_point(n[2]+85)
    _,_,h2,_,_,_=track_point(n[2]+165)
    cur=max(abs(wrap(h1-h0)),abs(wrap(h2-h1)))
    target=max(50,140-74*min(1,cur/1.45)-min(18,abs(err)*18+max(0,abs(cross_err)-ROAD_HALF*.55)*.8))
    return steer,target,n

def drive_for(speed,target):
    if speed<target-4: return min(1,(target-speed)/22+.25)
    if speed>target+1.5: return -min(1,(speed-target)/19+.25)
    return .08

@dataclass
class Genome:
    nodes:dict
    conns:list
    fitness:float=0.
    adjusted:float=0.

innov={}
next_innov=0
next_node=FIRST_HIDDEN

def innovation(a,b):
    global next_innov
    if (a,b) not in innov:
        innov[a,b]=next_innov; next_innov+=1
    return innov[a,b]

def fresh():
    nodes={i:0. for i in range(N_INPUT+1)} | {OUT_STEER:1.,OUT_PACE:1.}
    con=[]
    for a in range(N_INPUT+1):
        for b in (OUT_STEER,OUT_PACE):
            con.append({'a':a,'b':b,'w':random.gauss(0,.07),'enabled':True,'innovation':innovation(a,b)})
    return Genome(nodes,con)

def clone(g): return Genome(dict(g.nodes),[dict(c) for c in g.conns])

def mutate(g):
    global next_node
    for c in g.conns:
        if random.random()<.86: c['w']=clamp(c['w']+random.gauss(0,.20),-5,5)
        if random.random()<.035: c['w']=random.uniform(-1.5,1.5)
    if random.random()<.16:
        existing={(c['a'],c['b']) for c in g.conns}; ids=list(g.nodes)
        for _ in range(60):
            a,b=random.sample(ids,2)
            if g.nodes[a]<g.nodes[b] and (a,b) not in existing and b>=OUT_STEER:
                g.conns.append({'a':a,'b':b,'w':random.uniform(-1.2,1.2),'enabled':True,'innovation':innovation(a,b)})
                break
    if random.random()<.075:
        enabled=[c for c in g.conns if c['enabled']]
        if enabled:
            c=random.choice(enabled); c['enabled']=False
            n=next_node; next_node+=1
            g.nodes[n]=(g.nodes[c['a']]+g.nodes[c['b']])/2
            g.conns.extend([
                {'a':c['a'],'b':n,'w':1.,'enabled':True,'innovation':innovation(c['a'],n)},
                {'a':n,'b':c['b'],'w':c['w'],'enabled':True,'innovation':innovation(n,c['b'])}
            ])
    return g

def distance(a,b):
    A={c['innovation']:c for c in a.conns}; B={c['innovation']:c for c in b.conns}
    match=set(A)&set(B)
    wd=sum(abs(A[i]['w']-B[i]['w']) for i in match)/len(match) if match else 0
    xor=set(A)^set(B); m=min(max(A,default=0),max(B,default=0))
    ex=sum(i>m for i in xor)
    return ex/max(25,len(A),len(B))+(len(xor)-ex)/max(25,len(A),len(B))+.38*wd

def crossover(a,b):
    if b.fitness>a.fitness: a,b=b,a
    A={c['innovation']:c for c in a.conns}; B={c['innovation']:c for c in b.conns}
    con=[]
    for i,c in A.items():
        x=dict(B[i] if i in B and random.random()<.5 else c)
        if i in B and (not c['enabled'] or not B[i]['enabled']) and random.random()<.75: x['enabled']=False
        con.append(x)
    ids={i for c in con for i in (c['a'],c['b'])}
    nodes={i:a.nodes.get(i,b.nodes.get(i,.5)) for i in ids}
    for i in range(FIRST_HIDDEN): nodes.setdefault(i,0. if i<=BIAS_NODE else 1.)
    return Genome(nodes,con)

def compile_net(g):
    inc={}
    for c in g.conns:
        if c['enabled']: inc.setdefault(c['b'],[]).append((c['a'],c['w']))
    return [(n,inc.get(n,())) for n,l in sorted(g.nodes.items(),key=lambda x:(x[1],x[0])) if n>N_INPUT]

def activate(net,x):
    v={i:x[i] for i in range(N_INPUT)}
    v[BIAS_NODE]=1.
    for n,incs in net:
        v[n]=math.tanh(sum(v.get(a,0)*w for a,w in incs))
    return v.get(OUT_STEER,0),v.get(OUT_PACE,0)

def agent_control(c,cars):
    x,_=sensors(c,cars)
    trim,pace=activate(c.net,x)
    base,target,_=base_control(c)
    prox,front_lat,closing,side=x[-4:]
    # Evolved network can change line substantially and slow strongly for traffic.
    steer=clamp(base+(.22+.18*prox)*trim,-1,1)
    target*=.92+.14*((pace+1)/2)  # preserve the proven solo pace band
    target=clamp(target,32,145)
    # Learned traffic features drive the residual; these guards only prevent obviously wasteful contact/off-track states.
    target-=prox*(46+82*max(0,closing))
    if prox>.22:
        if abs(front_lat)>.08:
            away=-math.copysign(1.,front_lat)
        elif abs(side)>.06:
            away=math.copysign(1.,side)
        elif abs(x[3])>.08:
            away=-math.copysign(1.,x[3])
        else:
            away=1.
        steer=clamp(steer+away*.42*((prox-.22)/.78)+.12*side,-1,1)
    edge=max(0.,(abs(x[3])-.58)/.42)
    if edge>0:
        steer=clamp(steer-math.copysign(.52*edge,x[3]),-1,1)
        target*=max(.55,1-.42*edge)
    if prox>.72 and closing>.01:
        target=min(target,24)
    return steer,drive_for(math.hypot(c.vx,c.vy),target)

def spawn_pack(genomes,rng):
    order=list(genomes)
    rng.shuffle(order)
    cars=[]
    for slot,g in enumerate(order):
        row=slot//2; side=-1 if slot%2==0 else 1
        back=row*22
        x,y,h,seg,tx,ty=track_point(20-back)
        left=(-ty,tx)
        lane=rng.uniform(-.06,.06)
        c=Car(g,compile_net(g),x+left[0]*side*4.25,y+left[1]*side*4.25,h,seg=seg,start_rank=slot+1,lane=lane)
        n=nearest(c.x,c.y,c.seg); c.last=n[2]
        cars.append(c)
    return cars

def run_pack(genomes,seed,horizon=1200):
    rng=random.Random(seed)
    cars=spawn_pack(genomes,rng)
    active_contacts=set()
    for _ in range(horizon):
        controls=[]
        for c in cars:
            speed=math.hypot(c.vx,c.vy)
            c.stall=c.stall+DT if speed<3.5 else max(0,c.stall-3*DT)
            if c.stall>1.7 and c.recovery<=0:
                c.recovery=1.05; c.recoveries+=1; c.stall=0
            steer,drive=agent_control(c,cars)
            if c.recovery>0:
                if c.recovery>.58: steer,drive=0,-1
                else: steer=base_control(c)[0]; drive=.75
                c.recovery-=DT
            controls.append((steer,drive))
        for c,(steer,drive) in zip(cars,controls):
            n2=physics(c,steer,drive)
            dp=n2[2]-c.last
            if dp<-TRACK_LEN/2: dp+=TRACK_LEN
            elif dp>TRACK_LEN/2: dp-=TRACK_LEN
            if dp>-45: c.total+=dp
            c.last=n2[2]
        contacts=set()
        for i in range(len(cars)):
            for j in range(i+1,len(cars)):
                if collide(cars[i],cars[j]):
                    pair=(i,j); contacts.add(pair)
                    if pair not in active_contacts:
                        cars[i].collisions+=1; cars[j].collisions+=1
        active_contacts=contacts
    ranked=sorted(cars,key=lambda c:c.total,reverse=True)
    final_rank={id(c):i+1 for i,c in enumerate(ranked)}
    scores={}
    for c in cars:
        laps=c.total/TRACK_LEN
        overtake=c.start_rank-final_rank[id(c)]
        # Off-track and contact penalties are intentionally strong.
        fitness=(c.total*2.4 + laps*850 + overtake*60
                 - c.grass_time*150 - c.edge_cost*15.0
                 - c.wall_hits*320 - c.collisions*120 - c.recoveries*180 - c.assist_time*55)
        scores[id(c.genome)]=(fitness,c)
    return scores,cars

def seed_from_previous():
    """Map the strong v3.1 12-input champions into the 16-input traffic-aware graph."""
    src=json.loads((ROOT/'training-seed-v31.json').read_text())
    seeds=[]
    def remap(n):
        if n<=11:return n
        if n==12:return BIAS_NODE
        if n==13:return OUT_STEER
        if n==14:return OUT_PACE
        return n+4
    for champ in src['champions']:
        nodes={i:0. for i in range(N_INPUT+1)}|{OUT_STEER:1.,OUT_PACE:1.}
        for k,v in champ.get('hidden',{}).items():nodes[remap(int(k))]=v
        con=[]
        seen=set()
        for a,b,w in champ['connections']:
            a,b=remap(a),remap(b);seen.add((a,b));con.append({'a':a,'b':b,'w':w,'enabled':True,'innovation':innovation(a,b)})
        # Traffic inputs exist from generation zero but start neutral, so solo driving is preserved.
        for a in range(12,16):
            for b in (OUT_STEER,OUT_PACE):
                if (a,b) not in seen:con.append({'a':a,'b':b,'w':0.,'enabled':True,'innovation':innovation(a,b)})
        seeds.append(Genome(nodes,con))
    return seeds

def initial_population():
    bases=seed_from_previous();pop=[clone(g) for g in bases]
    i=0
    while len(pop)<POP:
        child=clone(bases[i%len(bases)])
        # Multiple light mutations retain driving competence while opening traffic behavior.
        mutate(child)
        if random.random()<.65:mutate(child)
        pop.append(child);i+=1
    random.shuffle(pop)
    return pop

def speciate(pop,t=2.45):
    groups=[]
    for g in sorted(pop,key=lambda x:-x.fitness):
        s=next((s for s in groups if distance(g,s[0])<t),None)
        if s: s.append(g)
        else: groups.append([g])
    return groups

def evaluate_population(pop,gen):
    agg={id(g):[] for g in pop}
    for rnd in range(PACK_ROUNDS):
        order=pop[:]
        random.Random(SEED+gen*1009+rnd*97).shuffle(order)
        for p in range(0,len(order),PACK_SIZE):
            group=order[p:p+PACK_SIZE]
            if len(group)<PACK_SIZE:
                group += order[:PACK_SIZE-len(group)]
            scores,_=run_pack(group,SEED+gen*10007+rnd*911+p,1200)
            for g in group:
                if id(g) in scores:
                    agg[id(g)].append(scores[id(g)][0])
    for g in pop:
        vals=agg[id(g)]
        g.fitness=statistics.mean(vals) if vals else -1e9

def evolve():
    pop=initial_population()
    started=time.time()
    for gen in range(GENERATIONS):
        evaluate_population(pop,gen)
        groups=speciate(pop)[:12]
        for s in groups:
            s.sort(key=lambda g:-g.fitness)
            for g in s: g.adjusted=g.fitness/len(s)
        pool=[g for s in groups for g in s]
        floor=min(g.adjusted for g in pool)
        weights=[max(.001,g.adjusted-floor+.001) for g in pool]
        nxt=[clone(s[0]) for s in groups]
        while len(nxt)<POP:
            a=random.choices(pool,weights=weights,k=1)[0]
            b=random.choices(pool,weights=weights,k=1)[0]
            child=crossover(a,b) if random.random()<.74 else clone(a)
            nxt.append(mutate(child))
        best=max(pop,key=lambda g:g.fitness)
        print(f'gen {gen+1:02d}/{GENERATIONS} species={len(groups):02d} best={best.fitness:.1f} mean={statistics.mean(g.fitness for g in pop):.1f} elapsed={time.time()-started:.1f}s')
        pop=nxt

    # More expensive final ranking: three different 9-car pack contexts per genome.
    evaluate_population(pop,GENERATIONS+1)
    pop.sort(key=lambda g:-g.fitness)
    chosen=[]
    for g in pop:
        if not chosen or all(distance(g,h)>.07 for h in chosen):
            chosen.append(g)
        if len(chosen)==9: break
    for g in pop:
        if len(chosen)==9: break
        if g not in chosen: chosen.append(g)
    return chosen

def verify_individual(g,seconds=90):
    rng=random.Random(SEED+777)
    c=spawn_pack([g],rng)[0]
    cars=[c]
    for _ in range(int(seconds/DT)):
        s,d=agent_control(c,cars)
        n2=physics(c,s,d)
        dp=n2[2]-c.last
        if dp<-TRACK_LEN/2: dp+=TRACK_LEN
        elif dp>TRACK_LEN/2: dp-=TRACK_LEN
        if dp>-45:c.total+=dp
        c.last=n2[2]
    return {'laps':c.total/TRACK_LEN,'wall_hits':c.wall_hits,'grass_s':c.grass_time,'collisions':0,'recoveries':c.recoveries,'assist_s':c.assist_time}

def verify_pack(champs,seconds=120,seed=SEED+9911):
    scores,cars=run_pack(champs,seed,int(seconds/DT))
    return cars

def export(champs):
    out={
        'version':'neat-race-v3.2',
        'seed':SEED,
        'track':'istanbul-park-v3',
        'population':POP,
        'generations':GENERATIONS,
        'pack_size':PACK_SIZE,
        'pack_rounds_per_generation':PACK_ROUNDS,
        'input_count':N_INPUT,
        'bias_node':BIAS_NODE,
        'output_nodes':[OUT_STEER,OUT_PACE],
        'controller':'NEAT residual steering + pace; co-evolved in 9-car traffic packs',
        'steering_config':{
            'steer_low':STEER_LOW,'steer_high':STEER_HIGH,'turn_gain':TURN_GAIN,'steer_rate':STEER_RATE,
            'grip_low':GRIP_LOW,'grip_high':GRIP_HIGH,'steer_grip_drop':STEER_GRIP_DROP
        },
        'champions':[]
    }
    for i,g in enumerate(champs,1):
        hidden={str(k):round(v,3) for k,v in g.nodes.items() if k>=FIRST_HIDDEN}
        con=[[c['a'],c['b'],round(c['w'],4)] for c in g.conns if c['enabled']]
        v=verify_individual(g)
        out['champions'].append({
            'name':f'NEAT-{i:03d}','fitness':round(g.fitness,3),
            'hidden':hidden,'connections':con,
            'verification':{k:round(x,3) if isinstance(x,float) else x for k,x in v.items()}
        })
        print(f"NEAT-{i:03d} solo laps={v['laps']:.3f} grass={v['grass_s']:.2f}s walls={v['wall_hits']}")
    pack=verify_pack(champs)
    print('PACK')
    for i,c in enumerate(pack,1):
        print(f"NEAT-{i:03d} laps={c.total/TRACK_LEN:.3f} grass={c.grass_time:.2f}s walls={c.wall_hits} collisions={c.collisions} recoveries={c.recoveries} assist={c.assist_time:.2f}s")
    out['pack_verification']={
        'seconds':120,
        'mean_laps':round(statistics.mean(c.total/TRACK_LEN for c in pack),3),
        'min_laps':round(min(c.total/TRACK_LEN for c in pack),3),
        'max_laps':round(max(c.total/TRACK_LEN for c in pack),3),
        'total_grass_s':round(sum(c.grass_time for c in pack),3),
        'total_wall_hits':sum(c.wall_hits for c in pack),
        'total_collisions':sum(c.collisions for c in pack)//2,
        'total_recoveries':sum(c.recoveries for c in pack),
        'total_assist_s':round(sum(c.assist_time for c in pack),3)
    }
    (ROOT/'neat-champions.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
    return out

if __name__=='__main__':
    export(evolve())
