#!/usr/bin/env python3
import bisect, json, math, random, statistics, time
from dataclasses import dataclass
from pathlib import Path

SEED=20261010
random.seed(SEED)
POP=24
GENERATIONS=24
PACK_SIZE=6
PACK_ROUNDS=1
N_INPUT=20
BIAS=N_INPUT
OUT_STEER=N_INPUT+1
OUT_PACE=N_INPUT+2
FIRST_HIDDEN=N_INPUT+3
WORLD_W,WORLD_H,MARGIN=1400.,840.,76.
CAR_W,CAR_L=8.,16.
ROAD_W=CAR_W*5.4
ROAD_HALF=ROAD_W/2
RUNOFF_HALF=ROAD_HALF+CAR_W*3.4
WHEELBASE=12.
DT=1/30
MAX_FWD,MAX_REV=154.,32.
ACCEL,BRAKE,REV_ACCEL=86.,205.,45.
STEER_LOW,STEER_HIGH=.79,.49
TURN_GAIN=.84
STEER_RATE=8.2
GRIP_LOW,GRIP_HIGH,STEER_GRIP_DROP=10.8,5.8,.24
LANES=[-.62,0,.62]
ROOT=Path(__file__).resolve().parents[1]

def clamp(x,a,b): return max(a,min(b,x))
def wrap(a): return (a+math.pi)%(2*math.pi)-math.pi

data=json.loads((ROOT/'race-track-istanbul.json').read_text())
coords=data['coordinates'][:-1]
lon0=sum(p[0] for p in coords)/len(coords); lat0=sum(p[1] for p in coords)/len(coords); cc=math.cos(math.radians(lat0))
xy=[((lon-lon0)*111320*cc, -(lat-lat0)*110540) for lon,lat in coords]
xs=[p[0] for p in xy]; ys=[p[1] for p in xy]
scale=min((WORLD_W-2*MARGIN)/(max(xs)-min(xs)),(WORLD_H-2*MARGIN)/(max(ys)-min(ys)))
cx=(min(xs)+max(xs))/2; cy=(min(ys)+max(ys))/2
TRACK=[((x-cx)*scale+WORLD_W/2,(y-cy)*scale+WORLD_H/2) for x,y in xy]
for _ in range(2):
    out=[]
    for i,p in enumerate(TRACK):
        q=TRACK[(i+1)%len(TRACK)]
        out.extend([(.75*p[0]+.25*q[0],.75*p[1]+.25*q[1]),(.25*p[0]+.75*q[0],.25*p[1]+.75*q[1])])
    TRACK=out
SEG=[]; CUM=[0.]
for i,p in enumerate(TRACK):
    q=TRACK[(i+1)%len(TRACK)]
    dx,dy=q[0]-p[0],q[1]-p[1]; L=math.hypot(dx,dy); tx,ty=dx/L,dy/L
    SEG.append((p[0],p[1],dx,dy,L,tx,ty,math.atan2(dy,dx))); CUM.append(CUM[-1]+L)
TRACK_LEN=CUM[-1]

def track_point(progress):
    p=progress%TRACK_LEN; i=max(0,min(len(SEG)-1,bisect.bisect_right(CUM,p)-1))
    x,y,dx,dy,L,tx,ty,h=SEG[i]; t=(p-CUM[i])/L
    return x+dx*t,y+dy*t,h,i,tx,ty

def nearest(x,y,last=None):
    ids=range(len(SEG)) if last is None else ((last+d)%len(SEG) for d in range(-14,15))
    best=None
    for i in ids:
        x1,y1,dx,dy,L,tx,ty,h=SEG[i]; t=clamp(((x-x1)*dx+(y-y1)*dy)/(L*L),0,1); px,py=x1+t*dx,y1+t*dy; ox,oy=x-px,y-py; d2=ox*ox+oy*oy
        item=(d2,tx*oy-ty*ox,CUM[i]+t*L,i,h,tx,ty,px,py)
        if best is None or d2<best[0]: best=item
    if last is not None and best[0]>(ROAD_W*6)**2: return nearest(x,y,None)
    return best

@dataclass
class Genome:
    levels: dict
    conns: list
    fitness: float=0.
    adjusted: float=0.

innov={}; next_innov=0; next_node=FIRST_HIDDEN

def innovation(a,b):
    global next_innov
    if (a,b) not in innov: innov[a,b]=next_innov; next_innov+=1
    return innov[a,b]

def fresh():
    levels={i:0. for i in range(N_INPUT+1)}|{OUT_STEER:1.,OUT_PACE:1.}
    con=[]
    for a in range(N_INPUT+1):
        for b in (OUT_STEER,OUT_PACE):
            con.append({'a':a,'b':b,'w':random.gauss(0,.035),'enabled':True,'innovation':innovation(a,b)})
    return Genome(levels,con)

def clone(g): return Genome(dict(g.levels),[dict(c) for c in g.conns],g.fitness,g.adjusted)

def compile_net(g):
    inc={}
    for c in g.conns:
        if c['enabled']: inc.setdefault(c['b'],[]).append((c['a'],c['w']))
    return [(n,inc.get(n,())) for n,l in sorted(g.levels.items(),key=lambda x:(x[1],x[0])) if n>N_INPUT]

def activate(net,x):
    v={i:x[i] for i in range(N_INPUT)}; v[BIAS]=1.
    for n,incs in net: v[n]=math.tanh(sum(v.get(a,0)*w for a,w in incs))
    return v.get(OUT_STEER,0),v.get(OUT_PACE,0)

def mutate(g):
    global next_node
    for c in g.conns:
        if random.random()<.90: c['w']=clamp(c['w']+random.gauss(0,.12),-4.5,4.5)
        if random.random()<.006: c['w']=random.uniform(-1,1)
    if len(g.conns)<54 and random.random()<.02:
        existing={(c['a'],c['b']) for c in g.conns}; ids=list(g.levels)
        for _ in range(80):
            a,b=random.sample(ids,2)
            if g.levels[a]<g.levels[b] and (a,b) not in existing and b>N_INPUT:
                g.conns.append({'a':a,'b':b,'w':random.uniform(-.7,.7),'enabled':True,'innovation':innovation(a,b)}); break
    if len(g.levels)-FIRST_HIDDEN<2 and random.random()<.006:
        enabled=[c for c in g.conns if c['enabled']]
        if enabled:
            c=random.choice(enabled); c['enabled']=False; n=next_node; next_node+=1
            g.levels[n]=(g.levels[c['a']]+g.levels[c['b']])/2
            g.conns += [
                {'a':c['a'],'b':n,'w':1.,'enabled':True,'innovation':innovation(c['a'],n)},
                {'a':n,'b':c['b'],'w':c['w'],'enabled':True,'innovation':innovation(n,c['b'])}]
    return g

def distance(a,b):
    A={c['innovation']:c for c in a.conns}; B={c['innovation']:c for c in b.conns}; match=set(A)&set(B)
    wd=sum(abs(A[i]['w']-B[i]['w']) for i in match)/len(match) if match else 0; xor=set(A)^set(B); m=min(max(A,default=0),max(B,default=0)); ex=sum(i>m for i in xor)
    return ex/max(30,len(A),len(B))+(len(xor)-ex)/max(30,len(A),len(B))+.32*wd

def crossover(a,b):
    if b.fitness>a.fitness: a,b=b,a
    A={c['innovation']:c for c in a.conns}; B={c['innovation']:c for c in b.conns}; con=[]
    for i,c in A.items(): con.append(dict(B[i] if i in B and random.random()<.5 else c))
    ids={n for c in con for n in (c['a'],c['b'])}; levels={n:a.levels.get(n,b.levels.get(n,.5)) for n in ids}
    for n in range(FIRST_HIDDEN): levels.setdefault(n,0. if n<=BIAS else 1.)
    return Genome(levels,con)

@dataclass
class Car:
    genome: Genome
    net: object
    x: float; y: float; h: float
    vx: float=0.; vy: float=0.; omega: float=0.; steer_angle: float=0.
    last: float=0.; total: float=0.; seg: int=0; lane: float=0.
    grass: float=0.; wall: int=0; collisions: int=0; stall: float=0.; backward: float=0.
    start_rank: int=1
    lane_idx: int=0

def local(c):
    f=(math.cos(c.h),math.sin(c.h)); r=(-f[1],f[0]); return c.vx*f[0]+c.vy*f[1],c.vx*r[0]+c.vy*r[1],f,r

def radius(c,nx,ny):
    f=(math.cos(c.h),math.sin(c.h)); r=(-f[1],f[0]); return CAR_L/2*abs(f[0]*nx+f[1]*ny)+CAR_W/2*abs(r[0]*nx+r[1]*ny)

def collide(a,b):
    fa=(math.cos(a.h),math.sin(a.h)); ra=(-fa[1],fa[0]); fb=(math.cos(b.h),math.sin(b.h)); rb=(-fb[1],fb[0]); dx,dy=b.x-a.x,b.y-a.y; overlap=1e9; N=None
    for nx,ny in (fa,ra,fb,rb):
        o=radius(a,nx,ny)+radius(b,nx,ny)-abs(dx*nx+dy*ny)
        if o<=0:return False
        if o<overlap:
            overlap=o; N=(nx,ny) if dx*nx+dy*ny>=0 else (-nx,-ny)
    nx,ny=N; corr=(overlap+.02)*.505; a.x-=nx*corr;a.y-=ny*corr;b.x+=nx*corr;b.y+=ny*corr
    rvx,rvy=b.vx-a.vx,b.vy-a.vy; vn=rvx*nx+rvy*ny
    if vn<0:
        j=-.72*vn/2; a.vx-=nx*j;a.vy-=ny*j;b.vx+=nx*j;b.vy+=ny*j
    a.omega*=.76;b.omega*=.76; return True

def physics(c,steer,drive):
    steer=clamp(steer,-1,1); drive=clamp(drive,-1,1); long,lat,f,r=local(c)
    if drive>=0: long+=ACCEL*drive*DT
    elif long>3: long-=BRAKE*(-drive)*DT
    else: long-=REV_ACCEL*(-drive)*DT
    if abs(long)>1e-6:
        decel=(3.8+.00042*long*long)*DT; long=math.copysign(max(0,abs(long)-decel),long)
    long=clamp(long,-MAX_REV,MAX_FWD); c.vx=f[0]*long+r[0]*lat;c.vy=f[1]*long+r[1]*lat
    ratio=min(1,abs(long)/MAX_FWD); maxsteer=STEER_LOW*(1-ratio)+STEER_HIGH*ratio; target=steer*maxsteer; c.steer_angle+=clamp(target-c.steer_angle,-STEER_RATE*DT,STEER_RATE*DT)
    target_yaw=(long/WHEELBASE)*math.tan(c.steer_angle)*TURN_GAIN if abs(long)>2 else 0; c.omega+=(target_yaw-c.omega)*min(1,10*DT); c.omega*=math.exp(-.48*DT); c.h=wrap(c.h+c.omega*DT)
    f=(math.cos(c.h),math.sin(c.h));r=(-f[1],f[0]); long2=c.vx*f[0]+c.vy*f[1];lat2=c.vx*r[0]+c.vy*r[1];ratio=min(1,abs(long2)/MAX_FWD);grip=(GRIP_LOW*(1-ratio)+GRIP_HIGH*ratio)*max(.35,1-STEER_GRIP_DROP*abs(steer)*ratio);lat2*=math.exp(-grip*DT);long2=math.copysign(max(0,abs(long2)-(0.05*abs(lat2)+1.15*abs(steer)*ratio)*DT),long2);c.vx=f[0]*long2+r[0]*lat2;c.vy=f[1]*long2+r[1]*lat2;c.x+=c.vx*DT;c.y+=c.vy*DT
    n=nearest(c.x,c.y,c.seg);c.seg=n[3];cross=n[1]
    if abs(cross)>ROAD_HALF:
        factor=math.exp(-2.1*DT);c.vx*=factor;c.vy*=factor;c.grass+=DT
    left=(-n[6],n[5]);sg=1 if cross>=0 else -1;ox,oy=left[0]*sg,left[1]*sg;allowed=RUNOFF_HALF-radius(c,ox,oy)
    if abs(cross)>allowed:
        pen=abs(cross)-allowed;c.x-=ox*(pen+.08);c.y-=oy*(pen+.08);vn=c.vx*ox+c.vy*oy
        if vn>0:c.vx-=ox*vn*1.15;c.vy-=oy*vn*1.15
        c.vx*=.75;c.vy*=.75;c.omega*=.45;c.wall+=1;n=nearest(c.x,c.y,c.seg);c.seg=n[3]
    return n

def traffic(c,cars):
    _,_,f,r=local(c);own=local(c)[0];fa=999.;fs=0.;closing=0.;lp=rp=rear=0.
    for o in cars:
        if o is c:continue
        dx,dy=o.x-c.x,o.y-c.y;a=dx*f[0]+dy*f[1];s=dx*r[0]+dy*r[1]
        if 0<a<96 and abs(s)<ROAD_HALF*1.1 and a<fa:fa=a;fs=s;closing=own-local(o)[0]
        if -24<a<36 and abs(s)<CAR_W*3.1:
            w=max(0,1-abs(a)/36)*max(0,1-abs(s)/(CAR_W*3.1))
            if s<0:lp=max(lp,w)
            else:rp=max(rp,w)
        if -55<a<0 and abs(s)<CAR_W*2.4:rear=max(rear,max(0,1-(-a)/55))
    prox=0 if fa>=999 else clamp(1-fa/96,0,1);lat=0 if fa>=999 else clamp(fs/(ROAD_HALF*1.1),-1,1);close=0 if fa>=999 else clamp(closing/MAX_FWD,-1,1)
    return prox,lat,close,lp,rp,rear

def sensors(c,cars,n):
    long,lat,_,_=local(c);speed=math.hypot(c.vx,c.vy);out=[speed/MAX_FWD,clamp(long/MAX_FWD,-1,1),clamp(lat/(MAX_FWD*.35),-1,1),clamp(n[1]/ROAD_HALF,-1.3,1.3)]
    for d in (18,42,82,142):
        x,y,_,_,_,_=track_point(n[2]+d);a=wrap(math.atan2(y-c.y,x-c.x)-c.h);out.extend((math.sin(a),math.cos(a)))
    h0=track_point(n[2]+35)[2];h1=track_point(n[2]+90)[2];h2=track_point(n[2]+165)[2];out.extend((math.sin(wrap(h1-h0)),math.sin(wrap(h2-h1))))
    out.extend(traffic(c,cars));return out[:N_INPUT]

def drive_for(speed,target):
    if speed<target-3:return min(1,.30+(target-speed)/22)
    if speed>target+1:return -min(1,.22+(speed-target)/18)
    return .10

def control(c,cars,n):
    x=sensors(c,cars,n); trim,pace=activate(c.net,x); speed=math.hypot(c.vx,c.vy)
    hs=[track_point(n[2]+d)[2] for d in (24,58,105,165,220)]
    curv=max(abs(wrap(hs[i+1]-hs[i])) for i in range(4));curve=clamp(curv/1.22,0,1)
    target_lane=LANES[c.lane_idx]*(1-.48*curve)
    c.lane += clamp(target_lane-c.lane,-.8*DT,.8*DT)
    look=20+.16*speed;p=track_point(n[2]+look);left=(-p[5],p[4]);lane_px=c.lane*ROAD_HALF*.88;tx,ty=p[0]+left[0]*lane_px,p[1]+left[1]*lane_px
    err=wrap(math.atan2(ty-c.y,tx-c.x)-c.h);cross_err=n[1]-lane_px;corr=-math.atan2(2.0*cross_err,speed+18)
    steer=clamp((err+corr)/.35 + .055*trim,-1,1)
    target=142-94*curve-min(25,abs(err)*24+max(0,abs(cross_err)-ROAD_HALF*.60)*.7);target=clamp(target,44,142)
    target*=.985+.03*((pace+1)/2)
    front=None;best=999
    for o in cars:
        if o is c or o.lane_idx!=c.lane_idx:continue
        gap=(o.last-c.last)%TRACK_LEN
        if 1<gap<TRACK_LEN/2 and gap<best:front=o;best=gap
    if front:
        fv=max(0,local(front)[0]);safe=CAR_L+26+speed*.78;rel=max(0,speed-fv);ttc=best/max(1,rel) if rel>0 else 99
        if best<safe*2.8:target=min(target,max(6,fv+(best-safe)*.78))
        if best<safe or ttc<1.55:target=min(target,max(0,fv-(safe-best)*2.0))
    own_cross=n[1]
    for o in cars:
        if o is c:continue
        on=nearest(o.x,o.y,o.seg);gap=(on[2]-n[2])%TRACK_LEN
        if 0<gap<70 and abs(on[1]-own_cross)<CAR_W*1.55:
            ov=max(0,local(o)[0]);safe2=CAR_L+22+speed*.48
            target=min(target,max(0,ov+(gap-safe2)*.65))
            if gap<safe2*.78:target=min(target,max(0,ov-18))
    return steer,drive_for(speed,target)

def spawn(genomes,rng):
    order=list(genomes);rng.shuffle(order);cars=[]
    for slot,g in enumerate(order):
        row=slot//2;lane_idx=slot%3;back=row*42;p=track_point(26-back);left=(-p[5],p[4]);lane=LANES[lane_idx];off=lane*ROAD_HALF*.88
        c=Car(g,compile_net(g),p[0]+left[0]*off,p[1]+left[1]*off,p[2],seg=p[3],lane=lane,start_rank=slot+1,lane_idx=lane_idx);c.last=nearest(c.x,c.y,c.seg)[2];cars.append(c)
    return cars

def run_pack(genomes,seed,horizon=900):
    cars=spawn(genomes,random.Random(seed));contacts=set()
    for _ in range(horizon):
        controls=[]
        for c in cars:
            n=nearest(c.x,c.y,c.seg);c.seg=n[3];controls.append(control(c,cars,n))
        for c,(s,d) in zip(cars,controls):
            n=physics(c,s,d);dp=n[2]-c.last
            if dp<-TRACK_LEN/2:dp+=TRACK_LEN
            elif dp>TRACK_LEN/2:dp-=TRACK_LEN
            if dp<-.5:c.backward+=-dp
            if dp>-55:c.total+=dp
            c.last=n[2];speed=math.hypot(c.vx,c.vy);c.stall+=DT if speed<4 else -min(c.stall,2*DT)
        new=set()
        for i in range(len(cars)):
            for j in range(i+1,len(cars)):
                if collide(cars[i],cars[j]):
                    pair=(i,j);new.add(pair)
                    if pair not in contacts:cars[i].collisions+=1;cars[j].collisions+=1
        contacts=new
    ranked=sorted(cars,key=lambda c:c.total,reverse=True);rank={id(c):i+1 for i,c in enumerate(ranked)};scores={}
    for c in cars:
        laps=c.total/TRACK_LEN;overtake=c.start_rank-rank[id(c)]
        clean=800 if c.grass<.1 and c.wall==0 else 0
        fitness=c.total*3.0 + laps*1100 + overtake*100 + clean - c.grass*520 - c.wall*1450 - c.collisions*520 - c.backward*18 - max(0,c.stall-1.5)*180
        scores[id(c.genome)]=(fitness,c)
    return scores,cars

def speciate(pop,t=1.65):
    groups=[]
    for g in sorted(pop,key=lambda x:-x.fitness):
        s=next((s for s in groups if distance(g,s[0])<t),None)
        (s.append(g) if s else groups.append([g]))
    return groups

def eval_pop(pop,gen):
    agg={id(g):[] for g in pop}
    for rnd in range(PACK_ROUNDS):
        order=pop[:];random.Random(SEED+gen*997+rnd*67).shuffle(order)
        for p in range(0,len(order),PACK_SIZE):
            group=order[p:p+PACK_SIZE]
            if len(group)<PACK_SIZE:group+=order[:PACK_SIZE-len(group)]
            scores,_=run_pack(group,SEED+gen*10007+rnd*911+p,360)
            for g in group:agg[id(g)].append(scores[id(g)][0])
    for g in pop:g.fitness=statistics.mean(agg[id(g)])

def evolve():
    pop=[fresh() for _ in range(POP)]
    for i,g in enumerate(pop[4:],4):
        mutate(g)
        if i%3==0:mutate(g)
    t=time.time()
    for gen in range(GENERATIONS):
        eval_pop(pop,gen);pop.sort(key=lambda g:-g.fitness);groups=speciate(pop)[:14]
        pool=[]
        for s in groups:
            s.sort(key=lambda g:-g.fitness)
            for g in s:g.adjusted=g.fitness/max(1,len(s))
            pool.extend(s)
        floor=min(g.adjusted for g in pool);weights=[max(.001,g.adjusted-floor+.001) for g in pool]
        nxt=[clone(pop[0]),clone(pop[1])]+[clone(s[0]) for s in groups[:8]]
        while len(nxt)<POP:
            a=random.choices(pool,weights=weights,k=1)[0];b=random.choices(pool,weights=weights,k=1)[0];child=crossover(a,b) if random.random()<.76 else clone(a);nxt.append(mutate(child))
        if gen%4==0 or gen==GENERATIONS-1:
            best=pop[0];_,cars=run_pack([best],SEED+70000+gen,1200);c=cars[0]
            print(f'g{gen+1:02d}/{GENERATIONS} best={best.fitness:.0f} solo_laps={c.total/TRACK_LEN:.2f} grass={c.grass:.2f} wall={c.wall} species={len(groups)} t={time.time()-t:.1f}s')
        pop=nxt
    eval_pop(pop,999);pop.sort(key=lambda g:-g.fitness)
    chosen=[]
    for g in pop:
        if not chosen or all(distance(g,h)>.035 for h in chosen):chosen.append(g)
        if len(chosen)>=22:break
    while len(chosen)<22:chosen.append(pop[len(chosen)%len(pop)])
    return chosen

NAMES=[('Max Vectorstappen',98),('LaMDA Norris',96),('Charles LeClaude',95),('Opus Piastri',94),('Gemini Russell',93),('Fernando Algonso',92),('Lewis Hamiltoken',91),('Carlos Cosainz',90),('Kimi Anthropelli',89),('Alexa Albon',88),('Pierre Grokly',87),('Isack Hadjarvis',86),('Oliver BERTman',85),('Estebot Ocon',84),('Nico Hulkenbyte',83),('Gabriel Botoleto',82),('Sergio Perplexez',81),('Valtteri Chatbottas',80),('Llama Lawson',78),('Franco Copilinto',76),('Arvid Lindbard',74),('Lance StroLLM',72)]

def payload(g):return {'hidden':{str(k):round(v,4) for k,v in g.levels.items() if k>=FIRST_HIDDEN},'connections':[[c['a'],c['b'],round(c['w'],5)] for c in g.conns if c['enabled']]}

def export(champs):
    tests=[]
    for seed in (SEED+8801,SEED+8802):
        _,cars=run_pack(champs[:9],seed,int(60/DT));tests.append(cars)
    allcars=[c for t in tests for c in t]
    validation={'runs':2,'seconds_per_run':60,'mean_laps':round(statistics.mean(c.total/TRACK_LEN for c in allcars),3),'min_laps':round(min(c.total/TRACK_LEN for c in allcars),3),'total_grass_s':round(sum(c.grass for c in allcars),3),'total_wall_hits':sum(c.wall for c in allcars),'total_collisions':sum(c.collisions for c in allcars)//2,'force_field_assists':0}
    drivers=[]
    for (name,rating),g in zip(NAMES,champs):drivers.append({'name':name,'rating':rating,'generation':GENERATIONS,**payload(g)})
    out={'version':'neat-race-v5','seed':SEED,'track':'istanbul-park-v5','population':POP,'generations':GENERATIONS,'pack_size':PACK_SIZE,'pack_rounds_per_generation':PACK_ROUNDS,'input_count':N_INPUT,'bias_node':BIAS,'output_nodes':[OUT_STEER,OUT_PACE],'controller':'trajectory planner + adaptive cruise + NEAT residual steering/pace; co-evolved in traffic packs with no off-track position correction','road_width_cars':ROAD_W/CAR_W,'validation':validation,'drivers':drivers}
    (ROOT/'neat-champions-v5.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
    print('VALIDATION',json.dumps(validation))
    return out

if __name__=='__main__':export(evolve())
