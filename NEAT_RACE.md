# NEAT Grand Prix v2

The portfolio race now uses real Grand Prix circuit geometry and a more physical 2D vehicle model.

## Circuits

The browser loads GeoJSON circuit centerlines from [`bacinger/f1-circuits`](https://github.com/bacinger/f1-circuits) (MIT licensed) and normalizes them into the simulation world. The selectable circuits are:

- **Intercity Istanbul Park** — default and global leaderboard circuit.
- Autodromo Nazionale Monza.
- Circuit de Spa-Francorchamps.
- Circuit de Monaco.

The rendered road width is fixed at **3.5 car widths** for every circuit. Non-Istanbul tracks are practice modes; the public GitHub leaderboard is intentionally a single comparable competition on Istanbul Park.

## Vehicle physics

The game runs fixed-step physics at 120 Hz. Each car has 2D position, linear velocity, heading, and angular velocity. Steering changes body heading while the velocity vector converges toward the body direction through a speed-dependent lateral-grip term. At high speed and large steering input, grip falls and the velocity vector lags the car body, producing controllable oversteer/drift instead of instantaneous rotation.

Cars collide as oriented rectangles. Collision detection uses the **Separating Axis Theorem (SAT)**. Resolution applies penetration correction plus normal and tangential impulses at an approximate contact point, including angular impulse through each car's moment of inertia. Track edges also act as collision boundaries rather than teleport-only reset zones.

## NEAT training

`scripts/train_neat.py` contains the training implementation used for the exported opponents in `neat-champions.json`.

Training run for v2:

- Seed: `20261009`
- Population: `36`
- Generations: `18`
- Default training circuit: Istanbul Park
- Inputs: 12 normalized track-relative features (speed, lateral slip, signed cross-track error, heading alignment, three look-ahead direction pairs, and future curvature)
- Outputs: steering and signed drive command (throttle / brake)
- Activation: `tanh`
- Fitness: forward circuit progress, lap progress, speed, line discipline, and track-edge penalties
- Exported opponents: top 7 sufficiently distinct champions

The implementation uses NEAT-style historical innovation numbers, compatibility-distance speciation, fitness sharing, innovation-aligned crossover, weight mutation, add-connection mutation, and add-node mutation by splitting a connection. The initial population is seeded near a viable pure-pursuit controller so evolution spends its budget improving race behavior rather than rediscovering the sign of steering from scratch.

The seven exported v2 champions each completed roughly **7–8 laps** in the extended post-training verification run used during export.

## Global leaderboard and input safety

A personal best is stored immediately in `localStorage` per track. Global submission is available only for Istanbul Park and opens a prefilled GitHub issue, so the static browser never receives a repository write token.

The GitHub Actions validator independently checks:

- exact game and track version;
- integer-only score/time/position fields and bounds;
- the deterministic score formula;
- the authenticated GitHub issue author;
- Unicode-normalized display-name length and character allowlist;
- zero-width/control-character removal;
- repeated-character abuse;
- private server-side content filtering loaded from the `PROFANITY_BLOCKLIST_GZ_B64` Actions secret after Unicode/confusable/leetspeak normalization;
- reserved/impersonation-style names and link-like names.

The moderation vocabulary is not committed to this repository. The workflow passes the private `PROFANITY_BLOCKLIST_GZ_B64` Actions secret only to the validation step. The validator fails closed if the secret is missing, malformed, or empty. The SVG renderer HTML-escapes accepted names before publishing them on the GitHub profile.

To prepare the secret from a local UTF-8 `blocklist.txt` file (one entry per line):

```bash
python -c "import base64,gzip,pathlib; print(base64.b64encode(gzip.compress(pathlib.Path('blocklist.txt').read_bytes())).decode())"
```

Store that output as the GitHub Actions secret `PROFANITY_BLOCKLIST_GZ_B64`. Do not commit `blocklist.txt` or its encoded value.

This remains a public static game rather than a cryptographically attested esports service: score validation is strong input/plausibility validation, not proof that the browser simulation was unmodified.
