export function createJourneyMap({ canvas, journey, card, status, css, sleep, log }) {
  const ctx = canvas.getContext('2d');
  let w=0,h=0,dpr=1,raf=0,phase=0,index=journey.length-1,anim=null;
  const continents=[
    [[-168,72],[-140,60],[-125,48],[-118,32],[-98,17],[-83,25],[-76,46],[-60,54],[-52,70],[-95,83],[-140,78]],
    [[-81,12],[-72,2],[-70,-16],[-57,-38],[-66,-55],[-77,-48],[-82,-8]],
    [[-10,36],[2,44],[20,58],[38,70],[48,58],[32,44],[22,36]],
    [[-17,35],[10,37],[34,30],[51,12],[41,-14],[20,-35],[-5,-32],[-17,10]],
    [[28,71],[60,74],[90,66],[120,55],[150,60],[170,48],[145,28],[118,20],[105,6],[78,8],[58,24],[36,40]],
    [[112,-12],[154,-11],[151,-39],[124,-44],[113,-27]]
  ];
  const proj=(lon,lat)=>[((lon+180)/360)*w,((90-lat)/180)*h];
  function resize(){const r=canvas.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);w=r.width;h=r.height;canvas.width=Math.max(1,Math.floor(w*dpr));canvas.height=Math.max(1,Math.floor(h*dpr));ctx.setTransform(dpr,0,0,dpr,0,0)}
  function updateCard(){const e=journey[index];card.innerHTML=`<div class="eyebrow">TRACE EVENT ${String(index+1).padStart(2,'0')} / ${journey.length}</div><h3>${e.year} // ${e.title}</h3><p>${e.place}<br>${e.detail}</p><div class="coords">${e.lat.toFixed(4)}°, ${e.lon.toFixed(4)}° // public career record</div>`}
  function draw(){cancelAnimationFrame(raf);phase+=.006;ctx.clearRect(0,0,w,h);ctx.fillStyle=css('--bg');ctx.fillRect(0,0,w,h);ctx.strokeStyle=css('--line');ctx.globalAlpha=.48;ctx.lineWidth=1;
    for(let lon=-180;lon<=180;lon+=30){const [x]=proj(lon,0);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
    for(let lat=-60;lat<=60;lat+=30){const [,y]=proj(0,lat);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    ctx.globalAlpha=.12;ctx.fillStyle=css('--blue');ctx.strokeStyle=css('--cyan');continents.forEach(poly=>{ctx.beginPath();poly.forEach((p,i)=>{const [x,y]=proj(p[0],p[1]);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.fill();ctx.stroke()});
    ctx.globalAlpha=.6;ctx.strokeStyle=css('--cyan');ctx.setLineDash([5,6]);ctx.beginPath();journey.forEach((e,i)=>{const [x,y]=proj(e.lon,e.lat);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.setLineDash([]);
    journey.forEach((e,i)=>{const [x,y]=proj(e.lon,e.lat),sel=i===index;ctx.globalAlpha=sel?1:.7;ctx.fillStyle=sel?css('--green'):css('--purple');ctx.beginPath();ctx.arc(x,y,sel?4:2.3,0,Math.PI*2);ctx.fill();if(sel){ctx.strokeStyle=css('--green');ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(x,y,8+Math.sin(phase*11)*3,0,Math.PI*2);ctx.stroke()}});
    if(anim){const a=journey[anim.seg],b=journey[anim.seg+1];if(a&&b){const [ax,ay]=proj(a.lon,a.lat),[bx,by]=proj(b.lon,b.lat),x=ax+(bx-ax)*anim.t,y=ay+(by-ay)*anim.t;ctx.fillStyle=css('--cyan');ctx.globalAlpha=1;ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.18;ctx.beginPath();ctx.arc(x,y,18,0,Math.PI*2);ctx.stroke()}}
    ctx.globalAlpha=.08;ctx.fillStyle=css('--cyan');ctx.fillRect(((phase*70)%1)*w,0,2,h);ctx.globalAlpha=1;raf=requestAnimationFrame(draw)}
  async function animate(){anim={seg:0,t:0};status.textContent='RECONSTRUCTING';for(let seg=0;seg<journey.length-1;seg++){index=seg;updateCard();anim.seg=seg;for(let t=0;t<=1;t+=.025){anim.t=t;await sleep(18)}}index=journey.length-1;anim=null;updateCard();status.textContent='TRACK LOCKED'}
  function trace(q){if(!q){log('usage: trace <year|place>','yellow');return}const idx=journey.findIndex(e=>(e.year+' '+e.place+' '+e.title).toLowerCase().includes(q.toLowerCase()));if(idx<0){log(`no public timeline event matched: ${q}`,'error');return}index=idx;anim=null;updateCard();log(`trace locked // ${journey[idx].year} // ${journey[idx].title}`,'green')}
  addEventListener('resize',resize);new ResizeObserver(resize).observe(canvas);resize();updateCard();draw();return{resize,animate,trace};
}
