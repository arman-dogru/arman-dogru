#!/usr/bin/env python3
"""Continue the Istanbul Park traffic-trained NEAT population and export a rated driver roster."""
import importlib.util, json, pathlib, random, statistics, sys, time

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('neat_core',ROOT/'scripts'/'train_neat.py')
m=importlib.util.module_from_spec(spec);sys.modules['neat_core']=m;spec.loader.exec_module(m)

CONTINUATION_GENERATIONS=20
POP=36
PACK_ROUNDS=2
m.STEER_LOW=.78;m.STEER_HIGH=.47;m.TURN_GAIN=.81;m.STEER_RATE=7.45
m.PACK_ROUNDS=PACK_ROUNDS

AI_DRIVERS=[
('Max Vectorstappen',98),('LaMDA Norris',95),('Charles LeClaude',94),('Opus Piastri',93),
('Gemini Russell',92),('Fernando Algonso',91),('Lewis Hamiltoken',90),('Carlos Cosainz',89),
('Kimi Anthropelli',87),('Alexa Albon',86),('Pierre Grokly',85),('Isack Hadjarvis',84),
('Oliver BERTman',83),('Estebot Ocon',82),('Nico Hulkenbyte',81),('Gabriel Botoleto',80),
('Sergio Perplexez',79),('Valtteri Chatbottas',78),('Llama Lawson',76),('Franco Copilinto',75),
('Arvid Lindbard',73),('Lance StroLLM',72)]

def genome_from(champ):
    nodes={i:0. for i in range(m.N_INPUT+1)}|{m.OUT_STEER:1.,m.OUT_PACE:1.}
    for k,v in champ.get('hidden',{}).items():nodes[int(k)]=v
    con=[{'a':a,'b':b,'w':w,'enabled':True,'innovation':m.innovation(a,b)} for a,b,w in champ['connections']]
    return m.Genome(nodes,con)

def clone_keep(g):
    h=m.clone(g);h.fitness=g.fitness;return h

def initial_population():
    seed=json.loads((ROOT/'training-seed-v32.json').read_text())
    bases=[genome_from(c) for c in seed['champions']]
    pop=[m.clone(g) for g in bases];i=0
    while len(pop)<POP:
        g=m.clone(bases[i%len(bases)]);m.mutate(g)
        if random.random()<.7:m.mutate(g)
        pop.append(g);i+=1
    random.shuffle(pop);return pop

def evolve():
    pop=initial_population();checkpoints=[];started=time.time()
    for gen in range(1,CONTINUATION_GENERATIONS+1):
        m.evaluate_population(pop,100+gen);pop.sort(key=lambda g:-g.fitness);best=pop[0]
        verify=m.verify_individual(best,120)
        if verify['laps']>=3.0:checkpoints.append((gen,clone_keep(best),verify))
        groups=m.speciate(pop)[:12]
        for s in groups:
            s.sort(key=lambda g:-g.fitness)
            for g in s:g.adjusted=g.fitness/len(s)
        pool=[g for s in groups for g in s];floor=min(g.adjusted for g in pool);weights=[max(.001,g.adjusted-floor+.001) for g in pool]
        nxt=[clone_keep(pop[0]),clone_keep(pop[1])]+[clone_keep(s[0]) for s in groups[:10]]
        while len(nxt)<POP:
            a=random.choices(pool,weights=weights,k=1)[0];b=random.choices(pool,weights=weights,k=1)[0]
            child=m.crossover(a,b) if random.random()<.78 else m.clone(a);nxt.append(m.mutate(child))
        print(f'gen {gen:02d}/{CONTINUATION_GENERATIONS} best={best.fitness:.1f} solo={verify["laps"]:.3f} saved={len(checkpoints)} elapsed={time.time()-started:.1f}s')
        pop=nxt
    m.evaluate_population(pop,999);pop.sort(key=lambda g:-g.fitness)
    finals=[]
    for g in pop:
        if not finals or all(m.distance(g,h)>.05 for h in finals):finals.append(g)
        if len(finals)>=9:break
    for g in finals:checkpoints.append((CONTINUATION_GENERATIONS+1,clone_keep(g),m.verify_individual(g,120)))
    return checkpoints

def payload(g):
    return {'hidden':{str(k):round(v,3) for k,v in g.nodes.items() if k>=m.FIRST_HIDDEN},'connections':[[c['a'],c['b'],round(c['w'],4)] for c in g.conns if c['enabled']]}

def export(checkpoints):
    by_gen={}
    for item in checkpoints:
        gen,g,v=item
        if gen not in by_gen or g.fitness>by_gen[gen][1].fitness:by_gen[gen]=item
    ordered=list(by_gen.values())
    ordered.sort(key=lambda x:(x[0],x[1].fitness))
    # Later generations go to higher-rated names. Multiple drivers may share the final generation.
    drivers=[]
    for name,rating in AI_DRIVERS:
        strength=(rating-72)/(98-72);idx=round(strength*(len(ordered)-1));gen,g,v=ordered[idx]
        drivers.append({'name':name,'rating':rating,'generation':24+gen,**payload(g),'verification':{k:round(x,3) if isinstance(x,float) else x for k,x in v.items()}})
    out={'version':'neat-race-v4','seed':m.SEED,'track':'istanbul-park-v4','population':POP,'base_generation':24,'continuation_generations':CONTINUATION_GENERATIONS,'pack_rounds_per_generation':PACK_ROUNDS,'input_count':m.N_INPUT,'bias_node':m.BIAS_NODE,'output_nodes':[m.OUT_STEER,m.OUT_PACE],'controller':'traffic-aware NEAT residual steering + pace, trained in randomized 9-car packs','steering_config':{'steer_low':m.STEER_LOW,'steer_high':m.STEER_HIGH,'turn_gain':m.TURN_GAIN,'steer_rate':m.STEER_RATE,'grip_low':m.GRIP_LOW,'grip_high':m.GRIP_HIGH,'steer_grip_drop':m.STEER_GRIP_DROP},'drivers':drivers,'checkpoints':[{'generation':24+gen,'laps120':round(v['laps'],3)} for gen,_,v in ordered]}
    (ROOT/'neat-champions.json').write_text(json.dumps(out,separators=(',',':'))+'\n')

if __name__=='__main__':export(evolve())
