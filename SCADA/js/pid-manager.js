/**
 * pid-manager.js — P&ID con carga de archivos SVG
 * NexSCADA v5 — Módulo independiente
 *
 * - Si hay archivos .svg en /pid/, los carga en el contenedor pidContainer
 * - SVG se incrusta directamente para permitir interactividad
 * - Fallback: dibuja el P&ID procedimental en canvas (drawPID de scada-core.js)
 * - Botón "Cargar P&ID..." abre modal de selección
 */

window._pidCurrentFile = null;

// ─── LISTAR SVGs ──────────────────────────────────────────────────
window.listPIDSVGs = async function() {
  try {
    const res = await fetch('/api/files/list?path=/pid');
    if (!res.ok) return [];
    const files = await res.json();
    return files.filter(f => f.name && f.name.toLowerCase().endsWith('.svg'));
  } catch { return []; }
};

// ─── CARGAR SVG ───────────────────────────────────────────────────
window.loadPIDSVG = async function(filename) {
  const container = document.getElementById('pidContainer');
  if (!container) return;

  container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary)">
    <div class="spinner-border spinner-border-sm text-primary me-2"></div>
    Cargando P&ID: ${filename}...
  </div>`;

  try {
    const res = await fetch(`/api/files/raw?path=/pid&name=${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const svgText = await res.text();

    // Insertar SVG directamente para interactividad
    container.innerHTML = svgText;
    const svgEl = container.querySelector('svg');
    if (svgEl) {
      svgEl.style.width  = '100%';
      svgEl.style.height = '100%';
      svgEl.style.maxHeight = 'calc(100vh - 200px)';
      svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      _normalizeSVGColors(svgEl);
      _addSVGPanZoom(svgEl);
      _wireSVGHotspots(svgEl);
    }

    window._pidCurrentFile = filename;
    const label = document.getElementById('pidLabel');
    if (label) label.textContent = filename;
    window.showNotif(`P&ID "${filename}" cargado`, 'success');

  } catch (err) {
    // Fallback al canvas procedimental
    container.innerHTML = `<canvas id="pidCanvas" style="width:100%;height:100%"></canvas>`;
    if (typeof drawPID === 'function') {
      const canvas = document.getElementById('pidCanvas');
      if (canvas) {
        canvas.width  = canvas.offsetWidth  || 900;
        canvas.height = canvas.offsetHeight || 450;
        drawPID();
      }
    }
    window.showNotif(`No se pudo cargar SVG. Mostrando P&ID procedimental. (${err.message})`, 'warning');
  }
};

// ─── NORMALIZAR COLORES DEL SVG (negros → blanco para fondo oscuro) ──
function _normalizeSVGColors(svg) {
  if (!svg) return;
  const BLACKS = new Set(['#000','#000000','black','rgb(0,0,0)','rgb(0, 0, 0)']);
  const isBlack = (v) => v && BLACKS.has(String(v).trim().toLowerCase());

  // Atributos directos stroke/fill
  svg.querySelectorAll('[stroke],[fill]').forEach(el => {
    const s = el.getAttribute('stroke');
    if (isBlack(s)) el.setAttribute('stroke', '#ffffff');
    const f = el.getAttribute('fill');
    if (isBlack(f)) el.setAttribute('fill', '#ffffff');
  });

  // Estilos inline style="stroke:#000;fill:#000"
  svg.querySelectorAll('[style]').forEach(el => {
    let st = el.getAttribute('style');
    if (!st) return;
    st = st.replace(/(stroke|fill)\s*:\s*(#000(?:000)?|black|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))/gi, '$1:#ffffff');
    el.setAttribute('style', st);
  });

  // Elementos sin stroke/fill explícito heredan negro por defecto en muchos exports.
  // Forzamos color por defecto del SVG raíz a blanco.
  const rootStroke = svg.getAttribute('stroke');
  if (!rootStroke || isBlack(rootStroke)) svg.setAttribute('stroke', '#ffffff');
  // Mantener fill="none" como por defecto para no rellenar áreas (estilo plano P&ID)
  if (!svg.getAttribute('fill')) svg.setAttribute('fill', 'none');

  // Bloques <style> internos: reemplazar negros también
  svg.querySelectorAll('style').forEach(tag => {
    tag.textContent = tag.textContent.replace(
      /(stroke|fill)\s*:\s*(#000(?:000)?|black|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))/gi,
      '$1:#ffffff'
    );
  });
}
window._normalizeSVGColors = _normalizeSVGColors;



// ─── PAN/ZOOM/ROTACIÓN PARA SVG ──────────────────────────────────
function _addSVGPanZoom(svg) {
  const state = { scale: 1, panX: 0, panY: 0, rotation: 0 };
  let isDragging = false, lastX = 0, lastY = 0;

  svg.style.cursor = 'grab';
  svg.style.transition = 'transform 0.08s ease';
  svg.style.transformOrigin = 'center center';

  function apply() {
    svg.style.transform =
      `translate(${state.panX}px, ${state.panY}px) rotate(${state.rotation}deg) scale(${state.scale})`;
  }

  svg.addEventListener('wheel', e => {
    if (window._pidDrawMode) return;
    e.preventDefault();
    state.scale = Math.max(0.2, Math.min(8, state.scale * (e.deltaY > 0 ? 0.9 : 1.1)));
    apply();
  }, { passive: false });

  svg.addEventListener('mousedown', e => {
    if (window._pidDrawMode) return;
    isDragging = true; lastX = e.clientX; lastY = e.clientY;
    svg.style.cursor = 'grabbing';
  });
  window.addEventListener('mouseup', () => { isDragging = false; svg.style.cursor = 'grab'; });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    state.panX += e.clientX - lastX; state.panY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    apply();
  });

  // Exponer estado para que la toolbar pueda manipularlo
  window._pidView = {
    state,
    apply,
    reset() { state.scale = 1; state.panX = 0; state.panY = 0; state.rotation = 0; apply(); },
    zoom(factor) { state.scale = Math.max(0.2, Math.min(8, state.scale * factor)); apply(); },
    rotate(deg)  { state.rotation = (state.rotation + deg) % 360; apply(); },
    setRotation(deg) { state.rotation = deg % 360; apply(); },
  };

  const resetBtn = document.getElementById('pidResetZoom');
  if (resetBtn) resetBtn.onclick = () => window._pidView.reset();
}

// ─── CAPA DE ANOTACIÓN (dibujo libre sobre el P&ID) ──────────────
function _ensureAnnotationLayer() {
  const container = document.getElementById('pidContainer');
  if (!container) return null;
  let layer = container.querySelector('#pidAnnotationLayer');
  if (layer) return layer;
  layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  layer.id = 'pidAnnotationLayer';
  layer.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  Object.assign(layer.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '5'
  });
  container.appendChild(layer);

  let drawing = false, currentPath = null, points = [];
  const getXY = (e) => {
    const r = layer.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  layer.addEventListener('pointerdown', e => {
    if (!window._pidDrawMode) return;
    e.preventDefault();
    drawing = true;
    points = [getXY(e)];
    currentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    currentPath.setAttribute('fill', 'none');
    currentPath.setAttribute('stroke', window._pidDrawColor || '#22d3ee');
    currentPath.setAttribute('stroke-width', String(window._pidDrawWidth || 2.5));
    currentPath.setAttribute('stroke-linecap', 'round');
    currentPath.setAttribute('stroke-linejoin', 'round');
    currentPath.setAttribute('data-annotation', '1');
    currentPath.setAttribute('d', `M ${points[0].x} ${points[0].y}`);
    layer.appendChild(currentPath);
    layer.setPointerCapture(e.pointerId);
  });
  layer.addEventListener('pointermove', e => {
    if (!drawing || !currentPath) return;
    const p = getXY(e);
    points.push(p);
    currentPath.setAttribute('d', currentPath.getAttribute('d') + ` L ${p.x} ${p.y}`);
  });
  const endStroke = () => { drawing = false; currentPath = null; };
  layer.addEventListener('pointerup', endStroke);
  layer.addEventListener('pointercancel', endStroke);
  layer.addEventListener('pointerleave', endStroke);

  return layer;
}

// ─── TOOLBAR DE HERRAMIENTAS ─────────────────────────────────────
function _setupPIDTools() {
  const toolbar = document.getElementById('pidToolbar');
  if (!toolbar || document.getElementById('pidToolsGroup')) return;

  window._pidDrawMode  = false;
  window._pidDrawColor = '#22d3ee';
  window._pidDrawWidth = 2.5;

  const group = document.createElement('div');
  group.id = 'pidToolsGroup';
  group.style.cssText = 'display:flex;align-items:center;gap:4px;margin-right:8px;padding:2px 6px;border:1px solid var(--border-default);border-radius:6px;background:rgba(255,255,255,0.02)';

  const mkBtn = (title, html, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-sm';
    b.title = title;
    b.innerHTML = html;
    b.style.cssText = 'border:none;background:transparent;color:var(--text-secondary);font-size:13px;padding:4px 8px;line-height:1;cursor:pointer;border-radius:4px';
    b.onmouseenter = () => b.style.background = 'rgba(255,255,255,0.06)';
    b.onmouseleave = () => { if (!b.dataset.active) b.style.background = 'transparent'; };
    b.onclick = onClick;
    return b;
  };

  const needView = () => {
    if (!window._pidView) {
      window.showNotif?.('Carga primero un archivo P&ID', 'warning');
      return false;
    }
    return true;
  };

  // Zoom
  group.appendChild(mkBtn('Acercar (zoom +)', '🔍+', () => needView() && window._pidView.zoom(1.2)));
  group.appendChild(mkBtn('Alejar (zoom -)', '🔍−', () => needView() && window._pidView.zoom(1/1.2)));
  group.appendChild(mkBtn('Ajustar (reset zoom y rotación)', '⛶', () => needView() && window._pidView.reset()));

  // Rotación
  group.appendChild(mkBtn('Rotar 90° antihorario', '⟲', () => needView() && window._pidView.rotate(-90)));
  group.appendChild(mkBtn('Rotar 90° horario',     '⟳', () => needView() && window._pidView.rotate(90)));
  group.appendChild(mkBtn('Orientación horizontal', '▭', () => needView() && window._pidView.setRotation(0)));
  group.appendChild(mkBtn('Orientación vertical',   '▯', () => needView() && window._pidView.setRotation(90)));

  // Separador
  const sep = document.createElement('span');
  sep.style.cssText = 'width:1px;height:18px;background:var(--border-default);margin:0 4px';
  group.appendChild(sep);

  // Dibujo / Rayado
  const drawBtn = mkBtn('Modo dibujo (rayar sobre el plano)', '✏️', () => {
    window._pidDrawMode = !window._pidDrawMode;
    const layer = _ensureAnnotationLayer();
    if (layer) layer.style.pointerEvents = window._pidDrawMode ? 'auto' : 'none';
    if (window._pidDrawMode) {
      drawBtn.dataset.active = '1';
      drawBtn.style.background = 'rgba(34,211,238,0.18)';
      drawBtn.style.color = 'var(--accent-cyan,#22d3ee)';
    } else {
      delete drawBtn.dataset.active;
      drawBtn.style.background = 'transparent';
      drawBtn.style.color = 'var(--text-secondary)';
    }
  });
  group.appendChild(drawBtn);

  // Selector de color
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = window._pidDrawColor;
  colorInput.title = 'Color del trazo';
  colorInput.style.cssText = 'width:24px;height:24px;border:1px solid var(--border-default);border-radius:4px;background:transparent;cursor:pointer;padding:0';
  colorInput.oninput = e => { window._pidDrawColor = e.target.value; };
  group.appendChild(colorInput);

  // Grosor del trazo
  const widthInput = document.createElement('input');
  widthInput.type = 'range'; widthInput.min = '1'; widthInput.max = '12'; widthInput.step = '0.5';
  widthInput.value = String(window._pidDrawWidth);
  widthInput.title = 'Grosor del trazo';
  widthInput.style.cssText = 'width:64px;cursor:pointer';
  widthInput.oninput = e => { window._pidDrawWidth = parseFloat(e.target.value); };
  group.appendChild(widthInput);

  // Deshacer último trazo
  group.appendChild(mkBtn('Deshacer último trazo', '↶', () => {
    const layer = document.getElementById('pidAnnotationLayer');
    if (!layer) return;
    const last = layer.querySelector('path[data-annotation]:last-of-type');
    if (last) last.remove();
  }));

  // Borrar todo
  group.appendChild(mkBtn('Borrar todas las anotaciones', '🗑', () => {
    const layer = document.getElementById('pidAnnotationLayer');
    if (layer) layer.innerHTML = '';
  }));

  // Descargar SVG con anotaciones
  group.appendChild(mkBtn('Descargar SVG con anotaciones', '⬇', () => {
    const container = document.getElementById('pidContainer');
    const baseSvg = container?.querySelector('svg:not(#pidAnnotationLayer)');
    if (!baseSvg) { window.showNotif?.('No hay P&ID cargado', 'warning'); return; }
    const clone = baseSvg.cloneNode(true);
    clone.style.transform = '';
    const layer = document.getElementById('pidAnnotationLayer');
    if (layer && layer.children.length) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('data-annotations', '1');
      Array.from(layer.children).forEach(c => g.appendChild(c.cloneNode(true)));
      clone.appendChild(g);
    }
    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (window._pidCurrentFile || 'pid') + '-anotado.svg';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }));

  // Pantalla completa — incluye toolbar (fullscreen sobre el panel completo)
  group.appendChild(mkBtn('Pantalla completa', '⛶⛶', () => {
    const container = document.getElementById('pidContainer');
    const panel = container?.closest('.panel') || container;
    if (!panel) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else panel.requestFullscreen?.();
  }));

  toolbar.insertBefore(group, document.getElementById('pidResetZoom') || toolbar.lastElementChild);
}
window._setupPIDTools = _setupPIDTools;


// ─── MODAL DE SELECCIÓN ──────────────────────────────────────────
window.openPIDModal = async function() {
  const svgs = await window.listPIDSVGs();

  let modalEl = document.getElementById('pidModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'pidModal';
    modalEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1050;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    document.body.appendChild(modalEl);
  }

  if (svgs.length === 0) {
    modalEl.innerHTML = `
    <div style="background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:16px;padding:28px;width:440px;max-width:95vw">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h5 style="margin:0;font-size:16px;color:var(--text-heading)">Cargar P&ID (.svg)</h5>
        <button onclick="document.getElementById('pidModal').remove()" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:18px">×</button>
      </div>
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">No hay archivos .svg en la carpeta <code>pid/</code> del servidor.</p>
      <p style="color:var(--text-disabled);font-size:12px">Sube archivos SVG de planos P&ID a través del File Manager en la carpeta <code>pid/</code>.</p>
      <div style="margin-top:20px;text-align:right"><button class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('pidModal').remove()">Cerrar</button></div>
    </div>`;
    modalEl.style.display = 'flex';
    return;
  }

  modalEl.innerHTML = `
  <div style="background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:16px;padding:28px;width:480px;max-width:95vw">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h5 style="margin:0;font-size:16px;color:var(--text-heading)">Seleccionar P&ID</h5>
      <button onclick="document.getElementById('pidModal').remove()" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:18px">×</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto">
      ${svgs.map(f => `
      <div onclick="window.loadPIDSVG('${f.name}');document.getElementById('pidModal').remove()"
        style="padding:12px 16px;border:1px solid var(--border-subtle);border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:all 0.15s"
        onmouseenter="this.style.borderColor='var(--accent-cyan)';this.style.background='rgba(0,212,255,0.05)'"
        onmouseleave="this.style.borderColor='var(--border-subtle)';this.style.background=''">
        <span style="font-size:20px">📐</span>
        <div>
          <div style="font-size:13px;font-weight:500;color:var(--text-primary)">${f.name}</div>
          <div style="font-size:11px;color:var(--text-disabled)">${f.size ? (f.size/1024).toFixed(1) + ' KB SVG' : 'Diagrama P&ID'}</div>
        </div>
        ${f.name === window._pidCurrentFile ? '<span style="margin-left:auto;font-size:11px;color:var(--accent-green)">✓ actual</span>' : ''}
      </div>`).join('')}
    </div>
    <div style="margin-top:16px;text-align:right"><button class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('pidModal').remove()">Cancelar</button></div>
  </div>`;
  modalEl.style.display = 'flex';
};

// ─── CARGA LOCAL DE ARCHIVO (cliente, sin backend) ──────────────
window.loadPIDFromLocalFile = function(file) {
  if (!file) return;
  const container = document.getElementById('pidContainer');
  if (!container) return;

  const name = file.name || 'archivo';
  const ext  = name.split('.').pop().toLowerCase();
  const label = document.getElementById('pidLabel');

  if (ext === 'svg') {
    const reader = new FileReader();
    reader.onload = e => {
      container.innerHTML = e.target.result;
      const svgEl = container.querySelector('svg');
      if (svgEl) {
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        svgEl.style.maxHeight = 'calc(100vh - 200px)';
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        _normalizeSVGColors(svgEl);
        _addSVGPanZoom(svgEl);
        _wireSVGHotspots(svgEl);
      } else {
        container.innerHTML = `<div style="padding:24px;color:var(--danger,#dc3545)">El archivo no contiene un &lt;svg&gt; válido.</div>`;
      }
      window._pidCurrentFile = name;
      if (label) label.textContent = name;
      if (typeof window.showNotif === 'function') window.showNotif(`P&ID "${name}" cargado`, 'success');
    };
    reader.onerror = () => window.showNotif?.('Error leyendo el archivo', 'danger');
    reader.readAsText(file);

  } else if (ext === 'dwg' || ext === 'dxf') {
    // Los navegadores no pueden renderizar DWG/DXF de forma nativa.
    const sizeKB = (file.size / 1024).toFixed(1);
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:340px;padding:32px;text-align:center;color:var(--text-secondary)">
        <div style="font-size:48px;margin-bottom:12px">📐</div>
        <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:6px">${name}</div>
        <div style="font-size:12px;margin-bottom:16px">Archivo ${ext.toUpperCase()} · ${sizeKB} KB</div>
        <div style="font-size:13px;max-width:480px;line-height:1.5">
          Los archivos <b>${ext.toUpperCase()}</b> no se pueden previsualizar directamente en el navegador.
          Conviértelo a <b>SVG</b> (desde AutoCAD: <i>Exportar → SVG</i>, o usa un convertidor online)
          y vuelve a cargarlo aquí.
        </div>
      </div>`;
    window._pidCurrentFile = name;
    if (label) label.textContent = name + ' (DWG)';
    if (typeof window.showNotif === 'function') {
      window.showNotif(`DWG cargado: previsualización no disponible. Convierte a SVG.`, 'warning');
    }

  } else {
    if (typeof window.showNotif === 'function') {
      window.showNotif(`Formato .${ext} no soportado. Usa .svg o .dwg`, 'danger');
    }
  }
};

// ─── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const tab = document.getElementById('tab-process');
  if (!tab) return;

  const toolbar = document.getElementById('pidToolbar');
  if (toolbar) {
    // Input file oculto (acepta SVG y DWG/DXF)
    const fileInput = document.getElementById('pidLocalFileInput') || document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.svg,.dwg,.dxf,image/svg+xml';
    fileInput.style.display = 'none';
    fileInput.id = 'pidLocalFileInput';
    fileInput.addEventListener('change', e => {
      const f = e.target.files?.[0];
      if (f) window.loadPIDFromLocalFile(f);
      e.target.value = '';
    });
    if (!fileInput.parentElement) document.body.appendChild(fileInput);

    // Botón "Subir P&ID" (carga local desde el equipo del usuario)
    const uploadBtn = document.getElementById('pidLocalUploadBtn') || document.createElement('button');
    uploadBtn.className = 'btn btn-sm';
    uploadBtn.style.cssText = 'border:1px solid var(--accent-cyan,#00d4ff);color:var(--accent-cyan,#00d4ff);background:transparent;font-size:12px;display:flex;align-items:center;gap:6px;margin-right:6px';
    uploadBtn.innerHTML = '📤 Subir P&ID (.svg / .dwg)';
    uploadBtn.onclick = () => fileInput.click();
    if (!uploadBtn.parentElement) toolbar.prepend(uploadBtn);

    // Botón "OPERACIONES UNITARIAS" — gestiona archivos .svg de unidades
    if (!document.getElementById('pidOpUnitBtn')) {
      const opBtn = document.createElement('button');
      opBtn.id = 'pidOpUnitBtn';
      opBtn.className = 'btn btn-sm';
      opBtn.style.cssText = 'border:1px solid var(--border);color:var(--text-secondary);background:transparent;font-size:12px;display:flex;align-items:center;gap:6px;margin-right:6px';
      opBtn.innerHTML = 'OPERACIONES UNITARIAS';
      opBtn.title = 'Insertar / cargar SVG de operaciones unitarias';
      opBtn.onclick = () => window.openOpUnitModal && window.openOpUnitModal();
      toolbar.prepend(opBtn);
    }

    // Drag & drop sobre el contenedor del P&ID
    const container = document.getElementById('pidContainer');
    if (container) {
      container.addEventListener('dragover', e => {
        e.preventDefault();
        container.style.outline = '2px dashed var(--accent-cyan,#00d4ff)';
      });
      container.addEventListener('dragleave', () => { container.style.outline = ''; });
      container.addEventListener('drop', e => {
        e.preventDefault();
        container.style.outline = '';
        const f = e.dataTransfer?.files?.[0];
        if (f) window.loadPIDFromLocalFile(f);
      });
    }
  }

  // Herramientas del visualizador (zoom, rotar, dibujar, descargar, etc.)
  _setupPIDTools();

  // Visualizador inicia vacío — el usuario sube su propio archivo manualmente.
});

// ─── HOTSPOTS: vincular elementos SVG con variables ───────────────
function _wireSVGHotspots(svg) {
  if (!svg || !window.scadaBus) return;
  const vars = (window.variableManager && window.variableManager.variables) || [];
  if (!vars.length) return;

  // Indexar variables por id y por tag normalizado
  const byKey = new Map();
  vars.forEach(v => {
    if (v.id)  byKey.set(v.id.toLowerCase(), v);
    if (v.tag) byKey.set(v.tag.toLowerCase().replace(/\s+/g, '_'), v);
    if (v.tag) byKey.set(v.tag.toLowerCase(), v);
  });

  const matched = [];
  const all = svg.querySelectorAll('*');
  all.forEach(el => {
    const candidates = [
      el.getAttribute('data-tag'),
      el.getAttribute('data-var'),
      el.id,
      el.getAttribute('inkscape:label'),
    ].filter(Boolean);
    for (const c of candidates) {
      const norm = String(c).toLowerCase().replace(/\s+/g, '_');
      const v = byKey.get(norm) || byKey.get(String(c).toLowerCase());
      if (v) {
        el.setAttribute('data-scada-var', v.id);
        el.style.cursor = 'pointer';
        el.addEventListener('mouseenter', () => {
          el.dataset._prevStroke = el.style.stroke;
          el.dataset._prevSW = el.style.strokeWidth;
          el.style.stroke = '#22c55e';
          el.style.strokeWidth = '3';
        });
        el.addEventListener('mouseleave', () => {
          el.style.stroke = el.dataset._prevStroke || '';
          el.style.strokeWidth = el.dataset._prevSW || '';
        });
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          window.scadaBus.emit('tag:select', { varId: v.id, tag: v.tag, source: 'pid' });
        });
        matched.push(v.id);
        break;
      }
    }
  });

  if (matched.length && typeof window.showNotif === 'function') {
    window.showNotif(`P&ID: ${matched.length} tag(s) interactivo(s) detectado(s)`, 'info');
  }
}
window._wireSVGHotspots = _wireSVGHotspots;

// Resaltado por bus
if (window.scadaBus) {
  window.scadaBus.on('tag:focus', ({ varId }) => {
    const container = document.getElementById('pidContainer');
    if (!container) return;
    const el = container.querySelector(`[data-scada-var="${varId}"]`);
    if (!el) return;
    const prev = el.style.filter;
    el.style.transition = 'filter .3s';
    el.style.filter = 'drop-shadow(0 0 6px #22c55e) drop-shadow(0 0 12px #22c55e)';
    setTimeout(() => { el.style.filter = prev || ''; }, 1800);
  });
}

// ─── OPERACIONES UNITARIAS (archivos .svg) ──────────────────────
window.listOpUnitSVGs = async function() {
  // Intenta listar primero /operaciones_unitarias y como fallback /pid
  const paths = ['/operaciones_unitarias', '/op_units', '/pid'];
  for (const p of paths) {
    try {
      const res = await fetch('/api/files/list?path=' + encodeURIComponent(p));
      if (!res.ok) continue;
      const files = await res.json();
      const svgs = (files || []).filter(f => f.name && f.name.toLowerCase().endsWith('.svg'));
      if (svgs.length) return { path: p, files: svgs };
    } catch {}
  }
  return { path: '/operaciones_unitarias', files: [] };
};

window.loadOpUnitSVG = async function(path, filename) {
  try {
    const res = await fetch(`/api/files/raw?path=${encodeURIComponent(path)}&name=${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const svgText = await res.text();
    const container = document.getElementById('pidContainer');
    if (!container) return;
    // Si el P&ID ya tiene un SVG cargado, inserta la operación unitaria dentro;
    // si no, reemplaza el contenido por el SVG de la operación.
    const baseSvg = container.querySelector('svg:not(#pidAnnotationLayer)');
    if (baseSvg) {
      const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      wrap.setAttribute('data-op-unit', filename);
      const tmp = document.createElement('div');
      tmp.innerHTML = svgText.trim();
      const newSvg = tmp.querySelector('svg');
      if (newSvg) {
        // Mueve los hijos del SVG insertado al grupo
        Array.from(newSvg.childNodes).forEach(n => wrap.appendChild(n));
        const vb = (baseSvg.viewBox?.baseVal) || { width: 800, height: 600 };
        wrap.setAttribute('transform', `translate(${vb.width*0.4},${vb.height*0.4}) scale(0.6)`);
        baseSvg.appendChild(wrap);
        window._normalizeSVGColors && window._normalizeSVGColors(baseSvg);
        window.showNotif?.(`Operación unitaria "${filename}" añadida`, 'success');
      } else {
        throw new Error('SVG inválido');
      }
    } else {
      container.innerHTML = svgText;
      const svgEl = container.querySelector('svg');
      if (svgEl) {
        svgEl.style.width  = '100%';
        svgEl.style.height = '100%';
        svgEl.style.maxHeight = 'calc(100vh - 200px)';
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        window._normalizeSVGColors && window._normalizeSVGColors(svgEl);
        window._addSVGPanZoom && window._addSVGPanZoom(svgEl);
      }
      window._pidCurrentFile = filename;
      const label = document.getElementById('pidLabel');
      if (label) label.textContent = filename;
      window.showNotif?.(`Operación unitaria "${filename}" cargada`, 'success');
    }
  } catch (err) {
    window.showNotif?.('Error: ' + (err.message || err), 'danger');
  }
};

window.uploadOpUnitFile = async function(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.svg')) {
    window.showNotif?.('Solo se permiten archivos .svg', 'warning');
    return;
  }
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await fetch('/api/files/upload?path=/operaciones_unitarias', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
    window.showNotif?.(`"${file.name}" guardado`, 'success');
    window.openOpUnitModal();
  } catch (err) {
    window.showNotif?.('Error al subir: ' + (err.message || err), 'danger');
  }
};

window.deleteOpUnitSVG = async function(path, filename) {
  if (!confirm(`¿Eliminar "${filename}"?`)) return;
  try {
    const res = await fetch(`/api/files/delete?path=${encodeURIComponent(path)}&name=${encodeURIComponent(filename)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    window.showNotif?.(`"${filename}" eliminado`, 'success');
    window.openOpUnitModal();
  } catch (err) {
    window.showNotif?.('Error: ' + (err.message || err), 'danger');
  }
};

window.openOpUnitModal = async function() {
  const { path, files } = await window.listOpUnitSVGs();

  let modalEl = document.getElementById('opUnitModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'opUnitModal';
    modalEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1050;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    document.body.appendChild(modalEl);
  }

  const uploadBar = `
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button id="opUnitUploadBtn" class="btn btn-sm" style="flex:1;background:var(--primary,#3b82f6);color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer">📤 Subir archivo .svg</button>
      <input type="file" id="opUnitUploadInput" accept=".svg,image/svg+xml" style="display:none" />
    </div>`;

  const listHTML = files.length === 0
    ? `<p style="color:var(--text-secondary);font-size:13px;margin:8px 0;text-align:center">No hay archivos .svg en <code>${path}</code>. Sube uno para empezar.</p>`
    : `<div style="display:flex;flex-direction:column;gap:8px;max-height:340px;overflow-y:auto">${files.map(f => `
        <div style="padding:10px 12px;border:1px solid var(--border-subtle);border-radius:8px;display:flex;align-items:center;gap:12px">
          <div style="flex:1;display:flex;align-items:center;gap:10px;cursor:pointer"
               onclick="window.loadOpUnitSVG('${path}','${f.name.replace(/'/g,"\\'")}');document.getElementById('opUnitModal').remove()">
            <span style="font-size:20px">⚙️</span>
            <div>
              <div style="font-size:13px;font-weight:500;color:var(--text-primary)">${f.name}</div>
              <div style="font-size:11px;color:var(--text-disabled)">${f.size ? (f.size/1024).toFixed(1) + ' KB SVG' : 'Operación unitaria'}</div>
            </div>
          </div>
          <button title="Eliminar" onclick="event.stopPropagation();window.deleteOpUnitSVG('${path}','${f.name.replace(/'/g,"\\'")}')"
            style="background:transparent;border:1px solid rgba(239,68,68,0.3);color:#f87171;border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer">🗑</button>
        </div>`).join('')}</div>`;

  modalEl.innerHTML = `
  <div style="background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:16px;padding:24px;width:520px;max-width:95vw">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h5 style="margin:0;font-size:16px;color:var(--text-heading)">Operaciones Unitarias (.svg)</h5>
      <button onclick="document.getElementById('opUnitModal').remove()" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:18px">×</button>
    </div>
    ${uploadBar}
    ${listHTML}
    <div style="margin-top:16px;text-align:right"><button class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('opUnitModal').remove()">Cerrar</button></div>
  </div>`;
  modalEl.style.display = 'flex';

  const inp = document.getElementById('opUnitUploadInput');
  const btn = document.getElementById('opUnitUploadBtn');
  if (btn && inp) {
    btn.onclick = () => inp.click();
    inp.onchange = e => { const f = e.target.files?.[0]; if (f) window.uploadOpUnitFile(f); e.target.value=''; };
  }
};
