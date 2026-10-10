#!/usr/bin/env python3
import json, math, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import scripts.train_neat as m

DATA=json.loads((ROOT/'neat-champions.json').read_text())
LANES=[-.20,.14,-.08,.22,0,.08,-.16,.18,-.04]
SKILLS=[1.02,1.00,.98,1.04,.97,1.01,.99,1.03,.96]

class G: pass

def genome(cg):
    g=G();g.nodes={i:0. for i in range(13)}|{13:1.,14:1.}
    for k,v in cg.get('hidden',{}).items():g.nodes[int(k)]=v
    g.conns=[{'a':a,'b':b,'w':w,'enabled':True,'innovation':i} for i,(a,b,w) in enumerate(cg['connections'])]
    return g
NETS=[m.compile_net(genome(c)) for c in DATA['champions']]

def traffic(c,cars):
    f=(math.cos(c.h),math.sin(c.h));r=(-f[1],f[0]);slow=0.;avoid=0.
    for o in cars:
        if o is c:continue
        dx=o.x-c.x;dy=o.y-c.y;a=dx*f[0]+dy*f[1];s=dx*r[0]+dy*r[1]
        if 0<a<44 and abs(s)<m.CAR_W*1.9:
            slow=max(slow,(44-a)/44);avoid+=(-1 if s>0 else 1)*(44-a)/44*.20
    return avoid,slow

def control(i,c,cars):
    x,_=m.sensors(c);trim,pace=m.activate(NETS[i],x);base,target,n=m.base_control(c)
    lane=LANES[i]*m.ROAD_HALF;cross_err=n[1]-lane;speed=math.hypot(c.vx,c.vy)
    base+=max(-.12,min(.12,-cross_err/(m.ROAD_HALF*8)))
    avoid,slow=traffic(c,cars);steer=max(-1,min(1,base+.22*trim+avoid))
    target*=SKILLS[i]*(.92+.14*((pace+1)/2));target-=slow*42;target=max(38,min(145,target))
    return steer,m.drive_for(speed,target)

def collide(a,b):
    dx=b.x-a.x;dy=b.y-a.y;d=math.hypot(dx,dy);min_d=m.CAR_W*1.05
    if d<=1e-6 or d>=min_d:return
    nx=dx/d;ny=dy/d;over=min_d-d;a.x-=nx*over*.5;a.y-=ny*over*.5;b.x+=nx*over*.5;b.y+=ny*over*.5
    rvx=b.vx-a.vx;rvy=b.vy-a.vy;vn=rvx*nx+rvy*ny
    if vn<0:
        j=-(1.08)*vn/2;a.vx-=nx*j;a.vy-=ny*j;b.vx+=nx*j;b.vy+=ny*j

def main(seconds=100):
    cars=[]
    for i in range(9):
        row=i//2;side=-1 if i%2==0 else 1;p=m.track_point(20-row*22);n=m.nearest(p[0],p[1],p[3]);left=(-n[6],n[5])
        c=m.Car(p[0]+left[0]*side*4.2,p[1]+left[1]*side*4.2,p[2],seg=p[3]);q=m.nearest(c.x,c.y,c.seg);c.last=q[2];c.recovery=0.;c.stuck=0.;cars.append(c)
    for _ in range(int(seconds/m.DT)):
        cmds=[]
        for i,c in enumerate(cars):
            s,d=control(i,c,cars);spd=math.hypot(c.vx,c.vy);c.stuck=c.stuck+m.DT if spd<4 else max(0,c.stuck-3*m.DT)
            if c.stuck>1.4 and c.recovery<=0:c.recovery=1.0;c.stuck=0
            if c.recovery>0:
                if c.recovery>.55:s,d=0,-1
                else:s,d=m.base_control(c)[0],.75
                c.recovery-=m.DT
            cmds.append((s,d))
        for c,(s,d) in zip(cars,cmds):
            n2=m.physics(c,s,d);dp=n2[2]-c.last
            if dp<-m.TRACK_LEN/2:dp+=m.TRACK_LEN
            elif dp>m.TRACK_LEN/2:dp-=m.TRACK_LEN
            if dp>-45:c.total+=dp
            c.last=n2[2]
        for _ in range(2):
            for i in range(len(cars)):
                for j in range(i+1,len(cars)):collide(cars[i],cars[j])
    laps=[]
    for i,c in enumerate(cars):
        lap=c.total/m.TRACK_LEN;laps.append(lap);print(f'NEAT-{i+1:03d} laps={lap:.2f} hits={c.wall_hits} grass={c.grass_time:.1f}s recovery_left={max(0,c.recovery):.2f}')
        if c.recovery>0 or lap<1.8:raise SystemExit(f'validation failed for NEAT-{i+1:03d}')
    print('min_laps',min(laps),'max_laps',max(laps))

if __name__=='__main__':main()
