# NEAT Grand Prix

The portfolio race is a 10-car top-down race at Istanbul Park. The player starts from the back and races nine AI drivers drawn from a 22-driver roster.

## Car model

The road is fixed at 3.5 car widths. The browser runs a fixed 120 Hz update with separate throttle, braking and reverse, speed-sensitive steering, lateral grip, controllable slip, handbrake rotation, runoff drag, recoverable barrier contact and oriented-body car-to-car collision.

Istanbul Park is the only circuit. The AI is trained and validated on the same pinned circuit geometry used by the browser.

## NEAT training

The controller receives 16 inputs: car motion and track state plus traffic features for the nearest car ahead, relative lateral position, closing speed and nearby left/right pressure. NEAT produces residual steering and pace adjustments over a low-level track follower.

The current roster was produced by continuing the previous traffic-aware population for 20 more generations. Each generation is evaluated in randomized nine-car packs twice. Once the generation champion can complete three laps in the 120-second solo check, that generation is saved as a checkpoint instead of throwing the history away.

Every one of the 20 continuation generations cleared the three-lap checkpoint. Their 120-second solo progress ranged from about 3.23 to 3.55 laps.

Higher-rated drivers are assigned later saved generations. The browser also applies a small rating-based pace difference so the grid is not nine copies of the same champion.

The full roster is:

```text
98  Max Vectorstappen
95  LaMDA Norris
94  Charles LeClaude
93  Opus Piastri
92  Gemini Russell
91  Fernando Algonso
90  Lewis Hamiltoken
89  Carlos Cosainz
87  Kimi Anthropelli
86  Alexa Albon
85  Pierre Grokly
84  Isack Hadjarvis
83  Oliver BERTman
82  Estebot Ocon
81  Nico Hulkenbyte
80  Gabriel Botoleto
79  Sergio Perplexez
78  Valtteri Chatbottas
76  Llama Lawson
75  Franco Copilinto
73  Arvid Lindbard
72  Lance StroLLM
```

A race samples nine drivers across the rating range, so restarting the game changes parts of the grid while keeping a mixture of strong and weaker opponents.

## Pack validation

The browser-equivalent validation uses the same steering constants, traffic avoidance, lane targets and 30-unit staggered starting grid as the game.

In a 120-second fixed-grid validation of the default sampled field:

- mean progress: **3.13 laps per car**;
- slowest driver: **2.95 laps**;
- fastest driver: **3.34 laps**;
- distinct car-contact events: **20**;
- grass time: **0.0 seconds**;
- outer-wall hits: **0**;
- stuck recoveries: **0**.

The track-discipline guard keeps AI bodies on the asphalt when a controller would otherwise cross the edge. Training still penalizes edge pressure and use of that correction, so the networks are rewarded for staying clean without relying on it.

## Reproducing the continuation run

`training-seed-v32.json` contains the previous traffic-trained checkpoint. `scripts/train_neat_v4.py` continues that population, saves generation checkpoints after three-lap completion, and exports the named roster in `neat-champions.json`.
