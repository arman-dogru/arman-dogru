#!/usr/bin/env python3
"""Browser-equivalent Istanbul Park pack check for the v4 roster."""
import importlib.util, json, math, pathlib, statistics, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('neat_core',ROOT/'scripts'/'train_neat.py')
m=importlib.util.module_from_spec(spec);sys.modules['neat_core']=m;spec.loader.exec_module(m)
m.STEER_LOW=.78;m.STEER_HIGH=.47;m.TURN_GAIN=.81;m.STEER_RATE=7.45
DATA=json.loads((ROOT/'neat-champions.json').read_text())
BANDS=[[0,1],[2,3],[4,5],[6,8],[9,11],[12,14],[15,17],[18,19],[20,21]]
LANES=[-.28,.28,-.18,.18,-.08,.08,-.24,.24,0]

def genome(d):
    nodes={i:0. for i in range(m.N_INPUT+1)}|{m.OUT_STEER:1.,m.OUT_PACE:1.}
    for k,v in d.get('hidden',{}).items():nodes[int(k)]=v
    con=[{'a':a,'b':b,'w':w,'enabled':True,'innovation':i} for i,(a,b,w) in enumerate(d['connections'])]
    g=m.Genome(nodes,con);g.name=d['name'];g.rating=d['rating'];return g

POOL=[genome(d) for d in DATA['drivers']]
FIELD=[POOL[b[0]] for b in BANDS]

def spawn(genomes,rng):
    cars=[]
    for slot,g in enumerate(genomes):
        row=slot//2;side=-1 if slot%2==0 else 1;back=row*30
        x,y,h,seg,tx,ty=m.track_point(20-back);left=(-ty,tx)
        c=m.Car(g,m.compile_net(g),x+left[0]*side*4.4,y+left[1]*side*4.4,h,seg=seg,start_rank=slot+1,lane=LANES[slot])
        n=m.nearest(c.x,c.y,c.seg);c.last=n[2];c.skill=.92+max(0,min(1,(g.rating-72)/26))*.10;cars.append(c)
    return cars
m.spawn_pack=spawn

def control(c,cars):
    x,_=m.sensors(c,cars);trim,pace=m.activate(c.net,x);base,target,_=m.base_control(c)
    prox,front_lat,closing,side=x[-4:];steer=m.clamp(base+(.22+.18*prox)*trim,-1,1)
    target*=c.skill*(.92+.14*((pace+1)/2));target=m.clamp(target,32,145);target-=prox*(65+130*max(0,closing))
    if prox>.12:
        if abs(front_lat)>.08:away=-math.copysign(1.,front_lat)
        elif abs(side)>.06:away=math.copysign(1.,side)
        elif abs(x[3])>.08:away=-math.copysign(1.,x[3])
        else:away=1.
        steer=m.clamp(steer+away*.78*((prox-.12)/.88)+.22*side,-1,1)
    edge=max(0.,(abs(x[3])-.58)/.42)
    if edge>0:
        steer=m.clamp(steer-math.copysign(.52*edge,x[3]),-1,1);target*=max(.55,1-.42*edge)
    if prox>.55 and closing>.01:target=min(target,15)
    return steer,m.drive_for(math.hypot(c.vx,c.vy),target)
m.agent_control=control

cars=m.verify_pack(FIELD,120,m.SEED+12000)
laps=[c.total/m.TRACK_LEN for c in cars]
contacts=sum(c.collisions for c in cars)//2
grass=sum(c.grass_time for c in cars);walls=sum(c.wall_hits for c in cars);recoveries=sum(c.recoveries for c in cars)
for c in sorted(cars,key=lambda x:-x.total):print(f'{c.genome.name:22s} rating={c.genome.rating:2d} laps={c.total/m.TRACK_LEN:.3f} contacts={c.collisions}')
print(f'mean={statistics.mean(laps):.3f} min={min(laps):.3f} max={max(laps):.3f} contacts={contacts} grass={grass:.2f}s walls={walls} recoveries={recoveries}')
if min(laps)<2.85 or grass>0 or walls>0 or recoveries>0 or contacts>100:raise SystemExit('v4 race validation failed')
