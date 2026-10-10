<p align="center">
  <a href="https://arman-dogru.arman-dogru.workers.dev">
    <img src="./assets/hero.svg" width="100%" alt="Arman Doğru — Applied AI Researcher at Nokia Bell Labs" />
  </a>
</p>

<p align="center">
  <a href="https://arman-dogru.arman-dogru.workers.dev"><img src="https://img.shields.io/badge/OPEN-INTERACTIVE_TERMINAL-89dceb?style=for-the-badge&logo=gnometerminal&logoColor=11111b" alt="Open interactive terminal"></a>
  <a href="https://www.linkedin.com/in/arman-dogru/"><img alt="LinkedIn" src="https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white"></a>
  <a href="https://scholar.google.com/citations?user=BUeifBIAAAAJ"><img alt="Google Scholar" src="https://img.shields.io/badge/Scholar-4285F4?style=for-the-badge&logo=googlescholar&logoColor=white"></a>
</p>

<p align="center">
  <b>Applied AI Researcher @ Nokia Bell Labs</b><br/>
  Digital Twins · Computer Vision · Multi-Agent RL · Agentic Systems · Wireless Simulation
</p>

---

## `./portfolio`

The companion site is a working terminal-style portfolio with:

- a tmux / neovim-inspired shell for navigating my work;
- an **OpenStreetMap-based career journey** with satellite mode and event dossiers;
- public project launchers and research notes;
- a tightly scoped **Grok portfolio Q&A** relay that never exposes the API key in the browser;
- **NEAT Grand Prix v3.2** — a 10-car Istanbul Park race with traffic-trained neuroevolved opponents, physical contact, braking/reverse, recoverable slip, player-follow camera and a minimap.

```text
help
journey
trace huawei
projects
research
race
leaderboard
chat what did Arman work on at Bell Labs?
```

<p align="center">
  <a href="https://arman-dogru.arman-dogru.workers.dev">
    <img src="https://img.shields.io/badge/LAUNCH-TERMINAL_%2B_NEAT_GP-cba6f7?style=for-the-badge&logo=github&logoColor=11111b" alt="Launch terminal and NEAT Grand Prix" />
  </a>
</p>

---

## `./neat_gp --track istanbul`

The default race is **Intercity Istanbul Park**. The road remains exactly **3.5 car widths** wide. The browser uses a 120 Hz longitudinal/lateral vehicle model with distinct throttle, braking and reverse behavior, speed-sensitive steering, controllable slip, grass/runoff and oriented-body car-to-car collision.

v3.2 makes steering slightly more responsive and trains the AI differently. The nine opponents now use a **16-input NEAT controller** that sees both track state and nearby traffic. Training uses a population of 36 over 24 generations, with controllers evaluated in moving **nine-car packs** rather than only in isolation.

The AI also has a narrow asphalt-safety invariant that keeps its whole car body on the paved surface; training penalizes use of that intervention. In three committed 120-second pack regressions, the shipped grid recorded **0 grass time, 0 outer-wall hits, and 0 stuck recoveries**, while every agent covered at least 2.85 laps. The browser now follows the player at a modest zoom with a full-track minimap.

[Read the race, training and validation notes →](./NEAT_RACE.md)

---

## `cat research.md`

### Nokia Bell Labs — Applied AI Researcher `2026 → present`
Semantic edge-to-cloud digital twins for urban mobility, computer vision localization, guided attention, real-time scene reconstruction, and an accepted **IEEE GLOBECOM 2026** paper.

### Smart Connected Vehicles Innovation Centre / NEXTCONLAB — Applied AI Researcher `2026`
Autonomous multi-agent systems using drones/UGVs, computer vision localization, **MARL/MAPF**, and RF geolocation from phase-difference-of-arrival measurements.

### Huawei Canada — Applied AI Researcher `2025`
Developed **PANAMA**, a network-aware MARL framework for multi-agent path finding in digital-twin environments. Also developed a multi-agent LLM reliability approach for hallucination detection/mitigation that resulted in a **U.S. patent filing (pending)**. First-author work accepted at **IEEE GLOBECOM 2025**.

---

## `ls ./featured-projects`

| Project | What it is |
|---|---|
| **[Ottawa Sionna RT Cellular Digital Twin](https://github.com/arman-dogru/Sionna_Canada_Testbed)** | Reproducible outdoor cellular-propagation digital twin built from public Ottawa geometry, terrain, spectrum-site data, NVIDIA Sionna RT, APIs, and a browser engineering UI. |
| **[Skate 3 Rust — macOS Apple Silicon](https://github.com/arman-dogru/skate3-rust-MacOS)** | Native ARM64 macOS port/continuation of the open-source Skate 3 Rust Engine using Rust, Bevy, SDL3, Metal, and Apple Silicon CI. |
| **[GSANet-DCNN](https://github.com/arman-dogru/GSANet-DCNN)** | Guided slot-attention architecture for unsupervised video object segmentation using spatial, temporal, and optical-flow information. |
| **[Developer Performance Tracker](https://github.com/arman-dogru/ai-powered-developer-productivity-dashboard)** | LLM-assisted GitHub engineering analytics for pull-request review, developer analysis, and productivity dashboards. |
| **[One-Pixel Adversarial Attack](https://github.com/arman-dogru/one-pixel-attack-2025)** | Black-box adversarial attacks against image classifiers using differential evolution. |
| **[LLM Bias Reduction](https://github.com/arman-dogru/LLM-Bias-Reduction)** | Fairness evaluation and bias-reduction experiments across LLM and traditional classification pipelines. |

---

## `cat publications.txt`

- **Semantic Edge-Cloud Communication for Real-Time Urban Traffic Digital Twins** — Nokia Bell Labs — **IEEE GLOBECOM 2026**, accepted.
- **PANAMA: A Network-Aware MARL Framework for Multi-Agent Path Finding in Digital Twin Ecosystems** — Huawei Canada — **IEEE GLOBECOM 2025**.
- **Methods and Apparatus For Detecting and Mitigating Hallucinations in Autonomous Multi-Agent Systems** — Huawei Canada — **U.S. patent pending**.

---

## `cat race-leaderboard.svg`

<p align="center"><img src="./assets/race-leaderboard.svg" width="100%" alt="Istanbul Park NEAT Grand Prix leaderboard" /></p>

---

<p align="center"><code>Build systems that still work after the demo.</code></p>
