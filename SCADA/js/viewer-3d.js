/**
 * viewer-3d.js — Vista 3D con carga de archivos GLB
 * NexSCADA v5 — Módulo independiente
 *
 * - Si hay archivos .glb en /models/, los carga con THREE.GLTFLoader
 * - Fallback: escena de geometría procedimental (ya construida en scada-core.js)
 * - Botón "Cargar Modelo..." abre modal de selección
 */

window._3dCurrentModel = null;

// ─── LISTA DE MODELOS DISPONIBLES ────────────────────────────────
window.listGLBModels = async function() {
  try {
    const res = await fetch('/api/files/list?path=/models');
    if (!res.ok) return [];
    const files = await res.json();
    return files.filter(f => f.name && f.name.toLowerCase().endsWith('.glb'));
  } catch { return []; }
};

// ─── CARGAR GLB ──────────────────────────────────────────────────
window.loadGLBModel = function(filename) {
  // Persistir selección
  try { localStorage.setItem('scada_last_glb', filename); } catch {}

  if (typeof window.threeScene === 'undefined' || !window.threeScene) {
    window.showNotif('Inicializa primero la vista 3D', 'warning');
    return;
  }

  // Verificar que THREE y GLTFLoader estén disponibles
  if (typeof THREE === 'undefined') { window.showNotif('Three.js no cargado', 'danger'); return; }

  // Eliminar modelo anterior
  if (window._3dCurrentModel) {
    window.threeScene.remove(window._3dCurrentModel);
    window._3dCurrentModel = null;
  }

  // Ocultar capa base procedimental para evitar sobreposición
  if (window.threeProceduralGroup) {
    window.threeProceduralGroup.visible = false;
  }

  // Verificar si GLTFLoader existe
  if (!THREE.GLTFLoader) {
    // Cargar dinámicamente
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/loaders/GLTFLoader.js';
    script.onload = () => _doLoadGLB(filename);
    script.onerror = () => window.showNotif('No se pudo cargar GLTFLoader', 'danger');
    document.head.appendChild(script);
    return;
  }
  _doLoadGLB(filename);
};

function _doLoadGLB(filename) {
  const url = `/api/files/raw?path=/models&name=${encodeURIComponent(filename)}`;
  window.showNotif(`Cargando modelo: ${filename}...`, 'info');

  const selectedLabel = document.getElementById('selectedLabel');
  if (selectedLabel) selectedLabel.textContent = `Cargando ${filename}...`;

  const loader = new THREE.GLTFLoader();
  loader.load(url,
    gltf => {
      const model = gltf.scene;
      // Centrar el modelo
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 12 / maxDim;
      model.scale.set(scale, scale, scale);
      model.position.sub(center.multiplyScalar(scale));

      window.threeScene.add(model);
      window._3dCurrentModel = model;
      // Mostrar nombre en overlay solo si hay click en equipo
      if (selectedLabel) selectedLabel.style.display = 'none';
      // Actualizar título del panel
      const titleEl = document.getElementById('3dModelTitle');
      if (titleEl) titleEl.textContent = filename.replace('.glb','').replace(/_/g,' ');
      window.showNotif(`Modelo "${filename}" cargado correctamente`, 'success');
    },
    xhr => {
      if (xhr.total > 0) {
        const pct = Math.round(xhr.loaded / xhr.total * 100);
        if (selectedLabel) selectedLabel.textContent = `Cargando ${filename}... ${pct}%`;
      }
    },
    err => {
      window.showNotif(`Error al cargar GLB: ${err.message || err}`, 'danger');
      if (selectedLabel) selectedLabel.textContent = '● Vista General (3D)';
    }
  );
}

// ─── SUBIR GLB AL SERVIDOR ───────────────────────────────────────
window.uploadGLBFile = async function(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.glb')) {
    window.showNotif('Solo se permiten archivos .glb', 'warning');
    return;
  }
  const fd = new FormData();
  fd.append('file', file);
  window.showNotif(`Subiendo "${file.name}"...`, 'info');
  try {
    const res = await fetch('/api/files/upload?path=/models', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
    window.showNotif(`"${file.name}" guardado en /models`, 'success');
    window.loadGLBModel(file.name);
    if (document.getElementById('glbModal')) window.openGLBModal();
  } catch (err) {
    window.showNotif('Error al subir: ' + (err.message || err), 'danger');
  }
};

// ─── ELIMINAR GLB DEL SERVIDOR ───────────────────────────────────
window.deleteGLBModel = async function(filename) {
  if (!filename) return;
  if (!confirm(`¿Eliminar "${filename}" del servidor?`)) return;
  try {
    const res = await fetch(`/api/files/delete?path=/models&name=${encodeURIComponent(filename)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    window.showNotif(`"${filename}" eliminado`, 'success');
    // Si era el modelo activo, limpiar escena
    try {
      if (localStorage.getItem('scada_last_glb') === filename) localStorage.removeItem('scada_last_glb');
    } catch {}
    if (window._3dCurrentModel && window.threeScene) {
      const titleEl = document.getElementById('3dModelTitle');
      if (titleEl && titleEl.textContent.includes(filename.replace('.glb','').replace(/_/g,' '))) {
        window.threeScene.remove(window._3dCurrentModel);
        window._3dCurrentModel = null;
        if (window.threeProceduralGroup) window.threeProceduralGroup.visible = true;
        if (titleEl) titleEl.textContent = 'Vista General';
      }
    }
    if (document.getElementById('glbModal')) window.openGLBModal();
  } catch (err) {
    window.showNotif('Error al eliminar: ' + (err.message || err), 'danger');
  }
};

// ─── MODAL DE SELECCIÓN ──────────────────────────────────────────
window.openGLBModal = async function() {
  const models = await window.listGLBModels();

  let modalEl = document.getElementById('glbModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'glbModal';
    modalEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1050;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    document.body.appendChild(modalEl);
  }

  const uploadBar = `
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button id="glbUploadBtn" class="btn btn-sm" style="flex:1;background:var(--primary,#3b82f6);color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
        📤 Subir archivo .glb
      </button>
      <input type="file" id="glbUploadInput" accept=".glb,model/gltf-binary" style="display:none" />
    </div>`;

  const listHTML = models.length === 0
    ? `<p style="color:var(--text-secondary);font-size:13px;margin:8px 0 0;text-align:center">No hay modelos en <code>/models</code>. Sube uno para empezar.</p>`
    : `<div style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto">
      ${models.map(m => `
      <div style="padding:10px 12px;border:1px solid var(--border-subtle);border-radius:8px;display:flex;align-items:center;gap:12px;transition:all 0.15s"
        onmouseenter="this.style.borderColor='var(--primary)';this.style.background='var(--primary-soft)'"
        onmouseleave="this.style.borderColor='var(--border-subtle)';this.style.background=''">
        <div style="flex:1;display:flex;align-items:center;gap:10px;cursor:pointer"
             onclick="window.loadGLBModel('${m.name.replace(/'/g,"\\'")}');document.getElementById('glbModal').remove()">
          <span style="font-size:20px">📦</span>
          <div>
            <div style="font-size:13px;font-weight:500;color:var(--text-primary)">${m.name}</div>
            <div style="font-size:11px;color:var(--text-disabled)">${m.size ? (m.size/1024).toFixed(0) + ' KB' : ''}</div>
          </div>
        </div>
        <button title="Eliminar" onclick="event.stopPropagation();window.deleteGLBModel('${m.name.replace(/'/g,"\\'")}')"
          style="background:transparent;border:1px solid rgba(239,68,68,0.3);color:#f87171;border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer">🗑</button>
      </div>`).join('')}
    </div>`;

  modalEl.innerHTML = `
  <div style="background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:16px;padding:24px;width:500px;max-width:95vw">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h5 style="margin:0;font-size:16px;color:var(--text-heading)">Modelos 3D (.glb)</h5>
      <button onclick="document.getElementById('glbModal').remove()" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:18px">×</button>
    </div>
    ${uploadBar}
    ${listHTML}
    <div style="margin-top:16px;text-align:right"><button class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('glbModal').remove()">Cerrar</button></div>
  </div>`;
  modalEl.style.display = 'flex';

  const inp = document.getElementById('glbUploadInput');
  const btn = document.getElementById('glbUploadBtn');
  if (btn && inp) {
    btn.onclick = () => inp.click();
    inp.onchange = e => { const f = e.target.files?.[0]; if (f) window.uploadGLBFile(f); e.target.value=''; };
  }
};

// ─── BOTÓN EN TAB 3D + AUTO-CARGA ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const toolbar3D = document.getElementById('toolbar3D');
  if (toolbar3D) {
    // Botón "Subir GLB" (sube directo al servidor en /models)
    const upInput = document.createElement('input');
    upInput.type = 'file';
    upInput.accept = '.glb,model/gltf-binary';
    upInput.style.display = 'none';
    upInput.onchange = e => { const f = e.target.files?.[0]; if (f) window.uploadGLBFile(f); e.target.value=''; };
    document.body.appendChild(upInput);

    const upBtn = document.createElement('button');
    upBtn.style.cssText = 'display:flex;align-items:center;gap:6px;background:var(--primary,#3b82f6);border:1px solid var(--primary,#3b82f6);color:#fff;border-radius:7px;padding:5px 11px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;font-family:Inter,sans-serif;margin-right:4px';
    upBtn.innerHTML = '📤 Subir GLB';
    upBtn.onclick = () => upInput.click();
    toolbar3D.prepend(upBtn);

    const btn = document.createElement('button');
    btn.style.cssText = 'display:flex;align-items:center;gap:6px;background:none;border:1px solid var(--border);color:var(--text-secondary);border-radius:7px;padding:5px 11px;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;font-family:Inter,sans-serif;margin-right:4px';
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg> Modelos GLB';
    btn.onmouseover = () => { btn.style.borderColor='var(--primary)'; btn.style.color='var(--primary)'; };
    btn.onmouseout  = () => { btn.style.borderColor='var(--border)';  btn.style.color='var(--text-secondary)'; };
    btn.onclick = window.openGLBModal;
    toolbar3D.prepend(btn);
  }

  // Auto-cargar último modelo cuando el tab 3D se hace visible
  const observer = new MutationObserver(() => {
    const tab = document.getElementById('tab-3d');
    if (!tab || tab.style.display === 'none') return;
    observer.disconnect();
    setTimeout(() => {
      const lastModel = localStorage.getItem('scada_last_glb');
      if (lastModel && window.threeScene) {
        window.loadGLBModel(lastModel);
      }
    }, 700);
  });
  observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
});
