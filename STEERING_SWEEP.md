# Steering calibration sweep

The v3 race felt too stiff under keyboard input, so steering was calibrated with a fixed-budget evolutionary sweep rather than by changing one constant at a time by eye.

## Method

Every candidate used the same Istanbul Park geometry, 3.5-car-wide asphalt, speed model, evaluation seeds, and training budget: **24 controllers × 10 generations**. The sweep used the same 12-input / 2-output residual-controller interface as the race to rank physics configurations quickly. Each candidate was then checked in a nine-car, 100-second pack simulation with traffic avoidance and contact enabled.

After the sweep, the winning physics configuration was retrained with the repository's full NEAT implementation (innovation tracking, speciation, crossover, weight mutation, add-connection and add-node mutation). This keeps the physics comparison fair while ensuring the shipped opponents are still NEAT-evolved networks.

## Sweep results

| Config | low/high steer rad | turn gain | steer rate | individual laps / 70s | pack mean laps / 100s | pack walls | mean grass / 100s |
|---|---:|---:|---:|---:|---:|---:|---:|
| baseline | .58 / .29 | .54 | 4.4 | 1.451 | 1.381 | 783 | 54.0s |
| balanced+ | .68 / .36 | .64 | 5.8 | 2.072 | 2.057 | 19 | 26.2s |
| agile | .74 / .40 | .68 | 6.4 | 2.176 | 2.246 | 6 | 17.6s |
| progressive | .76 / .34 | .70 | 6.2 | 2.168 | 2.236 | 0 | 16.3s |
| responsive | .70 / .42 | .74 | 7.0 | 2.209 | 2.385 | 0 | 11.7s |
| high-angle | .82 / .44 | .68 | 6.6 | 2.190 | 2.416 | 8 | 10.7s |
| grippy-agile | .74 / .40 | .70 | 6.4 | 2.193 | 2.315 | 0 | 14.8s |
| responsive-fine-a | .72 / .41 | .73 | 6.6 | 2.181 | 2.333 | 1 | 14.3s |
| **responsive-fine-b** | **.72 / .43** | **.75** | **6.8** | **2.217** | **2.455** | **0** | **9.9s** |
| responsive-fine-c | .74 / .42 | .74 | 6.8 | 2.201 | 2.424 | 0 | 10.5s |

The most aggressive `high-angle` setup was marginally fast in the pack but produced wall contacts. `responsive-fine-b` was selected because it combined higher progress with zero sweep-pack wall contacts and the lowest grass time among the zero-wall finalists.

## Final full-NEAT retrain

Using `responsive-fine-b`, the final 24×10 NEAT retrain exported nine champions. Individual 70-second verification:

- lap progress: **2.20–2.23 laps**;
- wall contacts: **0 for all nine**;
- grass time: **0.0–0.63 seconds** per agent;
- no post-launch stall behavior.

A 100-second nine-agent pack simulation using the shipped champions produced:

- mean progress: **2.452 laps**;
- range: **2.327–2.632 laps**;
- total wall contacts: **1**;
- mean grass time: **10.15 seconds**;
- agents stuck in recovery at the end: **0 / 9**.

Agent performance is only a proxy for human playability: an AI can exploit control dynamics differently from a keyboard player. It is still useful here because a configuration that requires constant saturated steering, repeatedly leaves the asphalt, or causes pack deadlocks is unlikely to feel good to a human either. The selected setup is therefore a data-backed starting point, with human feel remaining the final criterion.
