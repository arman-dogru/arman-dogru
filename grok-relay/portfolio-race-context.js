// Public architecture of the committed v5 portfolio race, not an assertion about
// unfinished local training or a guarantee of optimal driving. See NEAT_RACE.md.
export const RACE_CONTEXT={
  name:'NEAT Grand Prix',
  source:'https://github.com/arman-dogru/arman-dogru/blob/main/NEAT_RACE.md',
  facts:[
    'An interactive ten-car, three-lap race at Istanbul Park, with the player racing nine AI drivers.',
    'Hybrid controller: a hand-designed trajectory planner follows racing corridors and adapts the line through corners; adaptive cruise and body-corridor checks manage traffic headway.',
    'The evolved NEAT residual policy adjusts steering trim and pace. It does not learn the whole driving task end to end.',
    'NEAT uses evolutionary selection of neural controllers, rather than gradient-based reinforcement learning. The training objective rewards driving performance; hand-designed planning supplies a useful baseline.',
    'All cars use the same vehicle physics, including steering, braking, grass drag, runoff and collisions. AI cars do not receive an asphalt teleport or hidden grass force-field.',
    'Hybrid design narrows the learned search problem and separates baseline navigation from learned adjustments. It does not establish globally optimal driving or solve every traffic scenario.'
  ]
};
