# NEAT Grand Prix

Ten cars race three laps of the pinned Istanbul Park circuit. The player starts at the back; all nine opponents use one champion policy, with identities drawn from the 22-driver roster. The champion is the highest-distance-fitness archived policy that completes the cloned-grid release checks, not simply the latest generation or highest decorative rating. `race-roster.js` applies that same policy to every opponent. Names, colors and ratings do not change controls or physics. The full trained archive remains intact for comparison and future retraining.

## One simulation

`race-sim.js` contains the vehicle update, controller, progress and collisions used by the browser, training and validation. Every simulation runs at 120 Hz. There is no separate approximate training physics.

Player and AI cars share acceleration, braking, reverse, top speed, steering limits/rate, grip, handbrake, grass drag, runoff walls and oriented-body collisions. The AI only emits steering, drive and handbrake inputs. Asphalt edges do not reposition cars.

The controller combines look-ahead path following, curvature/braking speed planning, predictive body separation in traffic, and a learned NEAT steering/pace residual. When stalled, it searches short forward/reverse maneuvers against the same physics and nearby bodies, then applies ordinary controls. This is a hybrid controller, not an end-to-end neural driving policy.

Ratings are themed roster labels, not speed handicaps or claims of calibrated racing Elo. Every car has identical physical capabilities. NEAT's pace output can request 0.6–4.0 times the curvature reference speed, capped by the shared vehicle maximum. This allows aggressive corner entry instead of restricting learning to a cautious +/-11% adjustment. It cannot grant extra acceleration, grip or top speed.

## Training

```sh
npm run train
```

Default: 64 genomes, 100 generations, eight-car randomized packs, two **150-second** episodes per generation and genome, and grid, stopped-player and off-track recovery scenarios. Training uses up to four local CPU workers. Population must be a multiple of eight and at least 24.

NEAT evolves weights and feed-forward topology with node/connection mutations, shared innovation IDs, aligned crossover and species-based fitness sharing. **Fitness is solely mean net forward circuit distance travelled during equal-length episodes.** The implementation is `scripts/race-fitness.mjs`.

There are no finish bonuses, lap-time rewards, survival rewards, grass/contact/wall penalties, stall penalties or reverse penalties. Reversing naturally subtracts forward progress; weaving and spinning do not earn odometer rewards. Initial grid position is subtracted, so starting nearer the line is not distance earned. Grass drag, collisions and braking still consume time through the ordinary shared physics.

Training continues after the three-lap finish marker until the fixed time limit. Otherwise every successful driver would earn roughly the same three laps, whether fast or slow. The browser race still ends after three laps. Finish time and driving incidents are recorded as diagnostics, not fitness terms.

The stopped-player distribution uses five circuit positions (42, 350, 1100, 1700 and 2400 simulation units). The final archive is ranked by the same distance-only objective over identical solo conditions: open track and all five stopped-car positions. Candidates must complete three laps before release. There is no clean-driving reranking or hidden weighted safety score. The named roster is then checked for completion in shuffled nine-car packs using fixed selection seeds plus known regressions; failures are replaced in distance-ranked order. These selection arrangements are not unseen validation. Incident counts remain visible in reports. A failed completion gate does not overwrite `neat-champions-v5.json`. Checkpoints and detailed reports are retained in ignored `work/`.

To screen an already trained archive without repeating evolution:

```sh
npm run train -- --checkpoint=work/neat-checkpoint.json
```

This selects and validates the completed checkpoint; it does **not** resume evolution. Legacy checkpoints do not contain innovation/RNG state. Checkpoints from an older objective or simulation are rejected, so safety-weighted fitness cannot silently enter distance-only selection. Candidate replacements use fixed test arrangements and never recycle a previously rejected policy. Selection-test results are not a substitute for the separate race validator.

This optimizes measured performance on this circuit and these scenarios. It does not establish globally optimal driving or immunity to arbitrary deliberate player obstruction.

The trainer also selects a single active champion from the exported archive, testing nine identical copies at all five blocked positions and then the full pack-release arrangements. Candidates are considered in descending distance-fitness order; only non-completion excludes them. Fitness and incident thresholds are unchanged. `race_policy` records the selected policy and its cloned-grid checks. To repeat just this step without retraining:

```sh
node scripts/select-race-champion.mjs
```

## Validation

```sh
npm test
npm run validate:race
npm run validate:race -- --unseen
python3 scripts/validate_ui.py
```

Unit tests cover distance-only fitness invariance, equal episode duration, progress beyond the finish marker, initial-position normalization, reverse progress, identical player/AI physics, real grass behavior, angle wrapping, topology evolution, blocked traffic at a fixed reference pace, wrong-way recovery and reorientation hysteresis, leaderboard persistence/concurrency and offline retry.

The race validator uses the same champion-roster selector as the browser, testing cloned-champion complete three-lap grid, actual ten-car grid with an idle player at the back, stopped-player and off-track recovery races. Every themed identity is tested, including the lowest decorative ratings. It writes `work/race-validation.json`; `--unseen` uses seeds absent from training and selection, writing `work/race-unseen-validation.json`. Reports identify the active champion and policy mode. The archive contains the original mixed-policy selection summary and a hash of its simulation source, not a validation of the cloned grid. Both validators retain stricter incident gates in addition to completion; a nonzero exit must not be described as a clean pass.

### Single-champion grid: 2026-10-11

All nine opponents use the generation-59 policy archived as Gemini Russell. It has the highest distance fitness among archived models that complete the identical-grid release checks. The raw top scorer (generation 99) stalled seven cars behind a stopped player at circuit position 1700 when cloned, so it failed the existing completion requirement. No weights, physics, fitness formula or incident thresholds were changed to select its replacement.

The selected champion completed 864/864 release starts. The separate regression and unseen suites each completed 324/324 starts and passed every existing incident threshold: no wall hits, no persistent queues, longest stop 0.867 seconds. Each suite reported two aggregate contacts in stopped-player races, so this is not a collision-free claim. Mean three-lap times were 87.19 seconds on the normal grid and 91.23 seconds with an idle player at the back. The original mixed-grid measurements below remain historical, not the results for this new policy mode.

### Local distance-only retraining: 2026-10-11 (original mixed-policy grid)

Seed 20261011, 64 genomes, 100 generations, 12,800 evolutionary car episodes. The 192-policy archive was screened on six identical fixed-duration solo conditions. The exported 22 policies then completed all 864 pack-selection starts. The same exported roster completed all 324 known-regression starts and all 324 additional unseen starts, with no wall hits. The longest stop was 0.875 seconds in regressions and 1.442 seconds in unseen arrangements.

Mean three-lap finish times in the same known-regression arrangements:

| Scenario | Previous roster | Distance-only roster | Reduction |
| --- | ---: | ---: | ---: |
| Grid | 112.90 s | 86.98 s | 23.0% |
| Idle player at grid back | 116.75 s | 91.34 s | 21.8% |
| Stopped player on circuit | 121.71 s | 97.02 s | 20.3% |
| Off-track recovery start | 106.64 s | 81.49 s | 23.6% |

Unseen normal-grid mean was 87.02 seconds. These are simulation times, not wall-clock browser timings. The old roster completed its baseline races too; this comparison is not biased by dropping unfinished drivers.

This roster is faster, not collision-free. The strict clean-driving gate flagged four regression runs and three unseen runs, principally contacts/impacts. Aggregate reported contact counts were 12 and 19 respectively; neither set contained a non-finisher or a persistent queue. These diagnostics do not affect fitness, and the incident thresholds have not been relaxed to turn them green. Raw local reports remain in `work/`.

Starting on grass necessarily creates grass time in recovery tests. This is reported separately from ordinary races; it must not be mislabeled as zero off-track behavior.

`npm run validate:race -- --stress` additionally places a stationary player at arbitrary positions, including corner apexes. This is outside the five-position training distribution. Exploratory tests found queues/deadlocks in some of these cases; passing the ordinary validation is not evidence that these adversarial cases are solved. The stress report is saved separately as `work/race-stress-validation.json` and its failures are retained.

The old Python training/validation entrypoints now forward to the JavaScript simulation to prevent accidental retraining against outdated physics.
