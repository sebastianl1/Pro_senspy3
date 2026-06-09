// ==================== DATA ====================
let alarmData = [];
let equipData = [];
let tagData = [];

// ==================== RUNTIME ====================
window.processVars = {};

// ==================== CHARTS ====================
let trendChart, energyChart, histChart, scatterChart, alarmPie, anomalyChart, forecastChart;

let trendLabels = [];
for(let i=30;i>=0;i--){
  const d=new Date(Date.now()-i*2000);
  trendLabels.push(d.getHours()+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0'));
}

window.updateTrendChart = function() {
  if(!trendChart) return;
  const ctx = trendChart.ctx;
  const pastelColors = ['#ff3355', '#00d4ff', '#00ff88', '#ffaa00', '#aa55ff', '#ff88cc'];
  const newDatasets = [];
  
  if (window.variableManager && window.variableManager.variables) {
    const varsToGraph = window.variableManager.variables.filter(v => v.toGraph !== false);
    varsToGraph.forEach((v, idx) => {
        const color = pastelColors[idx % pastelColors.length];
        
        // Crear gradiente Zenith
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, color.replace(')', ', 0.3)').replace('rgb', 'rgba').replace('#', 'rgba(' + hexToRgb(color) + ', 0.3)'));
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        const existing = trendChart.data.datasets.find(ds => ds.id === v.id);
        if (existing) {
            existing.label = `${v.tag} (${v.unit})`;
            existing.borderColor = color;
            existing.backgroundColor = gradient;
            newDatasets.push(existing);
        } else {
            newDatasets.push({
                id: v.id,
                label: `${v.tag} (${v.unit})`,
                data: [],
                borderColor: color,
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: true
            });
        }
    });
  }
  trendChart.data.datasets = newDatasets;
  trendChart.update();
};

function initCharts(){
  const chartOpts = {
    responsive:true, maintainAspectRatio:false, animation:{duration:300},
    plugins:{legend:{labels:{color:'#7aa8cc',font:{family:'JetBrains Mono',size:10},boxWidth:12}}},
    scales:{
      x:{ticks:{color:'#3a6a8c',font:{family:'JetBrains Mono',size:9},maxTicksLimit:6},grid:{color:'rgba(26,58,92,0.3)'}},
      y:{ticks:{color:'#3a6a8c',font:{family:'JetBrains Mono',size:9}},grid:{color:'rgba(26,58,92,0.3)'}}
    }
  };

  // TREND CHART
  const tc = document.getElementById('trendChart');
  if(tc) {
    trendChart = new Chart(tc, {
      type:'line',
      data:{ labels:[...trendLabels], datasets:[] },
      options:{...chartOpts}
    });
    window.updateTrendChart();
  }

  // ENERGY
  const ec = document.getElementById('energyChart');
  if(ec){
    energyChart = new Chart(ec,{
      type:'bar',
      data:{labels:hrs.reverse(),datasets:[{
        label:'Consumo kWh',
        data:[],
        backgroundColor:'rgba(0,128,255,0.3)',borderColor:'rgba(0,128,255,0.7)',borderWidth:1
      }]},
      options:{...chartOpts}
    });
  }

  /* 
  // HIST - Manejado por historicos-manager.js
  const hc = document.getElementById('histChart');
  if(hc){
    const pts=120; const hl=[]; const hd1=[],hd2=[];
    for(let i=pts;i>=0;i--){
      const d=new Date(Date.now()-i*30000);
      hl.push(d.getHours()+':'+String(d.getMinutes()).padStart(2,'0'));
      hd1.push(3.5+Math.sin(i/10)*0.8+Math.random()*0.3);
      hd2.push(130+Math.cos(i/8)*20+Math.random()*10);
    }
    histChart=new Chart(hc,{type:'line',data:{labels:hl,datasets:[
      {label:'PT-201 Presión (bar)',data:hd1,borderColor:'#00d4ff',borderWidth:1.5,pointRadius:0,tension:0.3,yAxisID:'y'},
      {label:'FT-301 Caudal (m³/h)',data:hd2,borderColor:'#00ff88',borderWidth:1.5,pointRadius:0,tension:0.3,yAxisID:'y1'}
    ]},options:{...chartOpts,scales:{
      x:{ticks:{color:'#3a6a8c',font:{family:'JetBrains Mono',size:9},maxTicksLimit:10},grid:{color:'rgba(26,58,92,0.2)'}},
      y:{ticks:{color:'#00d4ff',font:{size:9}},grid:{color:'rgba(26,58,92,0.3)'}},
      y1:{position:'right',ticks:{color:'#00ff88',font:{size:9}},grid:{display:false}}
    },plugins:{legend:{labels:{color:'#7aa8cc',font:{family:'JetBrains Mono',size:10},boxWidth:10}}}}});
  }
  */

  /*
  // SCATTER - Manejado por historicos-manager.js
  const sc=document.getElementById('scatterChart');
  if(sc){
    const pts=[];
    for(let i=0;i<80;i++) pts.push({x:2+Math.random()*5,y:100+Math.random()*80+Math.random()*20});
    scatterChart=new Chart(sc,{type:'scatter',data:{datasets:[{label:'Presión vs Caudal',data:pts,backgroundColor:'rgba(0,212,255,0.4)',pointRadius:4}]},options:{...chartOpts,scales:{x:{title:{display:true,text:'Presión (bar)',color:'#7aa8cc'},ticks:{color:'#3a6a8c',font:{size:9}},grid:{color:'rgba(26,58,92,0.3)'}},y:{title:{display:true,text:'Caudal (m³/h)',color:'#7aa8cc'},ticks:{color:'#3a6a8c',font:{size:9}},grid:{color:'rgba(26,58,92,0.3)'}}}}});
  }
  */

  // ALARM PIE
  const ap=document.getElementById('alarmPieChart');
  if(ap) alarmPie=new Chart(ap,{type:'doughnut',data:{labels:['Crítica','Alta','Media','Baja'],datasets:[{data:[],backgroundColor:['rgba(255,51,85,0.7)','rgba(255,170,0,0.7)','rgba(255,136,0,0.7)','rgba(0,212,255,0.5)'],borderColor:'#0a1628',borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#7aa8cc',font:{family:'JetBrains Mono',size:10},boxWidth:10}}}}});

  // ANOMALY
  const an=document.getElementById('anomalyChart');
  if(an){
    anomalyChart=new Chart(an,{type:'line',data:{labels:[],datasets:[]},options:{...chartOpts,scales:{x:{ticks:{color:'#3a6a8c',font:{size:9},maxTicksLimit:8},grid:{color:'rgba(26,58,92,0.3)'}},y:{ticks:{color:'#3a6a8c',font:{size:9}},grid:{color:'rgba(26,58,92,0.3)'}}}}});
  }

  // FORECAST
  const fc=document.getElementById('forecastChart');
  if(fc){
    forecastChart=new Chart(fc,{type:'line',data:{labels:[],datasets:[]},options:{...chartOpts,plugins:{legend:{labels:{color:'#7aa8cc',font:{family:'JetBrains Mono',size:10},boxWidth:10}}}}});
  }
}

// ==================== GAUGES ====================
function drawGauge(canvas, value, max, color, label){
  const ctx=canvas.getContext('2d');
  const w=canvas.width, h=canvas.height;
  const cx=w/2, cy=h*0.6, r=w*0.38;
  ctx.clearRect(0,0,w,h);
  const startA=Math.PI*0.75, endA=Math.PI*2.25;
  ctx.strokeStyle='rgba(26,58,92,0.8)';
  ctx.lineWidth=8;
  ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(cx,cy,r,startA,endA); ctx.stroke();
  const pct=value/max;
  const valA=startA+(endA-startA)*pct;
  ctx.strokeStyle=color;
  ctx.lineWidth=8;
  ctx.shadowColor=color; ctx.shadowBlur=10;
  ctx.beginPath(); ctx.arc(cx,cy,r,startA,valA); ctx.stroke();
  ctx.shadowBlur=0;
  ctx.fillStyle='rgba(0,0,0,0)';
}

function initGauges(){
  const gauges=[
    {id:'g1',val:312,max:400,color:'#ff3355',label:'Temp °C',unit:'°C'},
    {id:'g2',val:4.2,max:10,color:'#00d4ff',label:'Presión bar',unit:'bar'},
    {id:'g3',val:58,max:100,color:'#00ff88',label:'Nivel %',unit:'%'},
  ];
  const row=document.getElementById('gaugeRow');
  if(!row)return;
  row.innerHTML='';
  gauges.forEach(g=>{
    const div=document.createElement('div');
    div.className='gauge-item';
    div.innerHTML=`
      <div class="gauge-canvas">
        <canvas class="gauge" id="${g.id}" width="100" height="80"></canvas>
      </div>
      <div class="gauge-value" style="color:${g.color}">${g.val}<span style="font-size:13px;color:var(--text-secondary)">${g.unit}</span></div>
      <div class="gauge-name">${g.label}</div>`;
    row.appendChild(div);
    drawGauge(document.getElementById(g.id),g.val,g.max,g.color,g.label);
  });
}

// ==================== POPULATE ====================
function populateVars(){
  const grid=document.getElementById('varGrid'); if(!grid)return;
  grid.innerHTML='';
  Object.values(processVars).forEach(v=>{
    const d=document.createElement('div');
    d.className='var-item';
    d.style.cssText=`--var-color:var(${v.color});--var-pct:${v.pct}`;
    d.innerHTML=`<div class="var-name">${v.name}</div>
      <div class="var-val" style="color:var(${v.color})">${v.val}<span class="var-unit">${v.unit}</span></div>
      <div class="var-range">${v.range}</div>
      <div class="var-status"></div>`;
    grid.appendChild(d);
  });
}

function populateAlarms(){
  const list=document.getElementById('alarmList'); if(!list)return;
  list.innerHTML='';
  alarmData.slice(0,5).forEach(a=>{
    const d=document.createElement('div');
    d.className='alarm-item';
    d.innerHTML=`<div class="alarm-dot ${a.priority}"></div>
      <div class="alarm-info">
        <div class="alarm-title">${a.tag} — ${a.desc}</div>
        <div class="alarm-meta">${a.val} | Límite: ${a.limit} | ${a.time}</div>
      </div>
      <div class="alarm-priority ${a.priority}">${a.priority.toUpperCase()}</div>`;
    list.appendChild(d);
  });
}

function populateAlarmTable(){
  const tb=document.getElementById('alarmTableBody'); if(!tb)return;
  tb.innerHTML='';
  alarmData.forEach(a=>{
    const colors={critical:'var(--accent-red)',high:'var(--accent-amber)',medium:'#ff8800',low:'var(--accent-cyan)',resolved:'var(--accent-green)'};
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><span class="alarm-priority ${a.priority}">${a.priority.toUpperCase()}</span></td>
      <td style="font-family:'JetBrains Mono',monospace;color:${colors[a.priority]}">${a.tag}</td>
      <td>${a.desc}</td><td>${a.val}</td><td>${a.limit}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${a.time}</td>
      <td style="color:${a.status==='RESUELTA'?'var(--accent-green)':'var(--accent-red)'}">${a.status}</td>`;
    tb.appendChild(tr);
  });
}

function populateEquip(){
  const grid=document.getElementById('equipGrid'); if(!grid)return;
  grid.innerHTML='';
  equipData.forEach(e=>{
    const d=document.createElement('div');
    d.className='equip-item';
    d.innerHTML=`<div class="equip-icon ${e.state}">${e.icon}</div>
      <div>
        <div class="equip-name">${e.name}</div>
        <div class="equip-state ${e.state}">${e.stateLabel.toUpperCase()}</div>
      </div>`;
    grid.appendChild(d);
  });
}

function populateTags(){
  const tb=document.getElementById('tagTableBody'); if(!tb)return;
  tb.innerHTML='';
  tagData.forEach(t=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><span class="tag-status" style="background:${t.status==='ok'?'var(--accent-green)':'var(--accent-red)'};box-shadow:0 0 6px ${t.status==='ok'?'var(--accent-green)':'var(--accent-red)'}"></span></td>
      <td style="font-family:'JetBrains Mono',monospace;color:var(--accent-cyan)">${t.id}</td>
      <td>${t.desc}</td><td>${t.type}</td><td>${t.unit}</td><td>${t.min}</td><td>${t.max}</td>
      <td><span style="font-family:'JetBrains Mono',monospace;font-size:10px;padding:2px 6px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.2);border-radius:3px;color:var(--accent-cyan)">${t.proto}</span></td>`;
    tb.appendChild(tr);
  });
}

function populateAlarmAreas(){
  const el=document.getElementById('alarmAreas'); if(!el)return;
  const areas=[{name:'Área 100 — Reacción',count:3,color:'var(--accent-red)'},
    {name:'Área 200 — Intercambio',count:2,color:'var(--accent-amber)'},
    {name:'Área 300 — Separación',count:1,color:'#ff8800'},
    {name:'Área 400 — Almacenamiento',count:1,color:'var(--accent-cyan)'}];
  el.innerHTML=areas.map(a=>`<div style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px;color:var(--text-secondary)">${a.name}<span style="color:${a.color};font-weight:700">${a.count}</span></div>
    <div class="prog-bar"><div class="prog-fill" style="width:${a.count/3*100}%;background:${a.color}"></div></div>
  </div>`).join('');
}

function populateAnomaly(){
  const el=document.getElementById('anomalyList'); if(!el)return;
  const items=[
    {time:'09:47',tag:'VT-501',desc:'Pico de vibración +68% sobre media',color:'var(--accent-red)'},
    {time:'08:22',tag:'TT-101',desc:'Drift de temperatura detectado',color:'var(--accent-amber)'},
    {time:'06:15',tag:'PT-201',desc:'Oscilación de presión inusual',color:'var(--accent-amber)'},
  ];
  el.innerHTML=items.map(i=>`<div style="display:flex;gap:10px;align-items:center;padding:8px;background:var(--bg-card2);border:1px solid var(--border);border-radius:6px;margin-bottom:6px">
    <div style="width:6px;height:6px;border-radius:50%;background:${i.color};box-shadow:0 0 8px ${i.color}"></div>
    <div>
      <div style="font-size:12px;color:var(--text-primary)">${i.tag} — ${i.desc}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-dim)">${i.time}</div>
    </div></div>`).join('');
}

// ==================== TICKER ====================
function initTicker(){
  const data=[
    {tag:'TT-101',val:'312°C',color:'var(--accent-red)'},
    {tag:'PT-201',val:'4.2 bar',color:'var(--accent-cyan)'},
    {tag:'FT-301',val:'142 m³/h',color:'var(--accent-green)'},
    {tag:'LT-401',val:'58%',color:'var(--accent-blue)'},
    {tag:'VT-501',val:'12.4 mm/s',color:'var(--accent-amber)'},
    {tag:'EFF',val:'94.7%',color:'var(--accent-green)'},
    {tag:'PROD',val:'4,821 bbl',color:'var(--accent-cyan)'},
    {tag:'AVAIL',val:'98.1%',color:'var(--accent-purple)'},
    {tag:'ALARMS',val:'7 ACTIVAS',color:'var(--accent-red)'},
    {tag:'POWER',val:'284 kW',color:'var(--accent-purple)'},
  ];
  const el=document.getElementById('ticker'); if(!el)return;
  const inner=data.map(d=>`<span class="ticker-item"><span style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--text-dim)">${d.tag}</span><span style="color:${d.color};font-weight:600">${d.val}</span></span><span class="ticker-sep">◆</span>`).join('');
  el.innerHTML=inner+inner; // duplicate for seamless loop
}

// ==================== CLOCK ====================
function updateClock(){
  const el=document.getElementById('clock'); if(!el)return;
  const now=new Date();
  el.textContent=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
}

// ==================== REALTIME API FETCH ====================
async function updateRealtimeData() {
  if (!window.variableManager || !window.variableManager.variables) return;

  try {
    for (const v of window.variableManager.variables) {
      const url = `http://localhost:5000/api/data/quick?table=${v.dbTable}&col=${v.dbVar}&id=${v.dbIdDisp}&var20=${v.dbVar20}`;
      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json();
      if (data && data.val !== null) {
        console.log(`[Polling] ${v.id} -> ${data.val}`);
        // Actualizar processVars
        if (!processVars[v.id]) {
          processVars[v.id] = { val: 0, unit: v.unit, color: '--accent-cyan', pct: 0, name: v.tag, range: '' };
        }
        processVars[v.id].val = data.val;
        processVars[v.id].name = v.tag;
        processVars[v.id].unit = v.unit;
        processVars[v.id].time = data.time || new Date().toLocaleTimeString();
        
        processVars[v.id].pct = Math.max(0, Math.min(1, data.val / 100));
      }
    }

    populateVars();
  } catch (err) {
    console.error('Error fetching realtime data:', err);
  }
}

function simulate(){
  updateRealtimeData();
}

window.threeScene = null;
window.threeProceduralGroup = null;
window.threeCamera = null;
window.threeRenderer = null;
window.threeObjects = [];
window.threeRaycaster = null;
window.threeMouse = null;
let wireMode=false, isRotating=true, autoRotate=true;

function init3D(){
  const canvas=document.getElementById('three-canvas'); if(!canvas)return;
  const W=canvas.parentElement.clientWidth, H=canvas.parentElement.clientHeight||340;

  window.threeScene=new THREE.Scene();
  window.threeProceduralGroup=new THREE.Group();
  window.threeScene.add(window.threeProceduralGroup);
  window.threeScene.background=new THREE.Color(0x0a0a0c);

  window.threeCamera=new THREE.PerspectiveCamera(55,W/H,0.1,200);
  window.threeCamera.position.set(18,14,18);
  window.threeCamera.lookAt(0,4,0);

  window.threeRenderer=new THREE.WebGLRenderer({canvas,antialias:true});
  window.threeRenderer.setSize(W,H);
  window.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  window.threeRenderer.shadowMap.enabled=true;

  // Iluminación neutra mundial (Minimalista)
  const ambient=new THREE.AmbientLight(0xffffff, 1.2); window.threeScene.add(ambient);
  const dirLight=new THREE.DirectionalLight(0xffffff, 2); dirLight.position.set(10,20,10); window.threeScene.add(dirLight);

  // Luces de colores y cuadrícula se mueven al grupo procedimental ocultable
  const pointR=new THREE.PointLight(0xff3355, 1.5, 20); pointR.position.set(-4,6,-4); window.threeProceduralGroup.add(pointR);
  const pointG=new THREE.PointLight(0x00ff88, 1.2, 20); pointG.position.set(4,4,4); window.threeProceduralGroup.add(pointG);

  // Grid
  const grid=new THREE.GridHelper(40,20,0x1a3a5c,0x0d1f35); window.threeProceduralGroup.add(grid);

  // Base platform
  const platGeo=new THREE.BoxGeometry(22,0.3,18);
  const platMat=new THREE.MeshStandardMaterial({color:0x0d1f35,roughness:0.9});
  const plat=new THREE.Mesh(platGeo,platMat); plat.position.y=-0.15; window.threeProceduralGroup.add(plat);

  // Tower T-101 (distillation column)
  addCylinder(window.threeProceduralGroup,-5,0,-3,1.2,0.9,9,0x1a5a3a,'Torre T-101',true);
  // Reactor R-201
  addCylinder(window.threeProceduralGroup,0,0,0,1.5,1.5,6,0x1a3a8a,'Reactor R-201',true);
  // Reactor dome
  const domeGeo=new THREE.SphereGeometry(1.5,16,8,0,Math.PI*2,0,Math.PI/2);
  const domeMat=new THREE.MeshStandardMaterial({color:0x2266bb,roughness:0.3,metalness:0.6});
  const dome=new THREE.Mesh(domeGeo,domeMat); dome.position.set(0,6,0); window.threeProceduralGroup.add(dome);
  // Exchanger HX-301
  addCylinder(window.threeProceduralGroup,5,0,1,0.8,0.8,4.5,0xaa7700,'HX-301',false,true); // horizontal
  // Storage tank
  addCylinder(window.threeProceduralGroup,3,0,-4,2,2,3,0x2a4a6a,'TK-401',true);
  // Pump P-401
  addBox(window.threeProceduralGroup,-2,0,3,1.2,0.8,0.8,0xaa2233,'Bomba P-401');
  // Pump P-101
  addBox(window.threeProceduralGroup,2,0,3,1.2,0.8,0.8,0x1a5a2a,'Bomba B-101');
  // Control building
  addBox(window.threeProceduralGroup,-7,0,3,3,2.5,2.5,0x1a3050,'Control Room');
  // Pipes (thin cylinders)
  addPipe(window.threeProceduralGroup,-3.5,0.8,-3,3,0.8,-3,0.1,0x2a4a6a);
  addPipe(window.threeProceduralGroup,1.5,0.8,0,5,0.8,0,0.1,0x2a4a6a);
  addPipe(window.threeProceduralGroup,0,0.8,1.5,0,0.8,-1.5,0.1,0x2a4a6a);
  addPipe(window.threeProceduralGroup,-2,0.8,0,-2,0.8,3,0.1,0x8a4a2a);
  // Ladder on tower
  addBox(window.threeProceduralGroup,-4,0,-3,0.06,9,0.06,0x4a8a5a,'');
  addBox(window.threeProceduralGroup,-3.7,0,-3,0.06,9,0.06,0x4a8a5a,'');

  // Raycaster
  window.threeRaycaster=new THREE.Raycaster();
  window.threeMouse=new THREE.Vector2();
  canvas.addEventListener('mousemove',onMouseMove);
  canvas.addEventListener('click',onMouseClick);

  // ── OrbitControls reales: orbit + pan libre + zoom ───────────────
  let threeControls = null;
  if (typeof THREE.OrbitControls !== 'undefined') {
    threeControls = new THREE.OrbitControls(window.threeCamera, window.threeRenderer.domElement);
    threeControls.target.set(0, 3, 0);       // centro inicial de órbita
    threeControls.enableDamping   = true;    // inercia suave
    threeControls.dampingFactor   = 0.06;
    threeControls.enablePan       = true;    // pan con clic derecho
    threeControls.panSpeed        = 0.8;
    threeControls.enableZoom      = true;
    threeControls.zoomSpeed       = 1.0;
    threeControls.minDistance     = 2;       // máximo zoom in
    threeControls.maxDistance     = 80;      // máximo zoom out
    threeControls.maxPolarAngle   = Math.PI * 0.88; // no pasar por debajo del suelo
    threeControls.mouseButtons    = {
      LEFT:   THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT:  THREE.MOUSE.PAN      // clic derecho = pan libre
    };
    threeControls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN  // dos dedos = zoom + pan
    };
    threeControls.addEventListener('start', () => { autoRotate = false; });
    threeControls.update();
    window.threeControls = threeControls;
  }

  // Animate
  let t=0;
  function animate(){
    requestAnimationFrame(animate); t+=0.005;
    if (threeControls) {
      if (autoRotate) {
        // Auto-rotación suave alrededor del target actual
        const angle = 0.003;
        const pos = window.threeCamera.position;
        const tgt = threeControls.target;
        const dx = pos.x - tgt.x, dz = pos.z - tgt.z;
        pos.x = tgt.x + dx * Math.cos(angle) - dz * Math.sin(angle);
        pos.z = tgt.z + dx * Math.sin(angle) + dz * Math.cos(angle);
        window.threeCamera.lookAt(tgt);
      }
      threeControls.update();
    }
    // Animate running equipment
    window.threeObjects.forEach(obj=>{
      if(obj.userData.status==='running'&&obj.userData.type==='pump'){
        obj.rotation.z=Math.sin(t*8)*0.05;
      }
    });
    // Pulse point lights
    pointR.intensity=1.2+Math.sin(t*3)*0.3;
    window.threeRenderer.render(window.threeScene,window.threeCamera);
  }
  animate();
}

function addCylinder(scene,x,y,z,rTop,rBot,h,color,name,vertical=true){
  const geo=new THREE.CylinderGeometry(rTop,rBot,h,16);
  const mat=new THREE.MeshStandardMaterial({color,roughness:0.4,metalness:0.5});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.position.set(x,y+h/2,z);
  if(!vertical){mesh.rotation.z=Math.PI/2;mesh.position.set(x,y+rTop,z);}
  if(name){mesh.userData.name=name;mesh.userData.type='vessel';}
  mesh.castShadow=true;
  scene.add(mesh);
  threeObjects.push(mesh);

  // Highlight ring
  if(name){
    const ringGeo=new THREE.TorusGeometry(rTop*1.1,0.04,8,32);
    const ringMat=new THREE.MeshBasicMaterial({color:0x00d4ff,transparent:true,opacity:0.4});
    const ring=new THREE.Mesh(ringGeo,ringMat);
    ring.position.set(x,y+h-0.3,z);
    scene.add(ring);
  }
}

function addBox(parentGrp,x,y,z,w,h,d,color,name){
  const geo=new THREE.BoxGeometry(w,h,d);
  const mat=new THREE.MeshStandardMaterial({color,roughness:0.5,metalness:0.4});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.position.set(x,y+h/2,z);
  if(name){mesh.userData.name=name;mesh.userData.type='equipment';}
  mesh.castShadow=true;
  parentGrp.add(mesh);
  threeObjects.push(mesh);
}

function addPipe(parentGrp,x1,y1,z1,x2,y2,z2,r,color){
  const dir=new THREE.Vector3(x2-x1,y2-y1,z2-z1);
  const len=dir.length();
  const geo=new THREE.CylinderGeometry(r,r,len,8);
  const mat=new THREE.MeshStandardMaterial({color,roughness:0.6,metalness:0.7});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
  parentGrp.add(mesh);
}

function onMouseMove(e){
  if(!threeRenderer)return;
  const rect=threeRenderer.domElement.getBoundingClientRect();
  threeMouse.x=((e.clientX-rect.left)/rect.width)*2-1;
  threeMouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
}

function onMouseClick(){
  if(!threeRaycaster||!threeCamera)return;
  threeRaycaster.setFromCamera(threeMouse,threeCamera);
  const intersects=threeRaycaster.intersectObjects(threeObjects);
  if(intersects.length>0&&intersects[0].object.userData.name){
    const name=intersects[0].object.userData.name;
    const label=document.getElementById('selectedLabel');
    if(label) label.textContent='● '+name;
    showNotif(`Seleccionado: ${name}`,'info');
    // Publicar al bus de integración (P&ID/Dashboard escuchan)
    if (window.scadaBus) {
      window.scadaBus.emit('tag:select', { tag: name, source: 'hmi' });
    }
  }
}

// ─── Escuchar tag:focus para resaltar objeto 3D ───
if (window.scadaBus) {
  window.scadaBus.on('tag:focus', ({ tag, varId }) => {
    if (!window.threeObjects) return;
    const needle = String(tag || varId || '').toLowerCase();
    const obj = window.threeObjects.find(o =>
      o.userData && o.userData.name &&
      o.userData.name.toLowerCase().includes(needle)
    );
    if (!obj || !obj.material) return;
    const mat = obj.material;
    const prev = mat.emissive ? mat.emissive.getHex() : null;
    if (mat.emissive) {
      mat.emissive.setHex(0x22c55e);
      setTimeout(() => { if (prev !== null) mat.emissive.setHex(prev); }, 1800);
    }
  });
}

function resetCamera(){
  autoRotate=true;
  if(window.threeControls){
    window.threeControls.target.set(0,3,0);
    window.threeCamera.position.set(18,14,18);
    window.threeControls.update();
  }
}
function topView(){
  autoRotate=false;
  if(window.threeCamera){
    window.threeCamera.position.set(0,38,0.1);
    if(window.threeControls){ window.threeControls.target.set(0,0,0); window.threeControls.update(); }
    else window.threeCamera.lookAt(0,0,0);
  }
}
function frontView(){
  autoRotate=false;
  if(window.threeCamera){
    window.threeCamera.position.set(0,8,32);
    if(window.threeControls){ window.threeControls.target.set(0,3,0); window.threeControls.update(); }
    else window.threeCamera.lookAt(0,4,0);
  }
}
function toggle3DWire(){
  window.wireMode=!window.wireMode;
  window.threeObjects.forEach(o=>{if(o.material)o.material.wireframe=window.wireMode;});
}
function toggle3DExplode(){
  window.threeObjects.forEach((o,i)=>{
    if(o.userData.name){
      const dir=new THREE.Vector3(o.position.x,0,o.position.z).normalize();
      o.position.addScaledVector(dir,window.wireMode?-2:2);
    }
  });
}

// ==================== AI CHAT ====================
const aiResponses = {
  'bomba':()=>'⚙️ Estado actual de bombas:\n• B-101: OPERANDO — Caudal 142 m³/h, Presión 4.2 bar\n• B-204: DETENIDA ⚠️ — Vibración crítica 12.4 mm/s\n• Recomendación: Inspección inmediata B-204',
  'temperatura':()=>`🌡️ Temperatura actual TT-101: <strong style="color:var(--accent-red)">${processVars.temp.val}°C</strong>\nLímites: Lo:100°C | Hi:380°C | HiHi:400°C\nEstado: ${processVars.temp.val>380?'⚠️ ALARMA ACTIVA':'✅ Normal'}`,
  'presión':()=>`📊 Presión actual PT-201: <strong style="color:var(--accent-cyan)">${processVars.pres.val} bar</strong>\nEstado: ✅ Dentro de rango`,
  'alarma':()=>'⚠️ Alarmas activas: 7\n• 3 Críticas: TT-101, PT-203, LT-401\n• 2 Altas: FT-301, VT-501\n• 1 Media: AT-601\n• 1 Baja: TT-202',
  'producción':()=>'📈 Producción actual: 4,821 bbl\nMeta diaria: 4,800 bbl ✅ (+0.4%)\nEficiencia: 94.7%',
  'reporte':()=>'📋 Generando reporte... Disponible en: Históricos > Reportes\nFormatos disponibles: PDF, Excel, CSV',
  default:()=>`He procesado tu consulta. Los datos del proceso muestran que todos los sistemas principales están operativos excepto la Bomba B-204 que requiere atención inmediata. ¿Necesitas más detalles sobre algún equipo específico?`
};

function sendAI(){
  const input=document.getElementById('aiInput'); if(!input)return;
  const msg=input.value.trim(); if(!msg)return;
  const msgs=document.getElementById('aiMessages');
  const now=new Date(); const time=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  // Add user msg
  const uDiv=document.createElement('div'); uDiv.className='msg-user';
  uDiv.innerHTML=msg+'<div class="msg-time">'+time+'</div>';
  msgs.appendChild(uDiv);

  input.value='';

  // Find response
  setTimeout(()=>{
    const key=Object.keys(aiResponses).find(k=>msg.toLowerCase().includes(k))||'default';
    const resp=aiResponses[key]();
    const bDiv=document.createElement('div'); bDiv.className='msg-bot';
    bDiv.innerHTML=resp.replace(/\n/g,'<br>')+'<div class="msg-time">'+time+'</div>';
    msgs.appendChild(bDiv);
    msgs.scrollTop=msgs.scrollHeight;
  },600);

  msgs.scrollTop=msgs.scrollHeight;
}

// ==================== NAVIGATION ====================


function filterAlarms(type,el){
  document.querySelectorAll('.hist-filters .filter-chip,.panel-header .filter-chip').forEach(c=>c.classList.remove('active'));
  if(el) el.classList.add('active');
  populateAlarmTable();
}

function setRange(r,el){
  document.querySelectorAll('.hist-filters .filter-chip').forEach(c=>c.classList.remove('active'));
  if(el) el.classList.add('active');
}

// ==================== NOTIFICATIONS ====================

// ==================== PID CANVAS ====================
function drawPID(){
  const canvas=document.getElementById('pidCanvas'); if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const w=canvas.width, h=canvas.height;

  ctx.fillStyle='#030810'; ctx.fillRect(0,0,w,h);

  // Grid
  ctx.strokeStyle='rgba(26,58,92,0.3)'; ctx.lineWidth=1;
  for(let x=0;x<w;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=0;y<h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}

  const drawEquip=(x,y,type,label,status)=>{
    const colors={ok:'#00ff88',alarm:'#ff3355',standby:'#ffaa00'};
    const c=colors[status]||'#00d4ff';
    ctx.strokeStyle=c; ctx.fillStyle='rgba('+hexToRgb(c)+',0.08)';
    ctx.lineWidth=1.5;
    if(type==='pump'){
      ctx.beginPath();ctx.arc(x,y,18,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle=c; ctx.font='10px JetBrains Mono'; ctx.textAlign='center';
      ctx.fillText(label,x,y+30);
    } else if(type==='vessel'){
      ctx.beginPath();ctx.roundRect(x-16,y-28,32,56,4);ctx.fill();ctx.stroke();
      ctx.fillStyle=c; ctx.font='10px JetBrains Mono'; ctx.textAlign='center';
      ctx.fillText(label,x,y+36);
      // Level indicator
      ctx.fillStyle='rgba('+hexToRgb(c)+',0.3)';
      ctx.fillRect(x-14,y,28,22);
    } else if(type==='exchanger'){
      ctx.beginPath();ctx.roundRect(x-24,y-12,48,24,6);ctx.fill();ctx.stroke();
      ctx.fillStyle=c; ctx.font='10px JetBrains Mono'; ctx.textAlign='center';
      ctx.fillText(label,x,y+22);
    } else if(type==='valve'){
      ctx.beginPath();ctx.moveTo(x-8,y-8);ctx.lineTo(x+8,y+8);ctx.moveTo(x+8,y-8);ctx.lineTo(x-8,y+8);
      ctx.strokeStyle=status==='ok'?'#00ff88':'#ffaa00'; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle=c; ctx.font='9px JetBrains Mono'; ctx.textAlign='center';
      ctx.fillText(label,x,y+18);
    }
  };

  const drawPipeLine=(pts,color='#2a6aac',flow=true)=>{
    ctx.strokeStyle=color; ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
    for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);
    ctx.stroke();
    // flow arrow
    if(flow&&pts.length>=2){
      const mid=Math.floor(pts.length/2);
      const dx=pts[mid][0]-pts[mid-1][0], dy=pts[mid][1]-pts[mid-1][1];
      const len=Math.sqrt(dx*dx+dy*dy);
      const mx=(pts[mid][0]+pts[mid-1][0])/2, my=(pts[mid][1]+pts[mid-1][1])/2;
      ctx.fillStyle=color;
      ctx.beginPath();
      ctx.translate(mx,my); ctx.rotate(Math.atan2(dy,dx));
      ctx.moveTo(-6,-5); ctx.lineTo(6,0); ctx.lineTo(-6,5); ctx.closePath(); ctx.fill();
      ctx.setTransform(1,0,0,1,0,0);
    }
  };

  // Draw pipes
  drawPipeLine([[60,150],[130,150],[130,100],[200,100]],'#2a6a8c');
  drawPipeLine([[200,100],[340,100]],'#2a5a8c');
  drawPipeLine([[340,100],[340,150],[460,150]],'#1a4a7c');
  drawPipeLine([[460,150],[460,100],[580,100]],'#2a4a6c');
  drawPipeLine([[580,100],[700,100],[700,150]],'#3a6a8c');
  drawPipeLine([[700,150],[820,150]],'#2a5a8c');
  // Return line
  drawPipeLine([[130,200],[130,250],[700,250],[700,200]],'#1a3a5c');
  // Hot lines
  drawPipeLine([[200,100],[200,200]],'rgba(255,100,50,0.6)');
  drawPipeLine([[580,100],[580,200]],'rgba(255,150,0,0.5)');

  // Instruments (circles)
  const drawInstr=(x,y,tag,val,color='#00d4ff')=>{
    ctx.strokeStyle=color; ctx.fillStyle='rgba(3,8,16,0.9)';
    ctx.lineWidth=1; ctx.beginPath(); ctx.arc(x,y,14,0,Math.PI*2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle=color; ctx.font='bold 8px JetBrains Mono'; ctx.textAlign='center';
    ctx.fillText(tag,x,y-3); ctx.font='8px JetBrains Mono';
    ctx.fillText(val,x,y+7);
  };

  // Draw equipment
  drawEquip(130,150,'pump','P-101','ok');
  drawEquip(270,100,'vessel','T-101','ok');
  drawEquip(460,150,'exchanger','HX-201','standby');
  drawEquip(640,100,'vessel','V-301','ok');
  drawEquip(820,150,'pump','P-201','ok');

  // Draw valves
  drawEquip(200,100,'valve','FCV-01','ok');
  drawEquip(580,100,'valve','TCV-02','ok');

  // Draw instruments
  drawInstr(200,200,'pH ENT','7.0 pH','#34d399');
  drawInstr(340,180,'TURB ENT','5.0 NTU','#f59e0b');
  drawInstr(580,200,'pH SAL','7.2 pH','#00d4ff');
  drawInstr(700,180,'TURB SAL','0.5 NTU','#00ff88');

  // Labels
  ctx.fillStyle='rgba(0,212,255,0.15)'; ctx.fillRect(0,0,w,20);
  ctx.fillStyle='#00d4ff'; ctx.font='bold 11px JetBrains Mono'; ctx.textAlign='left';
  ctx.fillText('P&ID — ÁREA 100 — PROCESO PRINCIPAL', 12, 14);
  ctx.fillStyle='#3a6a8c'; ctx.font='10px JetBrains Mono'; ctx.textAlign='right';
  ctx.fillText('NexSCADA v3.2 | ACTUALIZADO: '+new Date().toLocaleTimeString(), w-12, 14);
}

function hexToRgb(hex){
  const r=parseInt(hex.slice(1,3),16)||0,g=parseInt(hex.slice(3,5),16)||0,b=parseInt(hex.slice(5,7),16)||0;
  return r+','+g+','+b;
}

// ==================== LOGIN ====================


// ==================== INIT ====================
document.addEventListener('DOMContentLoaded',()=>{
  updateClock(); setInterval(updateClock,1000);
  initTicker();
  populateVars();
  populateAlarms();
  populateEquip();
  populateAlarmAreas();

  setTimeout(()=>{
    initCharts();
    initGauges();
    drawPID();
  },200);

  setInterval(updateRealtimeData, 2000);
});
