const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d', { alpha: false });
const reticle = document.querySelector('#reticle');
const statusEl = document.querySelector('#status');
const attract = document.querySelector('#attract');
const chaos = document.querySelector('#chaos');
const trail = document.querySelector('#trail');
const attractLabel = document.querySelector('#attractLabel');
const chaosLabel = document.querySelector('#chaosLabel');
const trailLabel = document.querySelector('#trailLabel');

let target = { x: .5, y: .5 };
let wasm, memory, xs, ys, energy, n;
let last = performance.now();
let fpsSmooth = 60;
let stepSmooth = 0;

function resize(){
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle = '#03070d'; ctx.fillRect(0,0,innerWidth,innerHeight);
}
addEventListener('resize', resize); resize();

function pointer(e){
  const x = e.clientX ?? e.touches?.[0]?.clientX ?? innerWidth/2;
  const y = e.clientY ?? e.touches?.[0]?.clientY ?? innerHeight/2;
  target.x = x / innerWidth; target.y = y / innerHeight;
  reticle.style.left = x + 'px'; reticle.style.top = y + 'px';
}
addEventListener('pointermove', pointer, {passive:true});
addEventListener('touchmove', pointer, {passive:true});

for (const [el,label] of [[attract,attractLabel],[chaos,chaosLabel],[trail,trailLabel]]) {
  el.addEventListener('input',()=>label.textContent=Number(el.value).toFixed(2));
}

async function boot(){
  const encoded = await fetch('./edge_twin.wasm.b64').then(r => { if(!r.ok) throw new Error(`WASM HTTP ${r.status}`); return r.text(); });
  const binary = atob(encoded.trim());
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0)).buffer;
  ({ instance: { exports: wasm } } = await WebAssembly.instantiate(bytes));
  memory = wasm.memory;
  wasm.init((Date.now() >>> 0), 2048);
  n = wasm.count();
  xs = new Float32Array(memory.buffer, wasm.x_ptr(), n);
  ys = new Float32Array(memory.buffer, wasm.y_ptr(), n);
  energy = new Float32Array(memory.buffer, wasm.energy_ptr(), n);
  document.querySelector('#agents').textContent = n.toLocaleString();
  const rawBps = n * 4 * 4 * 60;
  const semanticBps = 256 * 48 * 10;
  document.querySelector('#rawRate').textContent = `${(rawBps/1e6).toFixed(2)} MB/s`;
  document.querySelector('#semanticRate').textContent = `${(semanticBps/1e3).toFixed(0)} KB/s`;
  document.querySelector('#reduction').textContent = `${(100 * (1 - semanticBps/rawBps)).toFixed(1)}%`;
  statusEl.textContent = 'WASM ONLINE';
  requestAnimationFrame(frame);
}

function frame(now){
  const dt = Math.min((now-last)/1000, .033); last = now;
  const t0 = performance.now();
  wasm.step(dt, target.x, target.y, +attract.value, +chaos.value);
  const t1 = performance.now();
  stepSmooth = stepSmooth * .92 + (t1-t0) * .08;
  fpsSmooth = fpsSmooth * .94 + (1/Math.max(dt,.001)) * .06;

  ctx.fillStyle = `rgba(3,7,13,${+trail.value})`;
  ctx.fillRect(0,0,innerWidth,innerHeight);
  const w = innerWidth, h = innerHeight;
  for(let i=0;i<n;i++){
    const e = energy[i];
    const x = xs[i] * w, y = ys[i] * h;
    ctx.fillStyle = e > .55 ? `rgba(178,134,255,${.42 + e*.48})` : `rgba(71,255,223,${.25 + e*.68})`;
    const s = 1.0 + e*1.8;
    ctx.fillRect(x,y,s,s);
  }

  document.querySelector('#stepMs').textContent = `${stepSmooth.toFixed(3)} ms`;
  document.querySelector('#fps').textContent = `${fpsSmooth.toFixed(0)} FPS`;
  requestAnimationFrame(frame);
}

boot().catch(err => { statusEl.textContent = 'WASM BOOT FAILED'; console.error(err); });
