# NEAT Grand Prix v3

The race is a small top-down racing game first and a portfolio demo second. v3 replaces the previous over-fast point-mass handling with a slower, recovery-friendly vehicle model, a larger simulation world, proper braking/reverse behavior, controllable slip, grass/runoff, and a 10-car grid.

## Handling target and references

**Ultimate Racing 2D** is the gameplay reference, not a code dependency. Its developer describes the intended loop clearly: you should not be able to take every corner at full speed, the traditional outside–apex–outside racing line matters, grass should cost substantial time, and some corners require lifting while others require braking. v3 is tuned around that behavior.

The implementation is independent JavaScript, with vehicle-dynamics ideas adapted from permissively licensed open-source references:

- [`ishanmanjrekar/topdown-2d-car-engine`](https://github.com/ishanmanjrekar/topdown-2d-car-engine) — MIT. Useful reference for projecting velocity into longitudinal/lateral components, separating braking from reverse, speed-sensitive steering, and slip/drift telemetry.
- [`ryouze/vroom`](https://github.com/ryouze/vroom) — MIT. Useful reference for lateral-slip damping, speed management before corners, off-track slowdown, reverse-aware steering, and collision recovery that does not leave a car glued to a wall.
- [`bacinger/f1-circuits`](https://github.com/bacinger/f1-circuits) — MIT. Source for Grand Prix centerline geometry.

No Ultimate Racing 2D source code or assets are included.

## Istanbul Park and scale

Istanbul Park is the default/global circuit. Its source coordinates are stored locally in `race-track-istanbul.json` so the default race and the training harness use exactly the same geometry. Monza, Spa-Francorchamps, and Monaco remain selectable practice circuits.

The simulation world is `1400 × 840`. Cars are `16 × 8` world units and the paved road is exactly:

```text
ROAD_W = CAR_W × 3.5 = 28
```

The safety/runoff region exists **outside** that 3.5-car-wide road. That distinction matters: leaving the asphalt slows the car heavily, but the physical barrier is farther out, so one mistake does not pin a car against the road edge.

## Vehicle physics

The browser integrates the race at a fixed **120 Hz**. Each car carries position, world velocity, heading, yaw rate, and steering angle.

The core handling model works in the car's local frame:

1. Project world velocity into **longitudinal** and **lateral** components.
2. Apply throttle, braking, reverse acceleration, rolling resistance, and quadratic drag to longitudinal velocity.
3. Limit steering angle as speed increases.
4. Use a bicycle-inspired yaw target from signed longitudinal velocity, wheelbase, and steering angle. Signed velocity naturally reverses steering behavior while backing up.
5. Rotate the body, then damp lateral velocity toward the new body direction. Because velocity does not instantly rotate with the chassis, hard high-speed inputs create real slip angle.
6. Steering/sliding scrub removes energy instead of allowing unlimited full-throttle cornering.
7. Grass/runoff adds strong drag. A separate outer barrier pushes the body back toward the circuit and removes outward velocity while preserving enough inward velocity to recover.

`S` / Down therefore behaves as a brake while moving forward and becomes reverse once the car is nearly stopped. `Space` reduces rear grip for a stronger rotation/drift effect.

Cars collide as oriented rectangles. Collision detection uses SAT-style axes from both car bodies; resolution applies penetration correction plus normal/tangential impulses and angular impulse around the contact point.

## NEAT opponents

`scripts/train_neat.py` is the exact training harness used for `neat-champions.json`.

v3 uses a safer racing architecture than the previous direct-control networks. A deterministic low-level path follower provides a valid racing baseline; **NEAT evolves a residual steering correction and pace bias**. That preserves genuine neuroevolution while preventing a weak genome from rediscovering basic road-following every generation and spending the race parked against a wall.

Training configuration:

- Seed: `20261010`
- Population: `24`
- Generations: `10`
- Training circuit: Istanbul Park
- Inputs: `12` normalized motion / track-relative features
- Outputs: residual steering trim + pace bias
- Activation: `tanh`
- Evolution: innovation-number alignment, compatibility speciation, fitness sharing, crossover, weight mutation, add-connection mutation, and add-node mutation
- Exported opponents: `9`

The runtime adds mild lane personality and traffic-aware avoidance/braking so the grid races rather than forming a single perfectly overlapping train. A short recovery watchdog reverses an AI only if it remains nearly stationary for an abnormal period.

## Validation

After retraining, every exported champion was first tested individually for 70 simulated seconds. The nine agents covered roughly **1.44–1.50 laps** each in that window, with zero or one barrier contact in the individual checks.

Then `scripts/validate_race.py` ran all nine agents together for **100 simulated seconds** with grid spacing, traffic avoidance, collisions, grass/runoff, and the recovery watchdog enabled. Every agent progressed beyond **2.08 laps**, the fastest reached about **2.24 laps**, and none finished the run stuck in recovery.

Run the same headless pack check with:

```bash
python scripts/validate_race.py
```

This validation is intended to catch the failure mode that mattered in v2: agents that look competent alone but deadlock or park when racing in traffic.

## Controls

```text
W / ↑        throttle
S / ↓        brake, then reverse near zero speed
A D / ← →    steer
Space        handbrake / stronger rotation
R            restart
P            pause
```

The player starts at the back of the 10-car grid, so the race begins with a field to chase instead of making the AI negotiate around a stationary player on pole.

## Global leaderboard and input safety

A personal best is stored in `localStorage` per track. Global submission is available only for Istanbul Park and opens a prefilled GitHub issue, so the static browser never receives a repository write token.

The GitHub Actions validator independently checks the exact game/track version, integer score/time/position bounds, deterministic score recomputation, authenticated GitHub author, Unicode-normalized display-name structure, reserved/link-like names, and the private server-side moderation corpus supplied through `PROFANITY_BLOCKLIST_GZ_B64`.

The moderation vocabulary is not committed to the repository. The validator fails closed if the private secret is missing, malformed, or empty, and accepted names are HTML-escaped before publishing to the SVG leaderboard.
