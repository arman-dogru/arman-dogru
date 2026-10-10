#!/usr/bin/env python3
"""Train the browser race opponents with a small self-contained NEAT implementation.

Circuit geometry: bacinger/f1-circuits (MIT), Intercity Istanbul Park.
The browser export intentionally contains only enabled runtime connections.
"""
import bisect,copy,json,math,random,statistics,urllib.request
from dataclasses import dataclass
from pathlib import Path

SEED=20261009;random.seed(SEED)
POP=36;GENERATIONS=18;N_INPUT=12;N_OUTPUT=2
WORLD_W=1000.;WORLD_H=600.;MARGIN=38.;CAR_W=12.;ROAD_W=CAR_W*3.5;ROAD_HALF=ROAD_W/2
DT=1/60;MAX_SPEED=300.;ENGINE=230.;BRAKE=360.
SOURCE='https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits/tr-2005.geojson'

def fetch_track():
    with urllib.request.urlopen(SOURCE,timeout=20) as r: coords=json.load(r)['features'][0]['geometry']['coordinates']
    if coords[0]==coords[-1]:coords=coords[:-1]
    lon0=sum(p[0] for p in coords)/len(coords);lat0=sum(p[1] for p in coords)/len(coords);c=math.cos(math.radians(lat0))
    xy=[((lon-lon0)*111320*c,-(lat-lat0)*110540) for lon,lat in coords];xs=[p[0] for p in xy];ys=[p[1] for p in xy]
    s=min((WORLD_W-2*MARGIN)/(max(xs)-min(xs)),(WORLD_H-2*MARGIN)/(max(ys)-min(ys)));cx=(min(xs)+max(xs))/2;cy=(min(ys)+max(ys))/2
    pts=[((x-cx)*s+WORLD_W/2,(y-cy)*s+WORLD_H/2) for x,y in xy]
    for _ in range(2):
        out=[]
        for i,p in enumerate(pts):
            q=pts[(i+1)%len(pts)];out.extend([(.75*p[0]+.25*q[0],.75*p[1]+.25*q[1]),(.25*p[0]+.75*q[0],.25*p[1]+.75*q[1])])
        pts=out
    return pts
TRACK=fetch_track();SEG=[];CUM=[0.]
for i,p in enumerate(TRACK):
    q=TRACK[(i+1)%len(TRACK)];dx=q[0]-p[0];dy=q[1]-p[1];L=math.hypot(dx,dy);tx=dx/L;ty=dy/L;SEG.append((p[0],p[1],dx,dy,L,tx,ty,math.atan2(dy,dx)));CUM.append(CUM[-1]+L)
TRACK_LEN=CUM[-1]
def wrap(a):return(a+math.pi)%(2*math.pi)-math.pi
def track_point(progress):
    p=progress%TRACK_LEN;i=max(0,min(len(SEG)-1,bisect.bisect_right(CUM,p)-1));x,y,dx,dy,L,tx,ty,h=SEG[i];t=(p-CUM[i])/L;return x+dx*t,y+dy*t,h,i
def nearest(x,y,last=None):
    ids=range(len(SEG)) if last is None else[(last+d)%len(SEG) for d in range(-8,9)];best=None
    for i in ids:
        x1,y1,dx,dy,L,tx,ty,h=SEG[i];t=max(0,min(1,((x-x1)*dx+(y-y1)*dy)/(L*L)));px=x1+t*dx;py=y1+t*dy;vx=x-px;vy=y-py;d2=vx*vx+vy*vy;cross=tx*vy-ty*vx
        if best is None or d2<best[0]:best=(d2,cross,CUM[i]+t*L,i,h,tx,ty)
    return nearest(x,y,None) if last is not None and best[0]>(ROAD_W*3)**2 else best

@dataclass
class Car:x:float;y:float;h:float;vx:float=0.;vy:float=0.;omega:float=0.;last:float=0.;total:float=0.;seg:int=0;hits:int=0

def inputs(c):
    n=nearest(c.x,c.y,c.seg);c.seg=n[3];speed=math.hypot(c.vx,c.vy);va=math.atan2(c.vy,c.vx) if speed>1 else c.h;slip=wrap(c.h-va)
    out=[speed/MAX_SPEED,max(-1,min(1,n[1]/ROAD_HALF)),math.sin(slip),math.cos(slip)]
    for d in(55,135,260):
        x,y,_,_=track_point(n[2]+d);a=wrap(math.atan2(y-c.y,x-c.x)-c.h);out.extend((math.sin(a),math.cos(a)))
    _,_,h1,_=track_point(n[2]+80);_,_,h2,_=track_point(n[2]+170);out.extend((math.sin(wrap(h2-h1)),math.cos(wrap(h2-h1))))
    return out[:12],n

def physics(c,steer,drive):
    steer=max(-1,min(1,steer));drive=max(-1,min(1,drive));speed=math.hypot(c.vx,c.vy);sn=min(1,speed/MAX_SPEED)
    speed=max(0,min(MAX_SPEED,speed+(ENGINE*max(0,drive)-BRAKE*max(0,-drive)-(18+.20*speed))*DT))
    gain=(1.75-.55*sn)*(.22+.78*min(1,speed/90));c.omega+=(steer*gain-c.omega)*min(1,5*DT);c.omega*=math.exp(-.45*DT);c.h=wrap(c.h+c.omega*DT)
    va=math.atan2(c.vy,c.vx) if speed>1 else c.h;slip=wrap(c.h-va);grip=max(.75,6.4-4.4*sn-2.2*abs(steer)*sn);va=wrap(va+slip*min(1,grip*DT));c.vx=math.cos(va)*speed;c.vy=math.sin(va)*speed;c.x+=c.vx*DT;c.y+=c.vy*DT
    n=nearest(c.x,c.y,c.seg);c.seg=n[3];allowed=ROAD_HALF-CAR_W*.52
    if abs(n[1])>allowed:
        side=1 if n[1]>0 else-1;nx=-n[6]*side;ny=n[5]*side;pen=abs(n[1])-allowed;c.x-=nx*pen;c.y-=ny*pen;vn=c.vx*nx+c.vy*ny
        if vn>0:c.vx-=nx*vn*1.35;c.vy-=ny*vn*1.35
        c.vx*=.97;c.vy*=.97;c.omega*=.72;c.hits+=1
    return n

@dataclass
class Genome:nodes:dict;conns:list;fitness:float=0.;adjusted:float=0.
innov={};next_innov=0;next_node=15
def innovation(a,b):
    global next_innov
    if(a,b)not in innov:innov[a,b]=next_innov;next_innov+=1
    return innov[a,b]
def fresh():
    nodes={i:0. for i in range(13)}|{13:1.,14:1.};steer={1:-2.1,4:.4,6:2.6,8:.6,10:.25,12:0};drive={0:-.8,5:.6,7:.4,9:.15,11:-.2,12:2.2};con=[]
    for a in range(13):
        for b,seed in((13,steer.get(a,0)),(14,drive.get(a,0))):con.append({'a':a,'b':b,'w':seed+random.gauss(0,.18),'enabled':True,'innovation':innovation(a,b)})
    return Genome(nodes,con)
def clone(g):return Genome(dict(g.nodes),[dict(c)for c in g.conns])
def mutate(g):
    global next_node
    for c in g.conns:
        if random.random()<.82:c['w']=max(-5,min(5,c['w']+random.gauss(0,.34)))
        if random.random()<.07:c['w']=random.uniform(-2.4,2.4)
    if random.random()<.22:
        existing={(c['a'],c['b'])for c in g.conns};ids=list(g.nodes)
        for _ in range(40):
            a,b=random.sample(ids,2)
            if g.nodes[a]<g.nodes[b]and(a,b)not in existing and b>12:g.conns.append({'a':a,'b':b,'w':random.uniform(-1.8,1.8),'enabled':True,'innovation':innovation(a,b)});break
    if random.random()<.10:
        enabled=[c for c in g.conns if c['enabled']]
        if enabled:
            c=random.choice(enabled);c['enabled']=False;n=next_node;next_node+=1;g.nodes[n]=(g.nodes[c['a']]+g.nodes[c['b']])/2;g.conns.extend([{'a':c['a'],'b':n,'w':1.,'enabled':True,'innovation':innovation(c['a'],n)},{'a':n,'b':c['b'],'w':c['w'],'enabled':True,'innovation':innovation(n,c['b'])}])
    return g
def distance(a,b):
    A={c['innovation']:c for c in a.conns};B={c['innovation']:c for c in b.conns};match=set(A)&set(B);wd=sum(abs(A[i]['w']-B[i]['w'])for i in match)/len(match)if match else 0;xor=set(A)^set(B);m=min(max(A,default=0),max(B,default=0));ex=sum(i>m for i in xor);return ex/max(20,len(A),len(B))+(len(xor)-ex)/max(20,len(A),len(B))+.42*wd
def crossover(a,b):
    if b.fitness>a.fitness:a,b=b,a
    A={c['innovation']:c for c in a.conns};B={c['innovation']:c for c in b.conns};con=[]
    for i,c in A.items():
        x=dict(B[i]if i in B and random.random()<.5 else c)
        if i in B and(not c['enabled']or not B[i]['enabled'])and random.random()<.75:x['enabled']=False
        con.append(x)
    ids={i for c in con for i in(c['a'],c['b'])};return Genome({i:a.nodes.get(i,b.nodes.get(i,.5))for i in ids},con)
def compile_net(g):
    inc={}
    for c in g.conns:
        if c['enabled']:inc.setdefault(c['b'],[]).append((c['a'],c['w']))
    return[(n,inc.get(n,()))for n,l in sorted(g.nodes.items(),key=lambda x:(x[1],x[0]))if n>12]
def activate(net,x):
    v={i:x[i]for i in range(12)};v[12]=1.
    for n,incs in net:v[n]=math.tanh(sum(v.get(a,0)*w for a,w in incs))
    return v.get(13,0),v.get(14,0)
def evaluate(g,seed,horizon=1050):
    rng=random.Random(seed);p=track_point(rng.uniform(0,TRACK_LEN*.10));c=Car(p[0],p[1],p[2]+rng.uniform(-.05,.05),seg=p[3]);n=nearest(c.x,c.y,c.seg);c.last=n[2];net=compile_net(g);reward=0;stall=0
    for _ in range(horizon):
        x,n=inputs(c);s,d=activate(net,x);n2=physics(c,s,d);dp=n2[2]-c.last
        if dp<-TRACK_LEN/2:dp+=TRACK_LEN
        elif dp>TRACK_LEN/2:dp-=TRACK_LEN
        if dp>-55:c.total+=dp
        c.last=n2[2];speed=math.hypot(c.vx,c.vy);reward+=max(-2,min(4.5,dp))*1.2+speed/MAX_SPEED*.035-abs(n2[1])/ROAD_HALF*.012;stall=stall+1 if speed<8 else max(0,stall-2)
        if stall>300:reward-=60;break
    return reward+c.total*1.4+max(0,c.total/TRACK_LEN)*900-c.hits*2.2
def speciate(pop,t=2.75):
    groups=[]
    for g in sorted(pop,key=lambda x:-x.fitness):
        s=next((s for s in groups if distance(g,s[0])<t),None)
        if s:s.append(g)
        else:groups.append([g])
    return groups
def evolve():
    pop=[mutate(fresh())for _ in range(POP)]
    for gen in range(GENERATIONS):
        seeds=(SEED+gen*31+3,SEED+gen*31+17)
        for g in pop:g.fitness=statistics.mean(evaluate(g,s)for s in seeds)
        groups=speciate(pop)[:12]
        for s in groups:
            s.sort(key=lambda g:-g.fitness)
            for g in s:g.adjusted=g.fitness/len(s)
        nxt=[clone(s[0])for s in groups];pool=[g for s in groups for g in s];weights=[max(.001,g.adjusted-min(x.adjusted for x in pool)+.001)for g in pool]
        while len(nxt)<POP:
            a=random.choices(pool,weights=weights,k=1)[0];b=random.choices(pool,weights=weights,k=1)[0];nxt.append(mutate(crossover(a,b)if random.random()<.72 else clone(a)))
        pop=nxt;print(f'gen {gen+1:02d}/{GENERATIONS} species={len(groups)} best={max(g.fitness for g in pool):.1f}')
    for g in pop:g.fitness=statistics.mean(evaluate(g,SEED+9000+i)for i in range(3))
    pop.sort(key=lambda g:-g.fitness);return pop[:7]
def export(champs):
    out={'version':'neat-race-v2','seed':SEED,'track':'istanbul-park','population':POP,'generations':GENERATIONS,'champions':[]}
    for i,g in enumerate(champs,1):
        hidden={str(k):round(v,3)for k,v in g.nodes.items()if k>14};con=[[c['a'],c['b'],round(c['w'],4)]for c in g.conns if c['enabled']];out['champions'].append({'name':f'NEAT-{i:03d}','fitness':round(g.fitness,3),'hidden':hidden,'connections':con})
    Path('neat-champions.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
if __name__=='__main__':
    champions=evolve();export(champions)
    for i,g in enumerate(champions,1):print(f'NEAT-{i:03d}: verification fitness {g.fitness:.1f}')
