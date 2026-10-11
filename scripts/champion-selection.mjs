import {championRoster} from '../race-roster.js';
import {packCases,REGRESSION_SEEDS} from './race-pack-cases.mjs';

export const CHAMPION_SELECTION_SEEDS=[701,809,911,1201,2027,...REGRESSION_SEEDS];

// Fitness stays distance-only. Completion is the same release requirement used
// for the mixed roster, now tested with nine copies of each candidate policy.
export async function selectGridChampion(drivers,run){
  const rejected=[];
  const summarize=results=>({runs:results.length,starts:results.reduce((n,r)=>n+r.rows.length,0),finished:results.reduce((n,r)=>n+r.finished,0),contacts:results.reduce((n,r)=>n+r.contacts,0),wall_hits:results.reduce((n,r)=>n+r.wall_hits,0),max_stall_s:Math.max(...results.map(r=>r.max_stall_s))});
  for(const candidate of [...drivers].sort((a,b)=>b.fitness-a.fitness)){
    const clones=championRoster(drivers,candidate.name);
    const screen=await Promise.all([42,350,1100,1700,2400].map(blockerProgress=>run(clones.slice(0,9),{scenario:'blocked',blockerProgress,seed:19001,seconds:150})));
    if(screen.some(r=>r.finished!==r.rows.length)){
      rejected.push({name:candidate.name,generation:candidate.generation,fitness:candidate.fitness,stage:'blocked-grid screen',...summarize(screen)});
      continue;
    }
    const results=await Promise.all(packCases(clones,{seeds:CHAMPION_SELECTION_SEEDS}).map(job=>run(job.drivers,job.options)));
    const validation=summarize(results);
    if(validation.finished===validation.starts)return{mode:'single-champion',selection:'highest distance-fitness policy completing cloned-grid release races',champion_name:candidate.name,generation:candidate.generation,fitness:candidate.fitness,selection_seeds:CHAMPION_SELECTION_SEEDS,validation,rejected};
    rejected.push({name:candidate.name,generation:candidate.generation,fitness:candidate.fitness,stage:'full cloned-grid release',...validation});
  }
  throw new Error('No archived policy completed the cloned-grid release checks; roster was not overwritten');
}
