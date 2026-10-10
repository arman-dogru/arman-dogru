# NEAT Grand Prix

The three AI opponents used by `terminal-race.js` are not scripted racing lines. They are neural-network genomes exported after offline neuroevolution and stored in `neat-champions.json`.

## Training run

- Seed: `20261009`
- Population: `44`
- Generations: `28`
- Evaluation horizon: `1,400` fixed simulation steps per genome
- Inputs: normalized speed, signed cross-track displacement, and sine/cosine heading errors to three look-ahead points on the circuit
- Outputs: steering and throttle
- Activation: `tanh`
- Fitness: forward track progress with lap bonus and off-track / stall penalties

The evolutionary implementation used NEAT's core mechanisms: historical innovation numbers for connection genes, compatibility-distance speciation, fitness sharing, crossover aligned by innovation number, weight mutation, add-connection mutation, and add-node mutation by splitting an enabled connection.

The browser uses the same track geometry, controller inputs, network activation, and fixed-step vehicle dynamics used by the training evaluation. The exported champions completed extended post-training runs of more than seven laps without losing the circuit.

## Leaderboard

The game saves a personal best immediately in `localStorage`. A global score submission opens a prefilled GitHub issue. `.github/workflows/race-leaderboard.yml` checks the game version, track ID, timing bounds, finish position, and score formula, then stores the best score for that GitHub account in `leaderboard.json` and regenerates `assets/race-leaderboard.svg`.

This is a portfolio game, not an anti-cheat platform: because the client is public and static, the validation is plausibility/account validation rather than cryptographically secure gameplay attestation.
