/**
 * file-manager.js — File Manager avanzado con permisos
 * NexSCADA v5 — Módulo independiente
 *
 * Roles:
 *  - admin:    puede subir, crear carpetas, eliminar, descargar
 *  - viewer/operator/supervisor: solo puede descargar archivos
 *
 * Carpeta especial: /Acceso_seguro/ — solo accesible por admin
 */

window.currentPath  = '/';
window._fmInitialized = false;

// ─── ROL ACTUAL ──────────────────────────────────────────────────
function _isAdmin() {
  const users = JSON.parse(localStorage.getItem('scada_users') || '[]');
  const uname = localStorage.getItem('scada_user') || 'admin';
  const user  = users.find(u => u.username === uname);
  if (!user) return uname === 'admin'; // fallback si no hay BD
  return user.role === 'admin';
}

// ─── PATH BREADCRUMB ─────────────────────────────────────────────
function _renderBreadcrumb() {
  const el = document.getElementById('fmBreadcrumb');
  if (!el) return;
  const parts = window.currentPath.split('/').filter(Boolean);
  let html = `<span class="fm-crumb" onclick="window.navigateTo('/')" style="cursor:pointer;color:var(--primary)">Archivos</span>`;
  parts.forEach((p, i) => {
    const path = '/' + parts.slice(0, i + 1).join('/');
    html += ` <span style="color:var(--text-disabled)">›</span> <span class="fm-crumb" onclick="window.navigateTo('${path}')" style="cursor:pointer;${i === parts.length-1 ? 'color:var(--text-primary)' : 'color:var(--primary)'}">${p}</span>`;
  });
  el.innerHTML = html;
}

window.navigateTo = function(path) {
  // Bloquear Acceso_seguro para no-admins
  if (path.includes('Acceso_seguro') && !_isAdmin()) {
    window.showNotif('Acceso denegado — Solo administradores', 'danger');
    return;
  }
  window.currentPath = path;
  window.refreshFiles();
};

// ─── LISTAR ARCHIVOS ─────────────────────────────────────────────
window.refreshFiles = async function () {
  const listEl = document.getElementById('fmList');
  if (!listEl) return;

  _renderBreadcrumb();

  listEl.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-secondary);grid-column:1/-1">
    <div class="spinner-border spinner-border-sm text-primary me-2"></div>Cargando archivos...
  </div>`;

  const isAdmin = _isAdmin();

  try {
    const res = await fetch(`/api/files/list?path=${encodeURIComponent(window.currentPath)}`);
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    let files = await res.json();

    // Filtrar Acceso_seguro para no-admins
    if (!isAdmin) {
      files = files.filter(f => f.name !== 'Acceso_seguro');
    }

    // Ocultar archivos internos del sistema al listar la raíz
    if (window.currentPath === '/') {
      const isSystem = (name) => {
        if(name.startsWith('.')) return true;
        const h = ['node_modules','css','js','backend','assets','imagenes de reconstruccion'];
        return h.includes(name.toLowerCase()) || name.endsWith('.html') || name.endsWith('.js') || name.endsWith('.json') || name.endsWith('.md');
      };
      files = files.filter(f => !isSystem(f.name));
    }

    listEl.innerHTML = '';

    // Botón volver (si no es raíz)
    if (window.currentPath !== '/') {
      const upBtn = _buildCard({ name: '..', type: 'directory', _up: true }, isAdmin);
      listEl.appendChild(upBtn);
    }

    if (files.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:40px;text-align:center;color:var(--text-disabled,#475569);grid-column:1/-1;font-size:13px';
      empty.textContent = window.currentPath === '/' ? 'No hay archivos' : 'Carpeta vacía';
      listEl.appendChild(empty);
    }

    files.forEach((f, idx) => listEl.appendChild(_buildCard(f, isAdmin, idx)));
    
    // Feather Replace seguro
    if (typeof feather !== 'undefined') {
      try {
        feather.replace({ width: '1em', height: '1em' });
      } catch (e) {
        console.warn('Feather icons warning:', e);
      }
    }

  } catch (err) {
    listEl.innerHTML = `<div style="padding:40px;text-align:center;color:var(--accent-red);grid-column:1/-1">
      <div style="font-size:32px;margin-bottom:8px">⚠</div>
      <p style="font-size:13px">No se pudo conectar al servidor de archivos</p>
      <p style="font-size:11px;color:var(--text-disabled)">${err.message}</p>
      <button class="btn btn-sm btn-outline-primary mt-2" onclick="window.refreshFiles()">Reintentar</button>
    </div>`;
  }
};

// ─── CONSTRUIR TARJETA ───────────────────────────────────────────
function _buildCard(f, isAdmin, idx = 0) {
  const isDir = f.type === 'directory' || f._up;
  const isUp  = f._up === true;
  const isSecure = f.name === 'Acceso_seguro';
  const colors = ['var(--primary)', 'var(--magenta)', 'var(--warning)', 'var(--success)', 'var(--purple)', 'var(--info)'];
  const color  = isUp ? 'var(--text-muted)' : colors[idx % colors.length];
  const icon   = isUp ? 'corner-left-up' : (isSecure ? 'shield' : (isDir ? 'folder' : _fileIcon(f.name)));
  const size   = isDir ? '—' : (f.size ? _formatSize(f.size) : '—');

  const card = document.createElement('div');
  card.className = 'fm-card';
  card.style.cssText = `position:relative; background:var(--bg-elevated); border:1px solid var(--border-subtle); border-radius:12px; padding:20px; text-align:center; transition:all 0.2s cubic-bezier(0.4,0,0.2,1); cursor:pointer; min-height:140px; display:flex; flex-direction:column; align-items:center; justify-content:center;`;

  card.onmouseenter = () => { card.style.transform = 'translateY(-4px)'; card.style.borderColor = color; card.style.boxShadow = `0 8px 24px ${color}20`; };
  card.onmouseleave = () => { card.style.transform = 'translateY(0)'; card.style.borderColor = 'var(--border-subtle)'; card.style.boxShadow = 'none'; };

  card.innerHTML = `
    <div class="fm-card-actions" style="position:absolute; top:8px; right:8px; width:100%; display:flex; justify-content:flex-end; padding:0 8px; ${isAdmin && !isUp ? '' : 'visibility:hidden'}">
      ${!isUp && isAdmin ? `
      <div class="d-flex gap-2">
        <button class="btn btn-sm p-1" style="color:var(--text-disabled)" onclick="_downloadItem('${f.name}'); event.stopPropagation()" title="Descargar"><i data-feather="download" style="width:14px;height:14px"></i></button>
        <button class="btn btn-sm p-1" style="color:var(--accent-red)" onclick="window.deleteFile('${f.name}'); event.stopPropagation()" title="Eliminar"><i data-feather="trash-2" style="width:14px;height:14px"></i></button>
      </div>` : `
      <div class="d-flex">
        ${!isUp && !isDir ? `<button class="btn btn-sm p-1" style="color:var(--text-disabled)" onclick="_downloadItem('${f.name}'); event.stopPropagation()" title="Descargar"><i data-feather="download" style="width:14px;height:14px"></i></button>` : ''}
      </div>`}
    </div>
    <div style="width:48px; height:48px; border-radius:12px; background:${color}15; color:${color}; display:flex; align-items:center; justify-content:center; margin-bottom:12px; position:relative;">
      <i data-feather="${icon}" style="width:24px;height:24px"></i>
      ${isSecure ? '<div style="position:absolute; bottom:-4px; right:-4px; background:var(--bg-elevated); border-radius:50%; padding:2px; font-size:10px;">🔒</div>' : ''}
    </div>
    <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:4px; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${f.name}">${isUp ? 'Atrás' : f.name}</div>
    <div style="font-size:11px; color:var(--text-disabled); font-family:var(--font-mono)">${isUp ? '..' : (isDir ? 'Carpeta / Directorio' : size)}</div>`;

  // Click principal
  card.addEventListener('click', e => {
    if (e.target.closest('.fm-card-actions')) return;
    if (isDir || isUp) {
      if (isUp) {
        let parts = window.currentPath.split('/').filter(Boolean);
        parts.pop();
        window.navigateTo('/' + parts.join('/'));
      } else {
        window.navigateTo((window.currentPath === '/' ? '' : window.currentPath) + '/' + f.name);
      }
    } else {
      _downloadItem(f.name);
    }
  });

  return card;
}

function _fileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  const map = { pdf:'file-text', xlsx:'grid', xls:'grid', docx:'file-text', doc:'file-text',
    png:'image', jpg:'image', jpeg:'image', svg:'image', gif:'image',
    mp4:'video', avi:'video', glb:'box', obj:'box', step:'box',
    zip:'archive', rar:'archive', tar:'archive',
    js:'code', ts:'code', py:'code', json:'code', html:'code', css:'code' };
  return map[ext] || 'file';
}

function _formatSize(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1048576)    return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1048576).toFixed(1) + ' MB';
}

// ─── DESCARGA ────────────────────────────────────────────────────
window._downloadItem = function(name) {
  const isDir = true; // llamamos al endpoint y él decide si comprimir
  const url = `/api/files/download?path=${encodeURIComponent(window.currentPath)}&name=${encodeURIComponent(name)}`;
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  window.showNotif(`Descargando: ${name}`, 'info');
};

// ─── CREAR CARPETA ───────────────────────────────────────────────
window.newFolderModal = function() {
  if (!_isAdmin()) { window.showNotif('Solo administradores pueden crear carpetas', 'danger'); return; }
  _showFolderModal();
};

// ─── MODAL: Nueva Carpeta (reemplaza prompt nativo) ───────────────
function _ensureFolderModal() {
  if (document.getElementById('fmFolderModal')) return;
  const el = document.createElement('div');
  el.id = 'fmFolderModal';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);display:none;align-items:center;justify-content:center;z-index:9000;backdrop-filter:blur(4px)';
  el.innerHTML = `
    <div style="background:var(--bg-elevated,#1c2333);border:1px solid var(--border-subtle,rgba(255,255,255,0.08));border-radius:16px;padding:28px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.6)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h5 style="margin:0;font-size:16px;font-weight:700;color:var(--text-primary,#e2e8f0);display:flex;align-items:center;gap:10px">
          <i data-feather="folder-plus" style="width:18px;height:18px;color:var(--primary,#638bff)"></i>
          Nueva Carpeta
        </h5>
        <button onclick="document.getElementById('fmFolderModal').style.display='none'"
          style="background:none;border:none;color:var(--text-disabled,#475569);font-size:22px;cursor:pointer;line-height:1;padding:0">x</button>
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;color:var(--text-disabled,#475569);margin-bottom:6px;text-transform:uppercase">Nombre de la carpeta</div>
      <input id="fmFolderNameInput" type="text" placeholder="Ej: Diagramas P&ID"
        style="width:100%;background:var(--bg-base,#0d1117);border:1px solid var(--border-subtle,rgba(255,255,255,0.08));border-radius:8px;padding:11px 14px;font-size:14px;color:var(--text-primary,#e2e8f0);outline:none;font-family:Inter,sans-serif;transition:border-color 0.15s"
        onfocus="this.style.borderColor='var(--primary,#638bff)'"
        onblur="this.style.borderColor='var(--border-subtle,rgba(255,255,255,0.08))'"
        onkeydown="if(event.key==='Enter')_confirmFolderModal()">
      <div id="fmFolderErrMsg" style="font-size:12px;color:var(--accent-red,#f87171);margin-top:6px;min-height:18px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
        <button onclick="document.getElementById('fmFolderModal').style.display='none'"
          style="background:none;border:1px solid var(--border-subtle,rgba(255,255,255,0.08));color:var(--text-secondary,#94a3b8);border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">
          Cancelar
        </button>
        <button onclick="_confirmFolderModal()"
          style="background:var(--primary,#638bff);border:none;color:#fff;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(99,139,255,0.3)">
          Crear Carpeta
        </button>
      </div>
    </div>`;
  el.addEventListener('click', e => { if (e.target === el) el.style.display = 'none'; });
  document.body.appendChild(el);
}

function _showFolderModal() {
  _ensureFolderModal();
  const input = document.getElementById('fmFolderNameInput');
  const err   = document.getElementById('fmFolderErrMsg');
  if (input) input.value = '';
  if (err)   err.textContent = '';
  document.getElementById('fmFolderModal').style.display = 'flex';
  if (typeof feather !== 'undefined') feather.replace();
  setTimeout(() => input && input.focus(), 60);
}

function _confirmFolderModal() {
  const input = document.getElementById('fmFolderNameInput');
  const err   = document.getElementById('fmFolderErrMsg');
  const name  = input ? input.value.trim() : '';
  if (!name) {
    if (err) err.textContent = 'El nombre no puede estar vacio.';
    return;
  }
  if (/[<>:"/\\|?*]/.test(name)) {
    if (err) err.textContent = 'Nombre invalido: evita caracteres especiales.';
    return;
  }
  document.getElementById('fmFolderModal').style.display = 'none';
  window.createFolder(name);
}

window.createFolder = async function(name) {
  if (!_isAdmin()) { window.showNotif('Acceso denegado', 'danger'); return; }
  try {
    const res = await fetch('/api/files/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: window.currentPath, name })
    });
    if (res.ok) { window.showNotif(`Carpeta "${name}" creada`, 'success'); window.refreshFiles(); }
    else         throw new Error(await res.text());
  } catch (err) { window.showNotif('Error: ' + err.message, 'danger'); }
};

// ─── SUBIR ARCHIVO ───────────────────────────────────────────────
window.uploadFile = async function() {
  if (!_isAdmin()) { window.showNotif('Solo administradores pueden subir archivos', 'danger'); return; }
  const input = document.getElementById('fmUploadInput');
  if (!input || !input.files[0]) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('file', file);
  window.showNotif(`Subiendo "${file.name}"...`, 'info');
  try {
    const res = await fetch(`/api/files/upload?path=${encodeURIComponent(window.currentPath)}`, {
      method: 'POST', body: formData
    });
    if (res.ok) { window.showNotif(`"${file.name}" subido correctamente`, 'success'); window.refreshFiles(); }
    else         throw new Error(await res.text());
  } catch (err) { window.showNotif('Error al subir: ' + err.message, 'danger'); }
  input.value = '';
};

// ─── ELIMINAR ────────────────────────────────────────────────────
window.deleteFile = async function(name) {
  if (!_isAdmin()) { window.showNotif('Solo administradores pueden eliminar archivos', 'danger'); return; }
  
  _showDeleteModal(name);
};

// ─── MODAL: Confirmar Eliminación (reemplaza confirm nativo) ────────
function _ensureDeleteModal() {
  if (document.getElementById('fmDeleteModal')) return;
  const el = document.createElement('div');
  el.id = 'fmDeleteModal';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);display:none;align-items:center;justify-content:center;z-index:9000;backdrop-filter:blur(4px)';
  el.innerHTML = `
    <div style="background:var(--bg-elevated,#1c2333);border:1px solid rgba(239,68,68,0.2);border-radius:16px;padding:28px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.6)">
      <div style="text-align:center;margin-bottom:22px">
        <div style="width:52px;height:52px;background:rgba(239,68,68,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;border:1px solid rgba(239,68,68,0.25)">
          <i data-feather="trash-2" style="width:22px;height:22px;color:var(--accent-red,#f87171)"></i>
        </div>
        <h5 style="margin:0 0 8px;font-size:16px;font-weight:700;color:var(--text-primary,#e2e8f0)">Eliminar archivo</h5>
        <p id="fmDeleteMsg" style="font-size:13px;color:var(--text-secondary,#94a3b8);margin:0;line-height:1.5"></p>
      </div>
      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('fmDeleteModal').style.display='none'"
          style="flex:1;background:none;border:1px solid var(--border-subtle,rgba(255,255,255,0.08));color:var(--text-secondary,#94a3b8);border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer">
          Cancelar
        </button>
        <button id="fmDeleteConfirmBtn"
          style="flex:1;background:var(--accent-red,#f87171);border:none;color:#fff;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer">
          Eliminar
        </button>
      </div>
    </div>`;
  el.addEventListener('click', e => { if (e.target === el) el.style.display = 'none'; });
  document.body.appendChild(el);
}

async function _execDelete(name) {
  try {
    const res = await fetch(`/api/files/delete?path=${encodeURIComponent(window.currentPath)}&name=${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (res.ok) { window.showNotif(`"${name}" eliminado`, 'success'); window.refreshFiles(); }
    else         throw new Error(await res.text());
  } catch (err) { window.showNotif('Error: ' + err.message, 'danger'); }
}

function _showDeleteModal(name) {
  _ensureDeleteModal();
  const msg = document.getElementById('fmDeleteMsg');
  if (msg) msg.textContent = `Se eliminara "${name}" de forma permanente. Esta accion no se puede deshacer.`;
  // Reemplazar el listener del boton para capturar el nombre correcto
  const oldBtn = document.getElementById('fmDeleteConfirmBtn');
  const newBtn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);
  newBtn.addEventListener('click', () => {
    document.getElementById('fmDeleteModal').style.display = 'none';
    _execDelete(name);
  });
  document.getElementById('fmDeleteModal').style.display = 'flex';
  if (typeof feather !== 'undefined') feather.replace();
}

// ─── SYNC UI SEGÚN ROL ───────────────────────────────────────────
function _syncUI() {
  const isAdmin = _isAdmin();
  // Mostrar/ocultar botones de admin
  document.querySelectorAll('.fm-admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  // Actualizar breadcrumb label de usuario
  const userLabel = document.getElementById('fm-user-label');
  if (userLabel) {
    const uname = localStorage.getItem('scada_user') || 'admin';
    userLabel.textContent = `${isAdmin ? '👑' : '👤'} ${uname}`;
  }
}

// ─── VISTAS: Recientes y Destacados ─────────────────────────────
window._fmView = 'all'; // 'all' | 'recent' | 'starred'
window._fmStarred = new Set(JSON.parse(localStorage.getItem('scada_fm_starred') || '[]'));
window._fmAllFiles = []; // cache de todos los archivos para filtrar

function _saveStarred() {
  localStorage.setItem('scada_fm_starred', JSON.stringify([...window._fmStarred]));
}

window.fmSetView = function(view, clickedEl) {
  window._fmView = view;
  // Actualizar estilos del nav
  document.querySelectorAll('.fm-nav-item').forEach(el => {
    const isActive = el.dataset.view === view;
    el.style.color      = isActive ? 'var(--primary,#638bff)' : 'var(--text-secondary,#94a3b8)';
    el.style.background = isActive ? 'rgba(99,139,255,0.1)'   : 'transparent';
    el.style.fontWeight = isActive ? '600' : '400';
  });
  if (view === 'all') {
    window.currentPath = '/';
    window.refreshFiles();
  } else {
    _renderFilteredView(view);
  }
};

function _renderFilteredView(view) {
  const listEl = document.getElementById('fmList');
  if (!listEl) return;

  // Reset breadcrumb
  const bc = document.getElementById('fmBreadcrumb');
  if (bc) bc.innerHTML = `<span style="color:var(--primary,#638bff);font-weight:500">${view === 'recent' ? 'Recientes' : 'Destacados'}</span>`;

  listEl.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-secondary);grid-column:1/-1">
    <div class="spinner-border spinner-border-sm text-primary me-2"></div>Cargando...
  </div>`;

  // Fetch desde raíz y filtrar
  fetch('/api/files/list?path=%2F')
    .then(r => r.ok ? r.json() : [])
    .then(files => {
      listEl.innerHTML = '';
      const isAdmin = _isAdmin();
      let filtered = [];

      if (view === 'recent') {
        // Ordenar por fecha si existe, sino mostrar todos (simulado: tomar los últimos 10)
        filtered = [...files]
          .filter(f => f.type !== 'directory')
          .sort((a, b) => (b.mtime || 0) - (a.mtime || 0))
          .slice(0, 12);
      } else if (view === 'starred') {
        filtered = files.filter(f => window._fmStarred.has(f.name));
      }

      if (filtered.length === 0) {
        listEl.innerHTML = `<div style="padding:60px;text-align:center;color:var(--text-disabled,#475569);grid-column:1/-1">
          <div style="font-size:36px;margin-bottom:12px;opacity:0.3">${view === 'recent' ? '🕐' : '⭐'}</div>
          <div style="font-size:13px">${view === 'recent' ? 'No hay archivos recientes' : 'No tienes archivos destacados'}</div>
          ${view === 'starred' ? '<div style="font-size:11px;color:var(--text-disabled);margin-top:6px">Haz clic derecho en un archivo y selecciona Destacar</div>' : ''}
        </div>`;
        return;
      }

      filtered.forEach((f, idx) => {
        const card = _buildCard(f, isAdmin, idx);
        listEl.appendChild(card);
      });
      if (typeof feather !== 'undefined') feather.replace();
    })
    .catch(() => {
      listEl.innerHTML = `<div style="padding:40px;text-align:center;color:var(--accent-red);grid-column:1/-1">Error al cargar</div>`;
    });
}

// Toggle estrella en un archivo (llamable desde la card)
window.fmToggleStar = function(name) {
  if (window._fmStarred.has(name)) {
    window._fmStarred.delete(name);
    showNotif('"' + name + '" eliminado de destacados', 'info');
  } else {
    window._fmStarred.add(name);
    showNotif('"' + name + '" agregado a destacados ⭐', 'success');
  }
  _saveStarred();
  if (window._fmView === 'starred') _renderFilteredView('starred');
};

// ─── INIT ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (window._fmInitialized) return;
  window._fmInitialized = true;
  
  // Esperar a que el tab de archivos sea visible para inicializar
  const observer = new MutationObserver(() => {
    const tab = document.getElementById('tab-files');
    if (tab && tab.style.display !== 'none') {
      _syncUI();
      window.refreshFiles();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
});
