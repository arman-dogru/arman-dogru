export const PROFILE = {
  name: 'Arman Doğru',
  role: 'Applied AI Researcher @ Nokia Bell Labs',
  location: 'Ottawa / Kanata, Ontario, Canada',
  github: 'https://github.com/arman-dogru',
  linkedin: 'https://www.linkedin.com/in/arman-dogru/',
  scholar: 'https://scholar.google.com/citations?user=BUeifBIAAAAJ',
  email: 'mailto:arman.dogru@gmail.com'
};

export const JOURNEY = [
  { year:'2015', place:'Istanbul, Türkiye', lat:41.0082, lon:28.9784, title:'Saint-Joseph French High School', detail:'French-language secondary education. The origin point.' },
  { year:'2019', place:'Istanbul, Türkiye', lat:41.0082, lon:28.9784, title:'Software Developer · SFS Software & Consultancy', detail:'Insurance database/dashboard work, prototypes, and production bug fixes.' },
  { year:'2020', place:'Istanbul → Ottawa', lat:45.4215, lon:-75.6972, title:'University of Ottawa · B.Sc. Computer Science', detail:'Moved from Türkiye to Canada. Honours CS, co-op, later graduating cum laude.' },
  { year:'2021', place:'Istanbul, Türkiye', lat:41.0082, lon:28.9784, title:'Software Developer Intern · Getir', detail:'Twitter sentiment application and CRM work with Java, Spring Boot, Redis, and AWS.' },
  { year:'2022', place:'Ottawa, Canada', lat:45.4215, lon:-75.6972, title:'Undergraduate AI Research', detail:'Audio AI: reverse-engineering synthesizer parameters, source separation, and reconstruction.' },
  { year:'2023', place:'Ontario, Canada', lat:44.55, lon:-79.20, title:'Shell → SAS Institute', detail:'Production software, APIs, data systems, fraud modeling, Azure, TensorFlow, and applied ML.' },
  { year:'2024', place:'San Francisco Bay Area', lat:37.7749, lon:-122.4194, title:'Casa · Neo Accelerator', detail:'Kotlin/Python backend systems and an agentic RAG tool using MCP-style tool integration.' },
  { year:'2024', place:'Ottawa, Canada', lat:45.4215, lon:-75.6972, title:'M.Sc. Computer Science · AI', detail:'Returned to Ottawa for graduate study focused on artificial intelligence.' },
  { year:'2025', place:'Kanata, Canada', lat:45.3088, lon:-75.8987, title:'Applied AI Researcher · Huawei Canada', detail:'PANAMA network-aware MARL/MAPF, digital twins, and multi-agent LLM reliability research.' },
  { year:'2026', place:'Kanata, Canada', lat:45.3088, lon:-75.8987, title:'Applied AI Researcher · NEXTCONLAB', detail:'Autonomous multi-agent systems, drones/UGVs, CV localization, MARL/MAPF, and RF geolocation.' },
  { year:'2026', place:'Ottawa / Kanata, Canada', lat:45.3405, lon:-75.9111, title:'Applied AI Researcher · Nokia Bell Labs', detail:'Semantic edge-cloud digital twins, computer vision, real-time vehicle reconstruction, and GLOBECOM 2026.' }
];

export const PROJECTS = [
  { alias:'sionna', name:'Ottawa Sionna RT Cellular Digital Twin', tag:'DIGITAL TWIN / RF', stack:'Python · Sionna RT · CUDA · FastAPI · React', url:'https://github.com/arman-dogru/Sionna_Canada_Testbed', desc:'Outdoor cellular propagation twin using public Ottawa geometry, terrain, spectrum-site data, GPU ray tracing, APIs, and browser engineering UI.' },
  { alias:'skate', name:'Skate 3 Rust — macOS Apple Silicon', tag:'SYSTEMS / GRAPHICS', stack:'Rust · Bevy · SDL3 · Metal', url:'https://github.com/arman-dogru/skate3-rust-MacOS', desc:'ARM64 macOS port/continuation of the open-source Skate 3 Rust Engine with native CI and Metal rendering.' },
  { alias:'gsanet', name:'GSANet-DCNN', tag:'COMPUTER VISION', stack:'PyTorch · RAFT · Slot Attention · Transformers', url:'https://github.com/arman-dogru/GSANet-DCNN', desc:'Guided slot-attention architecture for unsupervised video object segmentation across spatial, temporal, and optical-flow features.' },
  { alias:'mendel', name:'Developer Performance Tracker', tag:'AGENTIC AI / DEVTOOLS', stack:'React · Node.js · MongoDB · GitHub APIs · LLMs', url:'https://github.com/arman-dogru/ai-powered-developer-productivity-dashboard', desc:'LLM-assisted GitHub analytics, automated PR review, developer analysis, and productivity dashboards.' },
  { alias:'pixel', name:'One-Pixel Adversarial Attack', tag:'ROBUSTNESS / ML', stack:'TensorFlow · Keras · Differential Evolution', url:'https://github.com/arman-dogru/one-pixel-attack-2025', desc:'Black-box adversarial attacks against image classifiers using differential evolution.' },
  { alias:'bias', name:'LLM Bias Reduction', tag:'LLM SAFETY / FAIRNESS', stack:'Python · LLMs · Fair-SMOTE · SVM', url:'https://github.com/arman-dogru/LLM-Bias-Reduction', desc:'Fairness evaluation and bias-reduction experiments across LLM and traditional classifiers.' }
];

export const RESEARCH = [
  { venue:'IEEE GLOBECOM 2026', title:'Semantic Edge-Cloud Communication for Real-Time Urban Traffic Digital Twins', org:'Nokia Bell Labs · accepted' },
  { venue:'IEEE GLOBECOM 2025', title:'PANAMA: A Network-Aware MARL Framework for Multi-Agent Path Finding in Digital Twin Ecosystems', org:'Huawei Canada' },
  { venue:'U.S. PATENT PENDING', title:'Methods and Apparatus For Detecting and Mitigating Hallucinations in Autonomous Multi-Agent Systems', org:'Huawei Canada' }
];

export const AI_CONTEXT = `You are the AI interface inside Arman Doğru's public portfolio. Answer questions about Arman using only this supplied public profile context. If the context does not support a claim, say so. Arman is an Applied AI Researcher at Nokia Bell Labs and an M.Sc. Computer Science (AI) candidate at the University of Ottawa. Focus areas: semantic edge-cloud digital twins, computer vision, wireless simulation, multi-agent reinforcement learning and MAPF, and reliable multi-agent LLM systems. Huawei Canada work in 2025 included PANAMA, a network-aware MARL framework for MAPF, and a U.S. patent-pending hallucination detection/mitigation method for autonomous multi-agent systems. NEXTCONLAB work in 2026 included drones/UGVs, CV localization, MARL/MAPF and RF geolocation. Bell Labs work in 2026 includes real-time urban traffic digital twins, >99.9% semantic data reduction, 0.12 m mean vehicle coordinate error, and an accepted IEEE GLOBECOM 2026 paper. PANAMA work was accepted at IEEE GLOBECOM 2025. Public projects include an Ottawa Sionna RT cellular digital twin, a Skate 3 Rust macOS ARM64 port, GSANet-DCNN, a developer performance tracker, one-pixel adversarial attack experiments, and LLM bias reduction experiments.`;
