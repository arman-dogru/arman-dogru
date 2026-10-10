# NEAT Grand Prix

The portfolio race is a 10-car top-down race at Istanbul Park. The player starts from the back and races nine AI drivers drawn from a 22-driver roster.

## v5 driver architecture

The earlier build used a traffic-aware NEAT residual controller over a low-level track follower. It also contained an AI-only asphalt correction: when an AI car crossed an edge threshold, the runtime moved it back toward the road and removed outward velocity. That made validation look cleaner than the actual controller behavior and could produce exactly the sticky, unnatural driving the UI was showing.

v5 removes that AI-only correction completely.

All cars now use the same vehicle physics. The AI stack is:

1. a progress-aware trajectory planner that targets one of three racing corridors and compresses the lateral offset through corners;
2. adaptive cruise / body-corridor safety that controls closing speed before cars overlap;
3. a trained NEAT residual policy for steering trim and pace adjustment; and
4. normal grass drag, runoff and physical boundary response shared with the player.

There is no AI position teleport, asphalt clamp, hidden grass force-field, or scripted reverse recovery in the v5 controller.

## Track and car model

The browser runs a fixed 120 Hz update with separate throttle, braking and reverse, speed-sensitive steering, lateral grip, controllable slip, handbrake rotation, grass drag, runoff, recoverable outer-boundary contact and oriented-body car-to-car collision.

The road was widened from 3.5 to **5.4 car widths**. That is deliberate: ten vehicles need enough physical room for multiple viable trajectories instead of being forced into repeated contact by geometry that is narrower than the traffic problem requires.

Istanbul Park remains the only circuit. The AI is trained and validated on the same pinned circuit geometry used by the browser.

## Training

`scripts/train_neat_v5.py` trains a 20-input residual policy in traffic packs. The deterministic planner is responsible for basic road following and safe longitudinal behavior; NEAT is asked to improve the trajectory rather than rediscover the entire driving task from scratch.

The exported roster in `neat-champions-v5.json` records:

- population: **24**
- generations: **24**
- traffic pack size: **6**
- inputs: **20**
- outputs: residual steering + pace
- driver architecture: trajectory planner + adaptive cruise + NEAT residual

The named 22-driver roster is sampled across ratings for each race.

## Validation

The final exported v5 roster includes a reproducible validation summary from two 60-second traffic runs under the no-force-field dynamics:

- mean progress: **1.200 laps per car**
- slowest progress: **1.088 laps**
- grass time: **0.0 seconds**
- outer-wall hits: **0**
- car-contact events: **0**
- AI force-field assists: **0**

This validation is a stability/clean-driving check, not a claim that the agents are globally optimal racing policies. The important change is that clean driving now comes from trajectory planning, headway control and the trained residual policy rather than an invisible correction that moves cars back onto asphalt.

## Reproducing

Run:

```bash
python3 scripts/train_neat_v5.py
```

The trainer reads `race-track-istanbul.json` and exports `neat-champions-v5.json`. The browser runtime is `race-engine-v5.js` + `terminal-race-v5.js`.
