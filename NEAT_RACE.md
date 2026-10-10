# NEAT Grand Prix v3.2

The race is a small top-down racing game first and a portfolio demo second. v3.2 keeps the 3.5-car-wide Istanbul Park surface and the recovery-friendly longitudinal/lateral vehicle model, then focuses on three things that were still weak in v3.1: keyboard steering response, traffic-aware opponents, and race readability.

## Handling target and references

**Ultimate Racing 2D** remains the gameplay reference, not a code dependency. The implementation is original JavaScript, with vehicle-dynamics ideas adapted from permissively licensed open-source references:

- `ishanmanjrekar/topdown-2d-car-engine` (MIT): longitudinal/lateral velocity decomposition, braking/reverse separation, speed-sensitive steering, slip telemetry.
- `ryouze/vroom` (MIT): lateral-slip damping, corner speed management, off-track slowdown and collision recovery.
- `bacinger/f1-circuits` (MIT): Grand Prix centerline geometry.

No Ultimate Racing 2D source code or assets are included.

## Istanbul Park and scale

Istanbul Park is the default/global circuit. The source centerline is pinned locally in `race-track-istanbul.json` so the browser and trainer use the same geometry.

```text
WORLD       1400 × 840
CAR         16 × 8
ROAD_W      CAR_W × 3.5 = 28
PHYSICS     120 Hz browser integration
```

The asphalt width is still exactly **3.5 car widths**. Grass/runoff remains outside the asphalt and the physical outer barrier remains farther out for the player.

## v3.2 steering

The v3.1 sweep showed that the original steering was too stiff. v3.2 increases steering only slightly rather than returning to twitchy arcade rotation:

```text
                v3.1      v3.2
low-speed       0.720     0.740 rad
high-speed      0.430     0.445 rad
turn gain       0.750     0.780
steer rate      6.80      7.10 rad/s
```

Lateral grip remains speed dependent. A hard high-speed input can still create slip because velocity does not instantly rotate with the chassis.

## Traffic-aware NEAT

The old opponents learned mainly from track state, while traffic avoidance was mostly a runtime heuristic. v3.2 changes the network interface and the training environment.

Each controller now receives **16 inputs**:

- 12 motion / track-relative features: speed, longitudinal and lateral velocity, cross-track error, three look-ahead direction pairs, and future curvature;
- 4 traffic features: nearest-front-car proximity, its lateral offset, closing speed, and left/right side pressure.

The two outputs remain:

- residual steering correction;
- pace bias.

The population is seeded from the strong v3.1 single-agent champions so evolution does not waste generations relearning basic Istanbul Park driving. The old graph is remapped into the new 16-input schema and the traffic connections start neutral.

Training configuration:

```text
population               36
training generations      24
pack size                  9 cars
pack simulation           20 s / evaluation
track                      Istanbul Park
controller                 path follower + NEAT residual
```

Every generation evaluates controllers **inside moving nine-car packs**. Fitness rewards forward progress and overtaking while strongly penalizing contact, edge use, track-assist intervention, barrier hits, grass time and stuck recovery. The final population was also searched for a compatible nine-controller race pack rather than blindly exporting the nine highest isolated fitness values.

A longer continuation was tested during tuning, but it regressed pack interaction quality, so the shipped checkpoint is the better-performing 24-generation pack-trained set rather than the latest generation by default.

## Asphalt discipline

The AI has a low-level track-discipline safety invariant in addition to learned steering. For AI cars only, the allowed centerline offset is:

```text
ROAD_HALF - 0.55 × CAR_W
```

That keeps the **entire AI car body on asphalt**. Training counts time spent touching that guard and penalizes it, so the learned policy is still rewarded for staying away from the edge instead of leaning on the safety layer.

The player does **not** get this assist. Human cars can still run onto the grass/runoff and lose time normally.

## Pack validation

`scripts/validate_race.py` reconstructs the shipped networks and runs three deterministic 120-second nine-agent stress races.

Current validation:

| seed | mean laps | minimum laps | contact events | grass | walls | recoveries |
|---:|---:|---:|---:|---:|---:|---:|
| 20270921 | 3.019 | 2.859 | 163 | 0.000 s | 0 | 0 |
| 20273011 | 3.118 | 2.853 | 167 | 0.000 s | 0 | 0 |
| 20274017 | 3.056 | 2.893 | 196 | 0.000 s | 0 | 0 |

The regression test fails if an AI reaches grass, hits the outer barrier, falls below the minimum progress threshold, produces excessive contact, or repeatedly enters stuck recovery.

These contact counts are collision **events**, not frames spent overlapping. The grid is intentionally physical: contact can still occur while fighting for position, but the agents now observe traffic during training instead of discovering other cars only at runtime.

Run it with:

```bash
python scripts/validate_race.py
```

## Camera and controls

When the race starts, the camera eases to a **1.55× player-follow zoom**. A full-circuit minimap remains visible in the lower-right corner so the race is readable without shrinking the cars back to dots.

```text
W / ↑        throttle
S / ↓        brake, then reverse near zero speed
A D / ← →    steer
Space        handbrake / stronger rotation
R            restart
P            pause
```

Race hotkeys are ignored while a form control is focused. This matters on the finish screen: typing a name containing `R` no longer restarts the race.

## Global leaderboard and input safety

A personal best is stored in `localStorage`. Global submission is available only on Istanbul Park and opens a prefilled GitHub issue, so the static browser never receives a repository write token.

The GitHub Actions validator independently checks game/track version, integer score/time/position bounds, deterministic score recomputation, authenticated GitHub author, Unicode-normalized display-name structure, reserved/link-like names, and the private server-side moderation corpus supplied through `PROFANITY_BLOCKLIST_GZ_B64`.

The moderation vocabulary is not committed to the repository. The validator fails closed if the private secret is missing, malformed or empty, and accepted names are HTML-escaped before publishing to the SVG leaderboard.
