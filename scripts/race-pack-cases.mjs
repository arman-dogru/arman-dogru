import {rng} from './race-evaluation.mjs';
import {TRAINING_OBJECTIVE} from './race-fitness.mjs';

// One reproducible grid generator for release checks and known regressions.
// Final unseen validation uses seeds that are not part of roster selection.
export const REGRESSION_SEEDS=[17389,24071,48163];
export const UNSEEN_SEEDS=[60217,72931,88079];
export function packCases(drivers,{seeds=REGRESSION_SEEDS,stress=false}={}){
  const jobs=[];
  for(const seed of seeds)for(const scenario of ['grid','parked-grid','blocked','recovery']){
    const random=rng(seed),order=[...drivers];
    for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
    for(let i=0;i<order.length;i+=9)jobs.push({drivers:Array.from({length:9},(_,j)=>order[(i+j)%order.length]),options:{seed:seed+i,scenario,seconds:TRAINING_OBJECTIVE.episode_seconds,blockerProgress:stress?150+random()*2500:[42,350,1100,1700,2400][(seed+i/9)%5]}});
  }
  return jobs;
}
