/**
 * NexSCADA — dashboard-manager.js  v2.0
 * Configuración profunda por tipo · Umbrales auto/manual/off
 * Persistencia localStorage · Live update · Export PNG
 */

// ═══ VARIABLES DE PROCESO (Dinámicas desde VariableManager) ══════
function getAvailableVars() {
  if (window.variableManager && window.variableManager.variables) {
    return window.variableManager.variables;
  }
  // Intento de fallback al localStorage si no ha cargado el manager
  const saved = localStorage.getItem('scada-variables');
  if (saved) {
    try { return JSON.parse(saved); } catch(e) {}
  }
  return [];
}

function _getVar(id) { 
  const vars = getAvailableVars();
  return vars.find(v => v.id === id) || vars[0] || { id:'none', tag:'N/A', unit:'', color:'#64748b' };
}

// ═══ TIPOS DE WIDGET ═════════════════════════════════════════════
const DM_TYPES = [
  { id:'trend',    label:'Tendencia',     icon:'trending-up',  span:2, defaultVar:'Var20' },
  { id:'line',     label:'Línea Simple',  icon:'activity',     span:1, defaultVar:'Var21' },
  { id:'bar',      label:'Barras',        icon:'bar-chart-2',  span:1, defaultVar:'Var22' },
  { id:'doughnut', label:'Anillo / KPI',  icon:'pie-chart',    span:1, defaultVar:'Var20' },
  { id:'radar',    label:'Radar',         icon:'target',       span:1, defaultVar:'Var20' },
  { id:'polar',    label:'Polar',         icon:'aperture',     span:1, defaultVar:'Var20' },
  { id:'bubble',   label:'Burbuja',       icon:'circle',       span:1, defaultVar:'Var20' },
  { id:'gauge',    label:'Gauge KPI',     icon:'zap',          span:1, defaultVar:'Var20' },
  { id:'scatter',  label:'Dispersión',    icon:'maximize-2',   span:1, defaultVar:'Var21' },
  { id:'area',     label:'Área Apilada',  icon:'layers',       span:2, defaultVar:'Var20' },
  { id:'text',     label:'Valor Directo', icon:'type',         span:1, defaultVar:'Var20' },
  { id:'stat',     label:'Tarjeta Stat',  icon:'credit-card',  span:1, defaultVar:'Var22' },
];

// Qué secciones del modal muestra cada tipo
const TYPE_SECTIONS = {
  trend:    { vars:3, axes:true,  range:true,  pts:true,  style:true,  thresh:true,  multiVar:true  },
  line:     { vars:1, axes:true,  range:true,  pts:true,  style:true,  thresh:true,  multiVar:false },
  area:     { vars:3, axes:true,  range:true,  pts:true,  style:true,  thresh:true,  multiVar:true  },
  bar:      { vars:1, axes:true,  range:true,  pts:false, style:false, thresh:false, multiVar:false },
  doughnut: { vars:1, axes:false, range:false, pts:false, style:false, thresh:false, multiVar:false },
  gauge:    { vars:1, axes:false, range:false, pts:false, style:true,  thresh:false, multiVar:false },
  radar:    { vars:1, axes:false, range:false, pts:false, style:true,  thresh:false, multiVar:true  },
  polar:    { vars:1, axes:false, range:false, pts:false, style:false, thresh:false, multiVar:false },
  bubble:   { vars:3, axes:true,  range:false, pts:false, style:true,  thresh:false, multiVar:false },
  scatter:  { vars:2, axes:true,  range:false, pts:false, style:true,  thresh:false, multiVar:false },
  text:     { vars:1, axes:false, range:false, pts:false, style:true,  thresh:false, multiVar:false },
  stat:     { vars:1, axes:false, range:false, pts:false, style:true,  thresh:false, multiVar:false },
};

// ═══ ESTADO INTERNO ══════════════════════════════════════════════
const DM = {
  widgets: {},
  liveInterval: null,
  liveEnabled: true,
  STORAGE_KEY: 'scada_dashboard_v3',
};

// ═══ DATOS REALES ════════════════════════════════════════════════
function _getLiveVal(id) {
  // Intentar obtener de scada-core.js (processVars) que tiene el polling activo
  if(window.processVars && window.processVars[id]) return window.processVars[id].val;
  return null;
}

async function _fetchHist(varId, pts, range='24h') {
  try {
    const v = _getVar(varId);
    if (!v || v.id === 'none') return { labels: [], data: [] };
    
    // Usamos el tag para identificar la serie en el backend
    const url = `http://localhost:5000/api/data/history?table=${v.dbTable}&col=${v.dbVar}&id=${v.dbIdDisp}&var20=${v.dbVar20}&range=${range}`;
    const response = await fetch(url);
    if(!response.ok) throw new Error('API Error');
    const dataPoints = await response.json();
    
    if(!dataPoints || !Array.isArray(dataPoints)) throw new Error('Formato de datos inválido');

    const labels = dataPoints.map(p => {
      const d = new Date(p.x);
      return d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');
    });
    const data = dataPoints.map(p => p.y);
    
    return { labels, data };
  } catch(e) {
    console.warn(`Error API historial (${varId}):`, e);
    return { labels: [], data: [] };
  }
}

// Auto-umbral: percentil 90 como Hi, percentil 10 como Lo
function _autoThreshold(data) {
  const sorted = [...data].sort((a,b)=>a-b);
  const lo = sorted[Math.floor(sorted.length*0.10)];
  const hi = sorted[Math.floor(sorted.length*0.90)];
  return { lo: +lo.toFixed(2), hi: +hi.toFixed(2) };
}

// ═══ CHART DEFAULTS ══════════════════════════════════════════════
const CD = {
  grid:  'rgba(26,58,92,0.25)',
  tick:  '#3a6a8c',
  font:  { family:'JetBrains Mono', size:9 },
  anim:  { duration:300 },
};

function _baseOpts(cfg) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: CD.anim,
    plugins: {
      legend: {
        display: !!cfg.showLegend,
        position: 'bottom',
        labels: { color:'#7aa8cc', font:CD.font, boxWidth:10 },
      },
      tooltip: {
        backgroundColor: 'rgba(13,17,23,0.95)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        titleColor: '#e2e8f0',
        bodyColor: '#94a3b8',
        padding: 10,
        callbacks: {
          label: ctx => ` ${ctx.dataset.label||''}: ${ctx.parsed?.y ?? ctx.parsed ?? ''} ${cfg.unit||''}`,
        },
      },
    },
    scales: {
      x: {
        display: cfg.showX !== false,
        grid: { color: cfg.showGrid!==false ? CD.grid : 'transparent' },
        ticks: { color:CD.tick, font:CD.font, maxTicksLimit:6 },
      },
      y: {
        display: cfg.showY !== false,
        type: cfg.yScale || 'linear',
        min: cfg.yMin !== undefined && cfg.yMin !== '' ? +cfg.yMin : undefined,
        max: cfg.yMax !== undefined && cfg.yMax !== '' ? +cfg.yMax : undefined,
        grid: { color: cfg.showGrid!==false ? CD.grid : 'transparent' },
        ticks: { color:CD.tick, font:CD.font },
      },
    },
  };
}

function _ds(cfg, color, data, label, fill=true) {
  const dash = cfg.lineStyle==='dashed'?[8,4]:cfg.lineStyle==='dotted'?[2,4]:[];
  return {
    label, data,
    borderColor: color,
    backgroundColor: fill ? color+'18' : 'transparent',
    borderWidth: cfg.lineWidth || 2,
    borderDash: dash,
    pointRadius: cfg.showPoints ? 3 : 0,
    pointHoverRadius: 4,
    tension: cfg.smooth!==false ? 0.4 : 0,
    fill: fill && cfg.fill!==false,
  };
}

// ═══ BUILD CHART BY TYPE ═════════════════════════════════════════
async function _buildChart(canvas, type, cfg) {
  const v1 = _getVar(cfg.varId  || 'Var20');
  const v2 = _getVar(cfg.varId2 || 'Var21');
  const v3 = _getVar(cfg.varId3 || 'Var22');
  const pts = cfg.points || 20;
  const opts = _baseOpts({ ...cfg, unit:v1.unit });

  let chartType, data;

  // ── TREND / LINE / AREA ─────────────────────────────────────────
  if(['trend','line','area'].includes(type)) {
    chartType = 'line';
    const h1 = await _fetchHist(v1.id, pts, cfg.range);
    const datasets = [ _ds(cfg, cfg.color||v1.color, h1.data, v1.tag) ];

    if(cfg.multiVar && cfg.varId2) {
      const h2 = await _fetchHist(v2.id, pts, cfg.range);
      datasets.push(_ds(cfg, cfg.color2||v2.color, h2.data, v2.tag));
      opts.plugins.legend.display = true;
    }
    if(cfg.multiVar && cfg.varId3) {
      const h3 = await _fetchHist(v3.id, pts, cfg.range);
      datasets.push(_ds(cfg, cfg.color3||v3.color, h3.data, v3.tag));
    }

    // Umbral automático
    if(cfg.threshMode === 'auto' && h1.data.length > 0) {
      const auto = _autoThreshold(h1.data);
      datasets.push({ label:'⬆ Hi automático', data:Array(h1.data.length).fill(auto.hi),
        borderColor:'#f87171', borderWidth:1.5, borderDash:[6,3], pointRadius:0, fill:false, tension:0 });
      datasets.push({ label:'⬇ Lo automático', data:Array(h1.data.length).fill(auto.lo),
        borderColor:'#fbbf24', borderWidth:1.5, borderDash:[6,3], pointRadius:0, fill:false, tension:0 });
      opts.plugins.legend.display = true;
    } else if(cfg.threshMode === 'manual') {
      const len = h1.data.length || pts;
      if(cfg.hiVal !== undefined && cfg.hiVal !== '') {
        datasets.push({ label:`Hi: ${cfg.hiVal}`, data:Array(len).fill(+cfg.hiVal),
          borderColor:'#f87171', borderWidth:1.5, borderDash:[6,3], pointRadius:0, fill:false, tension:0 });
        opts.plugins.legend.display = true;
      }
      if(cfg.loVal !== undefined && cfg.loVal !== '') {
        datasets.push({ label:`Lo: ${cfg.loVal}`, data:Array(len).fill(+cfg.loVal),
          borderColor:'#fbbf24', borderWidth:1.5, borderDash:[6,3], pointRadius:0, fill:false, tension:0 });
        opts.plugins.legend.display = true;
      }
    }
    data = { labels: h1.labels, datasets };
  }

  // ── BAR ─────────────────────────────────────────────────────────
  else if(type === 'bar') {
    chartType = 'bar';
    const h = await _fetchHist(v1.id, 8, cfg.range);
    const color = cfg.color || v1.color;
    data = {
      labels: h.labels,
      datasets: [{
        label: v1.tag, data: h.data,
        backgroundColor: color+'cc', borderColor: color,
        borderWidth:1, borderRadius:5, borderSkipped:false,
      }],
    };
    opts.scales.x.grid = { display: false };
  }

  // ── DOUGHNUT ────────────────────────────────────────────────────
  else if(type === 'doughnut') {
    chartType = 'doughnut';
    const colors = ['#00d4ff','#ff3355','#a78bfa','#34d399','#f59e0b'];
    // Sin simulación: devolvemos vacío si no hay lógica real para doughnut por ahora
    data = { labels: [], datasets: [] };
    delete opts.scales;
    opts.cutout = '55%';
    opts.plugins.legend = { display:true, position:'right',
      labels:{ color:'#7aa8cc', font:CD.font, boxWidth:10, padding:14 } };
  }

  // ── GAUGE ───────────────────────────────────────────────────────
  else if(type === 'gauge') {
    chartType = 'doughnut';
    const val = _getLiveVal(v1.id) || 0;
    const minVal = v1.min || 0;
    const maxVal = v1.max || 100;
    const pct = Math.max(0, Math.min(100, Math.round((val - minVal)/(maxVal - minVal)*100)));
    const c = cfg.color || v1.color;
    data = {
      labels:['Valor','Restante'],
      datasets:[{ data:[pct, 100-pct],
        backgroundColor:[c,'#1a2744'], borderWidth:0, borderRadius:4 }],
    };
    delete opts.scales;
    opts.cutout = '80%';
    opts.rotation = -90;
    opts.circumference = 180;
    opts.plugins.legend = { display:false };
    opts.plugins.gaugeCenter = { val: val.toFixed(1), unit: v1.unit, pct };
  }

  // ── RADAR ───────────────────────────────────────────────────────
  else if(type === 'radar') {
    chartType = 'radar';
    data = { labels: [], datasets: [] };
    delete opts.scales;
  }

  // ── POLAR ───────────────────────────────────────────────────────
  else if(type === 'polar') {
    chartType = 'polarArea';
    data = { labels: [], datasets: [] };
    delete opts.scales;
  }

  // ── BUBBLE ──────────────────────────────────────────────────────
  else if(type === 'bubble') {
    chartType = 'bubble';
    data = { datasets: [] };
  }

  // ── SCATTER ─────────────────────────────────────────────────────
  else if(type === 'scatter') {
    chartType = 'scatter';
    data = { datasets: [] };
  }

  // ── DEFAULT ─────────────────────────────────────────────────────
  else {
    chartType = 'line';
    data = { labels: [], datasets: [] };
  }

  const chart = new Chart(canvas, { type:chartType, data, options:opts });

  // Plugin: valor central para gauge
  if(type === 'gauge' && opts.plugins.gaugeCenter) {
    const info = opts.plugins.gaugeCenter;
    const pluginId = 'gc_' + canvas.id;
    Chart.register({
      id: pluginId,
      afterDraw(c) {
        if(c.canvas.id !== canvas.id) return;
        const {ctx, width, height} = c;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cy = height * 0.72;
        ctx.fillStyle = cfg.color || '#00d4ff';
        ctx.font = `bold 28px 'Rajdhani',sans-serif`;
        ctx.fillText(info.val, width/2, cy);
        ctx.fillStyle = '#64748b';
        ctx.font = `10px 'JetBrains Mono',monospace`;
        ctx.fillText(info.unit, width/2, cy + 22);
        ctx.fillStyle = '#475569';
        ctx.font = `9px 'JetBrains Mono',monospace`;
        ctx.fillText(`${info.pct}%`, width/2, cy + 38);
        ctx.restore();
      }
    });
  }

  return chart;
}

// ═══ LIVE UPDATE ═════════════════════════════════════════════════
function _liveUpdate(wid) {
  const w = DM.widgets[wid];
  if(!w || !w.config) return;
  const cfg = w.config;

  // Actualizar solo el value en text/stat (No tienen Chart.js)
  if(['text','stat'].includes(cfg.type)) {
    const el = document.getElementById('dm_val_'+wid);
    if(el) {
      const live = _getLiveVal(cfg.varId || 'Var20');
      el.textContent = (live !== null && live !== undefined) ? live.toFixed(1) : '---';
    }
    return;
  }

  // A partir de aquí necesitamos el objeto chart
  if(!w.chart) return;
  const chart = w.chart;

  if (!chart.data || !Array.isArray(chart.data.labels) || !Array.isArray(chart.data.datasets)) {
    return;
  }

  if(['doughnut','gauge','radar','polar','bubble','scatter'].includes(cfg.type)) {
    // Otros tipos que tienen chart pero lógica distinta o no implementada en live
    return;
  }

  const now = new Date();
  const lbl = now.getHours()+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
  const maxPts = cfg.points || 20;
  chart.data.labels.push(lbl);
  if(chart.data.labels.length > maxPts) chart.data.labels.shift();
  chart.data.datasets.forEach((ds,i) => {
    if(ds.label && (ds.label.startsWith('⬆') || ds.label.startsWith('⬇') || ds.label.startsWith('Hi:') || ds.label.startsWith('Lo:'))) return;
    const varId = i===0?(cfg.varId||'Var20'):i===1?(cfg.varId2||'Var21'):(cfg.varId3||'Var22');
    const live = _getLiveVal(varId);
    if (live !== null) ds.data.push(live);
    else ds.data.push(null);
    if(ds.data.length > maxPts) ds.data.shift();
  });
  chart.update('none');
}

function _startLive() {
  if(DM.liveInterval) clearInterval(DM.liveInterval);
  DM.liveInterval = setInterval(() => {
    try {
      if(!DM.liveEnabled) return;
      Object.keys(DM.widgets).forEach(wid => {
        try { _liveUpdate(wid); } catch(e) { console.error(`[Dashboard] Error actualizando widget ${wid}:`, e); }
      });
    } catch(err) { console.error("[Dashboard] Error fatal en intervalo live:", err); }
  }, 2500);
}

// ═══ PERSISTENCIA ════════════════════════════════════════════════
function _save() {
  try {
    localStorage.setItem(DM.STORAGE_KEY, JSON.stringify(
      Object.entries(DM.widgets).map(([wid,w])=>({
        id:wid, type:w.config.type, cfg:w.config,
        span: w.panelEl?.style.gridColumn || 'span 1',
      }))
    ));
  } catch(e) {}
}

async function _load() {
  try {
    const raw = localStorage.getItem(DM.STORAGE_KEY);
    if(!raw) return;
    const layout = JSON.parse(raw);
    if(!Array.isArray(layout) || !layout.length) return;
    const empty = document.getElementById('emptyDashboardState');
    if(empty) empty.style.display = 'none';
    for(const item of layout) {
      await _createWidget(item.type, item.cfg, item.id, item.span);
    }
  } catch(e) {}
}

// ═══ CREAR WIDGET ════════════════════════════════════════════════
async function _createWidget(type, cfg, wid, span) {
  const grid = document.getElementById('activeWidgetsGrid');
  if(!grid) return;
  cfg = cfg || {};
  cfg.type = type;
  wid  = wid  || ('w_' + Math.random().toString(36).substr(2,8));
  const typeDef = DM_TYPES.find(t=>t.id===type) || DM_TYPES[0];
  span = span || ('span ' + typeDef.span);
  const v1 = _getVar(cfg.varId || typeDef.defaultVar || 'ph_ent');
  cfg.color = cfg.color || v1.color;

  const isText = type==='text' || type==='stat';
  const canvasId = 'dm_c_'+wid;

  // Panel
  const panel = document.createElement('div');
  panel.className = 'panel fade-in';
  panel.dataset.wid = wid;
  panel.dataset.varId = v1.id;
  panel.style.cssText = `grid-column:${span};transition:grid-column 0.25s,box-shadow .3s,outline-color .3s;position:relative`;

  // Obtener datos iniciales (API o sim)
  let hist = { labels:[], data:[] };
  if(!isText) {
    hist = await _fetchHist(cfg.varId || typeDef.defaultVar, cfg.points || 20);
  }

  // Header
  const header = document.createElement('div');
  header.className = 'panel-header';
  header.style.cssText = 'position:relative;user-select:none';
  const titleTxt = cfg.title || typeDef.label;

  header.innerHTML = `
    <div class="panel-title dm-title" style="cursor:pointer" title="Click: ver tag en P&ID / HMI">${titleTxt}</div>
    <span class="dm-badge" style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.06em;color:var(--text-muted);margin-left:8px;cursor:pointer" title="Click: ver tag en P&ID / HMI">${v1.tag}·${v1.unit}</span>
    <div class="panel-badge live" style="margin-left:8px">● LIVE</div>
    <div class="panel-spacer"></div>`;

  // Click en título o badge → emitir tag:select
  if (window.scadaBus) {
    const emit = (e) => {
      e.stopPropagation();
      window.scadaBus.emit('tag:select', { varId: v1.id, tag: v1.tag, source: 'dashboard' });
    };
    header.querySelector('.dm-title')?.addEventListener('click', emit);
    header.querySelector('.dm-badge')?.addEventListener('click', emit);
  }

  const menuBtn = document.createElement('button');
  menuBtn.style.cssText = 'background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px 6px;display:flex;align-items:center;border-radius:6px;transition:background 0.15s;position:relative';
  menuBtn.innerHTML = '<i data-feather="more-horizontal" style="width:15px;height:15px;pointer-events:none"></i>';
  menuBtn.onmouseover = ()=>menuBtn.style.background='rgba(255,255,255,0.06)';
  menuBtn.onmouseout  = ()=>menuBtn.style.background='none';
  header.appendChild(menuBtn);
  panel.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'panel-body';
  body.style.padding = '8px 14px 14px';

  if(isText) {
    const val = _getLiveVal(v1.id) || 0;
    const delta = (Math.random()>0.5?'+':'-')+(Math.random()*5).toFixed(1)+'%'; // Delta random is acceptable as placeholder since we don't have trend in live API yet, but user asked for ABSOLUTE cleanup. Let's make it 0%
    const delta_val = '0.0%';
    const dc = 'var(--text-muted)';
    const pct = Math.max(0, Math.min(100, Math.round(((val-(v1.min||0))/((v1.max||100)-(v1.min||0)))*100)));
    body.innerHTML = type==='stat'
      ? `<div style="padding:6px 2px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.12em;color:var(--text-muted);margin-bottom:8px">${v1.tag}</div>
          <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px">
            <div id="dm_val_${wid}" style="font-family:'Rajdhani',sans-serif;font-size:52px;font-weight:800;color:${cfg.color};line-height:1;text-shadow:0 0 24px ${cfg.color}44">${val.toFixed(1)}</div>
            <div style="font-size:20px;color:var(--text-muted)">${v1.unit}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <span style="font-size:12px;font-weight:700;color:${dc}">${delta_val}</span>
            <span style="font-size:11px;color:var(--text-muted)">vs hora anterior</span>
          </div>
          <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${cfg.color};border-radius:2px;transition:width 1s"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px">
            <span style="font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--text-muted)">${v1.min}</span>
            <span style="font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--text-muted)">${v1.max} ${v1.unit}</span>
          </div>
         </div>`
      : `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:170px;gap:4px">
          <div id="dm_val_${wid}" style="font-family:'Rajdhani',sans-serif;font-size:72px;font-weight:800;color:${cfg.color};line-height:1;text-shadow:0 0 30px ${cfg.color}55">${val.toFixed(1)}</div>
          <div style="font-size:20px;color:var(--text-muted);margin-top:4px">${v1.unit}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.12em;color:var(--text-muted);margin-top:6px">${v1.tag}</div>
         </div>`;
  } else {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;height:220px;width:100%';
    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    wrap.appendChild(canvas);
    body.appendChild(wrap);
  }

  panel.appendChild(body);
  grid.appendChild(panel);

  DM.widgets[wid] = { config:cfg, chart:null, panelEl:panel };

  if(!isText) {
    setTimeout(async ()=>{
      const canvas = document.getElementById(canvasId);
      if(!canvas) return;
      const chart = await _buildChart(canvas, type, cfg);
      DM.widgets[wid].chart = chart;
      const menu = _buildMenu(wid, panel);
      header.appendChild(menu);
      menuBtn.addEventListener('click', e=>{
        e.stopPropagation();
        const open = menu.style.display==='block';
        document.querySelectorAll('.dm-ctx-menu').forEach(m=>m.style.display='none');
        menu.style.display = open?'none':'block';
        if(typeof feather!=='undefined') feather.replace();
      });
      document.addEventListener('click', ()=>menu.style.display='none');
    }, 80);
  } else {
    setTimeout(()=>{
      const menu = _buildMenu(wid, panel);
      header.appendChild(menu);
      menuBtn.addEventListener('click', e=>{
        e.stopPropagation();
        document.querySelectorAll('.dm-ctx-menu').forEach(m=>m.style.display='none');
        menu.style.display = menu.style.display==='block'?'none':'block';
        if(typeof feather!=='undefined') feather.replace();
      });
      document.addEventListener('click', ()=>menu.style.display='none');
    }, 40);
  }

  if(typeof feather!=='undefined') feather.replace();
  _save();
  return wid;
}

// ═══ MENÚ CONTEXTUAL ═════════════════════════════════════════════
function _buildMenu(wid, panelEl) {
  const menu = document.createElement('div');
  menu.className = 'dm-ctx-menu';
  menu.style.cssText = 'position:absolute;right:0;top:32px;z-index:300;background:var(--bg-card2,#1c2333);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.6);padding:4px;min-width:200px;display:none';

  const IT = 'display:flex;align-items:center;gap:9px;width:100%;padding:9px 12px;font-size:13px;background:none;border:none;cursor:pointer;border-radius:7px;color:var(--text-secondary,#94a3b8);text-align:left';

  const btn = (icon, label, fn, danger=false) => {
    const b = document.createElement('button');
    b.style.cssText = IT + (danger?';color:var(--accent-red,#f87171)':'');
    b.innerHTML = `<i data-feather="${icon}" style="width:14px;height:14px;flex-shrink:0;pointer-events:none"></i>${label}`;
    b.onmouseover = ()=>{ b.style.background=danger?'rgba(248,113,113,0.08)':'rgba(255,255,255,0.05)'; if(!danger)b.style.color='var(--text-primary)'; };
    b.onmouseout  = ()=>{ b.style.background='none'; if(!danger)b.style.color='var(--text-secondary,#94a3b8)'; };
    b.addEventListener('click', e=>{ e.stopPropagation(); menu.style.display='none'; fn(); });
    return b;
  };

  const sep = ()=>{ const d=document.createElement('div'); d.style.cssText='height:1px;background:var(--border,rgba(255,255,255,0.08));margin:3px 8px'; return d; };

  menu.appendChild(btn('sliders',   'Editar configuración', ()=>_openModal(wid)));
  menu.appendChild(sep());
  menu.appendChild(btn('minimize-2','1 columna',            ()=>{ panelEl.style.gridColumn='span 1'; _save(); }));
  menu.appendChild(btn('maximize-2','2 columnas',           ()=>{ panelEl.style.gridColumn='span 2'; _save(); }));
  menu.appendChild(btn('layout',    'Ancho completo',       ()=>{ panelEl.style.gridColumn='span 3'; _save(); }));
  menu.appendChild(sep());
  menu.appendChild(btn('refresh-cw','Actualizar datos',     ()=>_refreshWidget(wid)));
  menu.appendChild(btn('image',     'Exportar PNG',         ()=>_exportPNG(wid)));
  menu.appendChild(sep());
  menu.appendChild(btn('trash-2',   'Eliminar widget',      ()=>{
    if(DM.widgets[wid]?.chart) DM.widgets[wid].chart.destroy();
    delete DM.widgets[wid];
    panelEl.remove();
    _save();
    const grid = document.getElementById('activeWidgetsGrid');
    if(grid && grid.children.length===0) {
      const empty = document.getElementById('emptyDashboardState');
      if(empty) empty.style.display='flex';
    }
  }, true));

  return menu;
}

// ═══ REFRESH & EXPORT ════════════════════════════════════════════
function _refreshWidget(wid) {
  const w = DM.widgets[wid];
  if(!w) return;
  if(w.chart) {
    w.chart.destroy();
    const canvas = w.panelEl.querySelector('canvas');
    if(canvas) { 
      _buildChart(canvas, w.config.type, w.config).then(chart => {
        DM.widgets[wid].chart = chart;
      });
    }
  }
  if(typeof showNotif==='function') showNotif('Datos actualizados','info',1500);
}

function _exportPNG(wid) {
  const w = DM.widgets[wid];
  if(!w?.chart) { if(typeof showNotif==='function') showNotif('Sin gráfico para exportar','warning'); return; }
  const a = document.createElement('a');
  a.href = w.chart.toBase64Image('image/png',1);
  a.download = (w.config.title||'widget')+'_'+Date.now()+'.png';
  a.click();
  if(typeof showNotif==='function') showNotif('Imagen exportada','success');
}

// ═══ MODAL DE EDICIÓN ════════════════════════════════════════════
function _ensureModal() {
  if(document.getElementById('dmEditModal')) {
    // Actualizar lista de variables por si cambió
    const sel1 = document.getElementById('dm_var1');
    const sel2 = document.getElementById('dm_var2');
    const sel3 = document.getElementById('dm_var3');
    const vOpts = getAvailableVars().map(v=>`<option value="${v.id}">${v.tag} (${v.unit})</option>`).join('');
    const vOpts0 = `<option value="">-- ninguna --</option>` + vOpts;
    if(sel1) sel1.innerHTML = vOpts;
    if(sel2) sel2.innerHTML = vOpts0;
    if(sel3) sel3.innerHTML = vOpts0;
    return;
  }
  const vOpts = getAvailableVars().map(v=>`<option value="${v.id}">${v.tag} (${v.unit})</option>`).join('');
  const vOpts0 = `<option value="">-- ninguna --</option>` + vOpts;

  const S = `background:var(--bg-card,#161b27);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:8px;padding:9px 12px;font-size:13px;color:var(--text-primary,#e2e8f0);width:100%;outline:none`;
  const LBL = `font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;color:var(--text-muted);display:block;margin-bottom:5px`;
  const SEC = (t)=>`<div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.12em;color:var(--text-muted);margin:0 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)">${t}</div>`;

  const el = document.createElement('div');
  el.id = 'dmEditModal';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);display:none;align-items:center;justify-content:center;z-index:9500;backdrop-filter:blur(6px)';

  el.innerHTML = `
    <div style="background:var(--bg-card2,#1c2333);border:1px solid var(--border);border-radius:18px;width:100%;max-width:660px;max-height:92vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,0.7);display:flex;flex-direction:column">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:20px 26px 16px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg-card2);z-index:10;border-radius:18px 18px 0 0">
        <h5 style="margin:0;font-size:16px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:10px">
          <i data-feather="sliders" style="width:18px;height:18px;color:var(--primary,#638bff)"></i>
          Configurar Widget — <span id="dm_typeLabel" style="color:var(--text-muted);font-size:13px;font-weight:400"></span>
        </h5>
        <button onclick="document.getElementById('dmEditModal').style.display='none'"
          style="background:none;border:none;color:var(--text-muted);font-size:24px;cursor:pointer;line-height:1;padding:0">×</button>
      </div>

      <div id="dmModalBody" style="padding:22px 26px;display:flex;flex-direction:column;gap:18px">

        <!-- GENERAL (siempre visible) -->
        <div>
          ${SEC('GENERAL')}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div style="grid-column:span 2">
              <label style="${LBL}">TÍTULO DEL WIDGET</label>
              <input id="dm_title" style="${S}" placeholder="Nombre del widget">
            </div>
            <div>
              <label style="${LBL}">TAMAÑO</label>
              <select id="dm_span" style="${S}">
                <option value="span 1">1 columna</option>
                <option value="span 2">2 columnas</option>
                <option value="span 3">Ancho completo (3)</option>
              </select>
            </div>
            <div>
              <label style="${LBL}">ACTUALIZACIÓN LIVE</label>
              <select id="dm_liveMode" style="${S}">
                <option value="on">Activada (2.5s)</option>
                <option value="off">Desactivada</option>
              </select>
            </div>
          </div>
        </div>

        <!-- VARIABLES -->
        <div id="sec_vars">
          ${SEC('VARIABLES DE PROCESO')}
          <div style="display:flex;flex-direction:column;gap:10px">
            <div>
              <label style="${LBL}">VARIABLE PRINCIPAL</label>
              <select id="dm_var1" style="${S}">${vOpts}</select>
            </div>
            <div id="sec_var2" style="display:none">
              <label style="${LBL}" id="lbl_var2">VARIABLE 2</label>
              <select id="dm_var2" style="${S}">${vOpts0}</select>
            </div>
            <div id="sec_var3" style="display:none">
              <label style="${LBL}">VARIABLE 3</label>
              <select id="dm_var3" style="${S}">${vOpts0}</select>
            </div>
            <div id="sec_multiVar" style="display:none">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);cursor:pointer">
                <input type="checkbox" id="dm_multiVar" style="accent-color:var(--primary)"> Mostrar múltiples variables en el mismo gráfico
              </label>
            </div>
          </div>
        </div>

        <!-- EJES Y RANGO -->
        <div id="sec_axes">
          ${SEC('EJES Y RANGO')}
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">
            <div>
              <label style="${LBL}">Y MÍNIMO</label>
              <input id="dm_ymin" type="number" style="${S}" placeholder="Auto">
            </div>
            <div>
              <label style="${LBL}">Y MÁXIMO</label>
              <input id="dm_ymax" type="number" style="${S}" placeholder="Auto">
            </div>
            <div id="sec_pts">
              <label style="${LBL}">PUNTOS</label>
              <input id="dm_pts" type="number" min="5" max="120" style="${S}" value="20">
            </div>
            <div>
              <label style="${LBL}">ESCALA Y</label>
              <select id="dm_yscale" style="${S}">
                <option value="linear">Lineal</option>
                <option value="logarithmic">Logarítmica</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);cursor:pointer">
              <input type="checkbox" id="dm_showX" checked style="accent-color:var(--primary)"> Mostrar eje X
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);cursor:pointer">
              <input type="checkbox" id="dm_showY" checked style="accent-color:var(--primary)"> Mostrar eje Y
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);cursor:pointer">
              <input type="checkbox" id="dm_showGrid" checked style="accent-color:var(--primary)"> Cuadrícula
            </label>
          </div>
        </div>

        <!-- UMBRALES -->
        <div id="sec_thresh">
          ${SEC('UMBRALES DE ALARMA')}
          <!-- Modo selector -->
          <div style="display:flex;gap:8px;margin-bottom:14px">
            <button id="tbOff"    onclick="_setThreshMode('off')"    style="flex:1;padding:8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;border:1px solid var(--border);background:none;color:var(--text-secondary)">
              Sin umbral
            </button>
            <button id="tbAuto"   onclick="_setThreshMode('auto')"   style="flex:1;padding:8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;border:1px solid var(--border);background:none;color:var(--text-secondary)">
              ⚡ Automático
            </button>
            <button id="tbManual" onclick="_setThreshMode('manual')" style="flex:1;padding:8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;border:1px solid var(--border);background:none;color:var(--text-secondary)">
              ✎ Manual
            </button>
          </div>
          <div id="thresh_auto_info" style="display:none;padding:10px 14px;background:rgba(99,139,255,0.08);border:1px solid rgba(99,139,255,0.2);border-radius:8px;font-size:12px;color:var(--text-secondary)">
            Los umbrales se calculan automáticamente como el <strong style="color:var(--text-primary)">percentil 90 (Hi)</strong> y <strong style="color:var(--text-primary)">percentil 10 (Lo)</strong> de los datos históricos visibles. Excluye datos anormalmente altos o bajos.
          </div>
          <div id="thresh_manual_fields" style="display:none;display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="${LBL};color:#f87171">UMBRAL HI (línea roja)</label>
              <input id="dm_hiVal" type="number" style="${S};border-color:rgba(248,113,113,0.3)" placeholder="Ej: 380">
            </div>
            <div>
              <label style="${LBL};color:#fbbf24">UMBRAL LO (línea ámbar)</label>
              <input id="dm_loVal" type="number" style="${S};border-color:rgba(251,191,36,0.3)" placeholder="Ej: 50">
            </div>
          </div>
        </div>

        <!-- ESTILO VISUAL -->
        <div id="sec_style">
          ${SEC('ESTILO VISUAL')}
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
            <div>
              <label style="${LBL}">COLOR PRINCIPAL</label>
              <input id="dm_color1" type="color" style="width:100%;height:38px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;cursor:pointer;padding:2px 4px">
            </div>
            <div id="sec_color2" style="display:none">
              <label style="${LBL}">COLOR 2</label>
              <input id="dm_color2" type="color" value="#ff3355" style="width:100%;height:38px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;cursor:pointer;padding:2px 4px">
            </div>
            <div id="sec_color3" style="display:none">
              <label style="${LBL}">COLOR 3</label>
              <input id="dm_color3" type="color" value="#00ff88" style="width:100%;height:38px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;cursor:pointer;padding:2px 4px">
            </div>
          </div>
          <div id="sec_lineStyle">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
              <div>
                <label style="${LBL}">TIPO DE LÍNEA</label>
                <select id="dm_linestyle" style="${S}">
                  <option value="solid">Sólida ────</option>
                  <option value="dashed">Segmentada ─ ─ ─</option>
                  <option value="dotted">Punteada · · ·</option>
                </select>
              </div>
              <div>
                <label style="${LBL}">GROSOR (px)</label>
                <input id="dm_linewidth" type="number" min="1" max="8" value="2" style="${S}">
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px">
              <label style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text-secondary);cursor:pointer">
                <input type="checkbox" id="dm_fill" checked style="accent-color:var(--primary)"> Relleno
              </label>
              <label style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text-secondary);cursor:pointer">
                <input type="checkbox" id="dm_smooth" checked style="accent-color:var(--primary)"> Suavizado
              </label>
              <label style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text-secondary);cursor:pointer">
                <input type="checkbox" id="dm_showPoints" style="accent-color:var(--primary)"> Puntos
              </label>
              <label style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text-secondary);cursor:pointer">
                <input type="checkbox" id="dm_showLegend" style="accent-color:var(--primary)"> Leyenda
              </label>
            </div>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div style="display:flex;gap:10px;justify-content:flex-end;padding:14px 26px;border-top:1px solid var(--border);position:sticky;bottom:0;background:var(--bg-card2);border-radius:0 0 18px 18px">
        <button onclick="document.getElementById('dmEditModal').style.display='none'"
          style="background:none;border:1px solid var(--border);color:var(--text-secondary);border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">Cancelar</button>
        <button id="dmApplyBtn"
          style="background:var(--primary,#638bff);border:none;color:#fff;border-radius:8px;padding:9px 22px;font-size:13px;font-weight:600;cursor:pointer">
          Aplicar cambios
        </button>
      </div>
    </div>`;

  el.addEventListener('click', e=>{ if(e.target===el) el.style.display='none'; });
  document.body.appendChild(el);
  if(typeof feather!=='undefined') feather.replace();
}

// Cambiar modo de umbral con feedback visual
window._setThreshMode = function(mode) {
  document.getElementById('dm_threshMode').value = mode;
  ['Off','Auto','Manual'].forEach(m=>{
    const btn = document.getElementById('tb'+m);
    if(!btn) return;
    const isActive = m.toLowerCase() === mode;
    btn.style.background = isActive ? 'var(--primary,#638bff)' : 'none';
    btn.style.color  = isActive ? '#fff' : 'var(--text-secondary)';
    btn.style.border = isActive ? '1px solid var(--primary)' : '1px solid var(--border)';
  });
  const autoInfo    = document.getElementById('thresh_auto_info');
  const manualFields = document.getElementById('thresh_manual_fields');
  if(autoInfo)    autoInfo.style.display     = mode==='auto'   ? 'block' : 'none';
  if(manualFields) manualFields.style.display = mode==='manual' ? 'grid'  : 'none';
};

window.updateWidgetSelectors = function() {
  _ensureModal();
};

function _openModal(wid) {
  _ensureModal();
  const w = DM.widgets[wid];
  if(!w) return;
  const cfg = w.config;
  const type = cfg.type;
  const sec = TYPE_SECTIONS[type] || TYPE_SECTIONS.line;
  const typeDef = DM_TYPES.find(t=>t.id===type) || DM_TYPES[0];
  const modal = document.getElementById('dmEditModal');

  // Label de tipo en el header
  document.getElementById('dm_typeLabel').textContent = typeDef.label;

  // Agregar hidden input para thresh mode si no existe
  if(!document.getElementById('dm_threshMode')) {
    const hi = document.createElement('input');
    hi.type='hidden'; hi.id='dm_threshMode'; hi.value='off';
    document.getElementById('dmEditModal').appendChild(hi);
  }

  // Mostrar/ocultar secciones según tipo
  const show = (id, visible) => {
    const el = document.getElementById(id);
    if(el) el.style.display = visible ? '' : 'none';
  };

  show('sec_vars',     true);
  show('sec_var2',     sec.vars >= 2);
  show('sec_var3',     sec.vars >= 3);
  show('sec_multiVar', sec.multiVar);
  show('sec_color2',   sec.vars >= 2);
  show('sec_color3',   sec.vars >= 3);
  show('sec_axes',     sec.axes);
  show('sec_pts',      sec.pts);
  show('sec_thresh',   sec.thresh);
  show('sec_style',    sec.style);
  show('sec_lineStyle',['trend','line','area'].includes(type));

  // Etiqueta especial var2 para bubble/scatter
  const lblVar2 = document.getElementById('lbl_var2');
  if(lblVar2) {
    if(type==='bubble') lblVar2.textContent = 'VARIABLE EJE Y';
    else if(type==='scatter') lblVar2.textContent = 'VARIABLE EJE Y';
    else lblVar2.textContent = 'VARIABLE 2';
  }

  const g = id => document.getElementById(id);

  // Precargar valores
  g('dm_title').value      = cfg.title || typeDef.label;
  g('dm_span').value       = w.panelEl?.style.gridColumn || ('span ' + typeDef.span);
  g('dm_liveMode').value   = cfg.liveOff ? 'off' : 'on';
  g('dm_var1').value       = cfg.varId  || typeDef.defaultVar || 'temp';
  if(g('dm_var2')) g('dm_var2').value = cfg.varId2 || '';
  if(g('dm_var3')) g('dm_var3').value = cfg.varId3 || '';
  if(g('dm_multiVar')) g('dm_multiVar').checked = !!cfg.multiVar;
  if(sec.axes) {
    g('dm_ymin').value      = cfg.yMin !== undefined ? cfg.yMin : '';
    g('dm_ymax').value      = cfg.yMax !== undefined ? cfg.yMax : '';
    g('dm_pts').value       = cfg.points || 20;
    g('dm_yscale').value    = cfg.yScale || 'linear';
    g('dm_showX').checked   = cfg.showX  !== false;
    g('dm_showY').checked   = cfg.showY  !== false;
    g('dm_showGrid').checked= cfg.showGrid !== false;
  }
  if(sec.thresh) {
    const mode = cfg.threshMode || 'off';
    window._setThreshMode(mode);
    if(g('dm_threshMode')) g('dm_threshMode').value = mode;
    if(g('dm_hiVal')) g('dm_hiVal').value = cfg.hiVal ?? '';
    if(g('dm_loVal')) g('dm_loVal').value = cfg.loVal ?? '';
  }
  if(sec.style) {
    g('dm_color1').value    = cfg.color  || _getVar(cfg.varId||'temp').color;
    if(g('dm_color2')) g('dm_color2').value = cfg.color2 || '#ff3355';
    if(g('dm_color3')) g('dm_color3').value = cfg.color3 || '#00ff88';
    if(['trend','line','area'].includes(type)) {
      g('dm_linestyle').value = cfg.lineStyle || 'solid';
      g('dm_linewidth').value = cfg.lineWidth || 2;
      g('dm_fill').checked    = cfg.fill !== false;
      g('dm_smooth').checked  = cfg.smooth !== false;
      g('dm_showPoints').checked = !!cfg.showPoints;
      g('dm_showLegend').checked = !!cfg.showLegend;
    }
  }

  // Apply button
  const oldBtn = g('dmApplyBtn');
  const newBtn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);
  newBtn.addEventListener('click', async ()=>{
    const newCfg = {
      ...cfg,
      title:      g('dm_title').value || typeDef.label,
      liveOff:    g('dm_liveMode').value === 'off',
      varId:      g('dm_var1').value,
      varId2:     g('dm_var2')?.value || null,
      varId3:     g('dm_var3')?.value || null,
      multiVar:   g('dm_multiVar')?.checked || false,
      yMin:       g('dm_ymin')?.value !== '' ? parseFloat(g('dm_ymin').value) : undefined,
      yMax:       g('dm_ymax')?.value !== '' ? parseFloat(g('dm_ymax').value) : undefined,
      points:     parseInt(g('dm_pts')?.value) || 20,
      yScale:     g('dm_yscale')?.value || 'linear',
      showX:      g('dm_showX')?.checked !== false,
      showY:      g('dm_showY')?.checked !== false,
      showGrid:   g('dm_showGrid')?.checked !== false,
      threshMode: g('dm_threshMode')?.value || 'off',
      hiVal:      g('dm_hiVal')?.value !== '' ? parseFloat(g('dm_hiVal').value) : undefined,
      loVal:      g('dm_loVal')?.value !== '' ? parseFloat(g('dm_loVal').value) : undefined,
      color:      g('dm_color1')?.value || cfg.color,
      color2:     g('dm_color2')?.value,
      color3:     g('dm_color3')?.value,
      lineStyle:  g('dm_linestyle')?.value || 'solid',
      lineWidth:  parseInt(g('dm_linewidth')?.value) || 2,
      fill:       g('dm_fill')?.checked !== false,
      smooth:     g('dm_smooth')?.checked !== false,
      showPoints: !!g('dm_showPoints')?.checked,
      showLegend: !!g('dm_showLegend')?.checked,
    };
    const span = g('dm_span').value;
    w.panelEl.style.gridColumn = span;

    // Actualizar UI
    const titleEl = w.panelEl.querySelector('.dm-title');
    if(titleEl) titleEl.textContent = newCfg.title;
    const badge = w.panelEl.querySelector('.dm-badge');
    const newV = _getVar(newCfg.varId);
    if(badge) badge.textContent = newV.tag+'·'+newV.unit;

    // Reconstruir chart
    if(w.chart && typeof w.chart.destroy === 'function') {
      try { w.chart.destroy(); } catch(e) { console.warn("Error destroying chart:", e); }
    }
    
    if(!['text','stat'].includes(newCfg.type)) {
      const canvas = w.panelEl.querySelector('canvas');
      if(canvas) {
        w.chart = await _buildChart(canvas, newCfg.type, newCfg);
        DM.widgets[wid].chart = w.chart;
      }
    } else {
      w.chart = null;
      DM.widgets[wid].chart = null;
      // Re-renderizar el cuerpo para widgets de texto/stat para actualizar tag y unit
      const body = w.panelEl.querySelector('.dm-panel-body');
      if(body) {
        body.innerHTML = '';
        if(newCfg.type === 'stat') {
          body.innerHTML = `<div style="text-align:center;padding:10px 0">
            <div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px">${newV.tag}</div>
            <div id="dm_val_${wid}" style="font-size:62px;font-weight:700;line-height:1;margin:10px 0;letter-spacing:-2px;color:var(--text-primary)">0.0</div>
            <div style="font-size:14px;color:var(--text-dim);margin-bottom:2px">${newV.unit}</div>
          </div>`;
        } else {
          body.innerHTML = `<div style="display:flex;align-items:center,gap:15px;padding:5px">
             <div id="dm_val_${wid}" style="font-size:38px;font-weight:700;color:var(--text-primary)">0.0</div>
             <div style="font-size:12px;color:var(--text-dim)">${newV.unit}<br>${newV.tag}</div>
          </div>`;
        }
      }
    }
    DM.widgets[wid].config = newCfg;
    _save();
    modal.style.display = 'none';
    if(typeof showNotif==='function') showNotif('Widget actualizado','success');
  });

  modal.style.display = 'flex';
  if(typeof feather!=='undefined') feather.replace();
}

// ═══ API PÚBLICA ══════════════════════════════════════════════════
window.toggleWidgetCatalog = function() {
  const cat = document.getElementById('widgetCatalog');
  if(!cat) return;
  cat.style.display = cat.style.display==='none' ? 'block' : 'none';
};

window.addWidgetToDash = function(type) {
  const empty = document.getElementById('emptyDashboardState');
  if(empty) empty.style.display = 'none';
  _createWidget(type);
};

window.dmClearDashboard = function() {
  if(!confirm('¿Limpiar todo el dashboard?')) return;
  Object.values(DM.widgets).forEach(w=>{ if(w.chart) w.chart.destroy(); });
  DM.widgets = {};
  const grid = document.getElementById('activeWidgetsGrid');
  if(grid) grid.innerHTML = '';
  const empty = document.getElementById('emptyDashboardState');
  if(empty) empty.style.display = 'flex';
  localStorage.removeItem(DM.STORAGE_KEY);
};

window.dmToggleLive = function() {
  DM.liveEnabled = !DM.liveEnabled;
  if(typeof showNotif==='function')
    showNotif(DM.liveEnabled?'Datos en vivo activados':'Datos en vivo pausados','info');
};

// ═══ INIT ════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', ()=>{
  _ensureModal();
  _load();
  _startLive();
});

// ─── Integración con scadaBus: resaltar widget al recibir tag:focus ───
if (window.scadaBus) {
  window.scadaBus.on('tag:focus', ({ varId }) => {
    const grid = document.getElementById('activeWidgetsGrid');
    if (!grid) return;
    const panels = grid.querySelectorAll(`[data-var-id="${varId}"], .panel[data-wid]`);
    let highlighted = 0;
    panels.forEach(p => {
      const pid = p.dataset.varId;
      if (pid && pid === varId) {
        p.style.outline = '2px solid #22c55e';
        p.style.boxShadow = '0 0 0 4px rgba(34,197,94,0.18)';
        if (highlighted === 0) p.scrollIntoView({ behavior: 'smooth', block: 'center' });
        highlighted++;
        setTimeout(() => {
          p.style.outline = '';
          p.style.boxShadow = '';
        }, 2200);
      }
    });
  });
}
