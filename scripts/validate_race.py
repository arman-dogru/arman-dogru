#!/usr/bin/env python3
"""Headless regression test for the shipped nine-car NEAT pack."""
import json, statistics, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import train_neat as m

DATA=json.loads((ROOT/'neat-champions.json').read_text())

def genome(cg):
    nodes={i:0. for i in range(m.N_INPUT+1)}|{m.OUT_STEER:1.,m.OUT_PACE:1.}
    for k,v in cg.get('hidden',{}).items():nodes[int(k)]=float(v)
    con=[]
    for i,(a,b,w) in enumerate(cg['connections']):
        con.append({'a':int(a),'b':int(b),'w':float(w),'enabled':True,'innovation':i})
    return m.Genome(nodes,con,fitness=float(cg.get('fitness',0)))

CHAMPS=[genome(c) for c in DATA['champions']]

def run(seed,seconds=120):
    cars=m.verify_pack(CHAMPS,seconds,seed=seed)
    laps=[c.total/m.TRACK_LEN for c in cars]
    collisions=sum(c.collisions for c in cars)//2
    grass=sum(c.grass_time for c in cars)
    walls=sum(c.wall_hits for c in cars)
    recoveries=sum(c.recoveries for c in cars)
    assists=sum(c.assist_time for c in cars)
    print(f'seed={seed} mean={statistics.mean(laps):.3f} min={min(laps):.3f} max={max(laps):.3f} collisions={collisions} grass={grass:.3f}s walls={walls} recoveries={recoveries} assist={assists:.3f}s')
    for i,c in enumerate(cars,1):
        print(f'  NEAT-{i:03d} laps={c.total/m.TRACK_LEN:.3f} collisions={c.collisions} assist={c.assist_time:.2f}s')
    if grass>1e-9:raise SystemExit('validation failed: an AI reached grass')
    if walls:raise SystemExit('validation failed: barrier contact')
    if min(laps)<2.75:raise SystemExit('validation failed: insufficient minimum progress')
    if collisions>250:raise SystemExit('validation failed: excessive pack contact')
    if recoveries>1:raise SystemExit('validation failed: excessive stuck recovery')

if __name__=='__main__':
    for seed in (m.SEED+9911,m.SEED+12001,m.SEED+13007):run(seed)
