# NEAT Grand Prix v3

The race is a top-down browser racing game built around real Grand Prix centerline geometry and a deliberately arcade-readable 2D vehicle model.

## Handling target

Ultimate Racing 2D is the gameplay reference: braking before difficult corners, outside–apex–outside lines, costly grass excursions, close AI racing, and steering that stays readable at speed. No Ultimate Racing 2D source code or assets are included.

Vehicle-dynamics ideas are independently adapted from permissively licensed references including `ishanmanjrekar/topdown-2d-car-engine` and `ryouze/vroom`. Circuit centerlines come from the MIT-licensed `bacinger/f1-circuits` dataset.

## Current steering calibration

The previous v3 steering was too stiff. The current configuration was selected by a fixed-budget evolutionary sweep across ten steering/grip combinations. See [`STEERING_SWEEP.md`](./STEERING_SWEEP.md) for the complete comparison.

Selected values:

```text
STEER_LOW       = 0.72 rad
STEER_HIGH      = 0.43 rad
TURN_GAIN       = 0.75
STEER_RATE      = 6.8 rad/s
GRIP_LOW        = 10.1
GRIP_HIGH       = 5.3
STEER_GRIP_DROP = 0.29
```

Compared with the previous `.58 / .29 / .54 / 4.4` steering setup, this gives substantially more low- and high-speed authority and reaches the requested steering angle faster. Lateral velocity is still damped rather than snapped to the chassis, so fast abrupt inputs can create slip instead of instant rotation.

## Track and vehicle model

Istanbul Park is the default/global circuit. The simulation world is `1400 × 840`; cars are `16 × 8` world units; paved road width remains exactly `CAR_W × 3.5 = 28` world units. Grass/runoff lies outside the asphalt and the physical barrier is farther out again.

The browser runs fixed-step physics at 120 Hz. The model includes separate throttle/brake/reverse behavior, speed-sensitive steering angle, bicycle-inspired yaw response, longitudinal/lateral velocity decomposition, lateral grip and slip, steering/sliding scrub, grass drag, recoverable outer-barrier collision, handbrake rotation, and oriented-rectangle car contact.

Controls:

```text
W / ↑        throttle
S / ↓        brake, then reverse near zero speed
A D / ← →    steer
Space        handbrake / stronger rotation
R            restart
P            pause
```

## NEAT opponents

`scripts/train_neat.py` is the training harness used for `neat-champions.json`. A deterministic low-level path follower provides basic track competence; NEAT evolves residual steering and pace control. The trainer uses a population of 24 for 10 generations with innovation-number alignment, compatibility speciation, fitness sharing, crossover, weight mutation, add-connection mutation, and add-node mutation.

The current nine champions were retrained after the steering sweep. Individual 70-second verification covered roughly **2.20–2.23 laps** per agent with **zero wall contacts for all nine**. In the 100-second nine-car pack simulation, agents covered **2.327–2.632 laps**, averaged **2.452 laps**, recorded **one total wall contact**, and **0/9** ended stuck in recovery.

## Leaderboard safety

Global competition remains limited to Istanbul Park. The browser has only structural nickname validation. The authoritative GitHub Action validates game/track version, numeric score fields, deterministic score recomputation, authenticated GitHub author, Unicode-normalized name structure, reserved/link-like names, and the private moderation corpus supplied through `PROFANITY_BLOCKLIST_GZ_B64`.
