<p align="center">
  <a href="https://raw.githack.com/arman-dogru/arman-dogru/main/index.html">
    <img src="./assets/hero.svg" width="100%" alt="Arman Doğru — Applied AI Researcher at Nokia Bell Labs" />
  </a>
</p>

<p align="center">
  <a href="https://raw.githack.com/arman-dogru/arman-dogru/main/index.html"><img src="https://img.shields.io/badge/OPEN-INTERACTIVE_TERMINAL-7dcfff?style=for-the-badge&logo=gnometerminal&logoColor=05070d" alt="Open interactive terminal"></a>
  <a href="https://www.linkedin.com/in/arman-dogru/"><img alt="LinkedIn" src="https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white"></a>
  <a href="https://scholar.google.com/citations?user=BUeifBIAAAAJ"><img alt="Google Scholar" src="https://img.shields.io/badge/Scholar-4285F4?style=for-the-badge&logo=googlescholar&logoColor=white"></a>
</p>

<p align="center">
  <b>Applied AI Researcher @ Nokia Bell Labs</b><br/>
  Digital Twins · Computer Vision · Multi-Agent RL · Agentic Systems · Wireless Simulation
</p>

---

## `./portfolio`

This repository is the source for my interactive terminal portfolio. It is built as a working interface rather than a decorative README: a tmux-inspired personal shell, a timeline of my work, project launchers, public GitHub telemetry, a browser-local LLM mode, and a playable **NEAT racing challenge** against neuroevolved AI drivers.

```text
help
journey
projects
research
race
leaderboard
local-ai
chat what did Arman work on at Huawei?
```

The race is a deterministic browser game. AI opponents are exported NEAT genomes trained offline and evaluated in the same track dynamics used by the game. Personal bests are saved locally. Global leaderboard submissions are routed through GitHub and reflected back into the profile leaderboard artifact after validation.

<p align="center">
  <a href="https://raw.githack.com/arman-dogru/arman-dogru/main/index.html">
    <img src="https://img.shields.io/badge/LAUNCH-NEAT_RACE_%2B_TERMINAL-bb9af7?style=for-the-badge&logo=github&logoColor=white" alt="Launch terminal and NEAT race" />
  </a>
</p>

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

<p align="center">
  <img src="./assets/race-leaderboard.svg" width="100%" alt="NEAT race leaderboard" />
</p>

The leaderboard is generated from `leaderboard.json`. New global scores are submitted through GitHub, validated by an Actions workflow, and then committed back into this repository. The game also keeps a local personal best immediately in the browser.

---

<p align="center"><code>Build systems that still work after the demo.</code></p>
