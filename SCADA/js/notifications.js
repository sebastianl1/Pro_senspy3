/**
 * notifications.js — Sistema de notificaciones persistente
 * NexSCADA v5 — Módulo independiente de notificaciones
 * Las notifs se almacenan en localStorage y se muestran en #tab-notifications
 */

// ─── LOG ──────────────────────────────────────────────────────────
const NOTIF_KEY = 'scada_notif_log';
const NOTIF_MAX = 500;

function _loadLog() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } 
  catch { return []; }
}

function _saveLog(log) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(log.slice(-NOTIF_MAX)));
}

function _genId() { return Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

function _addToLog(msg, type) {
  const log = _loadLog();
  const entry = { id: _genId(), ts: new Date().toISOString(), type: type || 'info', msg, read: false };
  log.push(entry);
  _saveLog(log);
  _updateBadge(log);
  return entry;
}

function _updateBadge(log) {
  const unread = (log || _loadLog()).filter(n => !n.read).length;
  document.querySelectorAll('.notif-badge').forEach(el => {
    el.textContent = unread > 0 ? (unread > 99 ? '99+' : unread) : '';
    el.style.display = unread > 0 ? 'flex' : 'none';
  });
  const countEl = document.getElementById('notifCount');
  if (countEl) countEl.textContent = unread;
}

// ─── TOAST ───────────────────────────────────────────────────────
// Sobreescribe el showNotif global para que guarde en log
window.showNotif = function(msg, type = 'info') {
  // Guardar en log
  _addToLog(msg, type);

  // Toast visual
  let container = document.getElementById('notif-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notif-container';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;min-width:280px;max-width:380px';
    document.body.appendChild(container);
  }

  const colors = { info: 'var(--accent-cyan)', success: 'var(--accent-green)', warning: 'var(--accent-amber)', danger: 'var(--accent-red)', alarm: 'var(--accent-red)' };
  const icons  = { info: 'ℹ', success: '✓', warning: '⚠', danger: '✕', alarm: '🔔' };
  const color  = colors[type] || colors.info;
  const icon   = icons[type]  || icons.info;

  const toast = document.createElement('div');
  toast.style.cssText = `background:var(--bg-elevated,#10192a);border:1px solid ${color}33;border-left:3px solid ${color};border-radius:8px;padding:12px 40px 12px 14px;font-size:13px;color:var(--text-primary,#e8f4ff);box-shadow:0 4px 20px rgba(0,0,0,0.4);position:relative;animation:slideInToast 0.3s ease`;
  toast.innerHTML = `<span style="color:${color};margin-right:8px;font-weight:bold">${icon}</span>${msg}<button onclick="this.parentNode.remove()" style="position:absolute;top:8px;right:10px;background:none;border:none;color:var(--text-secondary,#7aa8cc);cursor:pointer;font-size:16px;line-height:1">×</button>`;
  container.prepend(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);

  // Refrescar panel si está abierto
  if (document.getElementById('tab-notifications') && 
      document.getElementById('tab-notifications').style.display !== 'none') {
    renderNotifPanel();
  }
};

// Añadir animación CSS si no existe
if (!document.getElementById('notif-anim-style')) {
  const s = document.createElement('style');
  s.id = 'notif-anim-style';
  s.textContent = '@keyframes slideInToast { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }';
  document.head.appendChild(s);
}

// ─── PANEL DE NOTIFICACIONES ─────────────────────────────────────
let _notifFilter = 'all';

window.setNotifFilter = function(f, el) {
  _notifFilter = f;
  document.querySelectorAll('.notif-filter-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  renderNotifPanel();
};

window.markAllRead = function() {
  const log = _loadLog();
  log.forEach(n => n.read = true);
  _saveLog(log);
  _updateBadge(log);
  renderNotifPanel();
  window.showNotif('Todas las notificaciones marcadas como leídas', 'success');
};

window.clearNotifLog = function() {
  if (!confirm('¿Eliminar todo el historial de notificaciones?')) return;
  _saveLog([]);
  _updateBadge([]);
  renderNotifPanel();
};

window.exportNotifCSV = function() {
  const log = _loadLog();
  const csv = 'Timestamp,Tipo,Mensaje\n' + log.map(n => `"${n.ts}","${n.type}","${n.msg.replace(/"/g,'""')}"`).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'notificaciones_scada.csv'; a.click();
  URL.revokeObjectURL(url);
};

function _formatTs(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO');
}

function renderNotifPanel() {
  const container = document.getElementById('notifLogList');
  if (!container) return;
  let log = _loadLog().reverse(); // más nuevo primero

  if (_notifFilter !== 'all') {
    if (_notifFilter === 'unread') log = log.filter(n => !n.read);
    else log = log.filter(n => n.type === _notifFilter);
  }

  if (log.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-disabled)">
      <div style="font-size:40px;margin-bottom:12px">🔕</div>
      <p>No hay notificaciones${_notifFilter !== 'all' ? ' en esta categoría' : ''}</p>
    </div>`;
    return;
  }

  const typeColors = { info: 'var(--accent-cyan)', success: 'var(--accent-green)', warning: 'var(--accent-amber)', danger: 'var(--accent-red)', alarm: 'var(--accent-red)', system: 'var(--accent-purple)' };
  const typeIcons  = { info:'ℹ', success:'✓', warning:'⚠', danger:'✕', alarm:'🔔', system:'⚙' };

  container.innerHTML = log.map(n => {
    const color = typeColors[n.type] || typeColors.info;
    const icon  = typeIcons[n.type]  || typeIcons.info;
    return `<div class="notif-log-item${n.read ? '' : ' notif-unread'}" 
      style="display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border-subtle);cursor:pointer;transition:background 0.15s"
      onclick="markOneRead('${n.id}',this)"
      onmouseenter="this.style.background='rgba(255,255,255,0.02)'"
      onmouseleave="this.style.background=''"
    >
      <div style="width:28px;height:28px;border-radius:50%;background:${color}22;border:1px solid ${color}44;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;color:${color}">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;color:${n.read ? 'var(--text-secondary)' : 'var(--text-primary)'}${n.read ? '' : ';font-weight:500'}">${n.msg}</div>
        <div style="font-size:11px;color:var(--text-disabled);margin-top:3px;font-family:'JetBrains Mono',monospace">${_formatTs(n.ts)}</div>
      </div>
      ${!n.read ? `<div style="width:6px;height:6px;border-radius:50%;background:${color};margin-top:5px;flex-shrink:0;box-shadow:0 0 6px ${color}"></div>` : ''}
    </div>`;
  }).join('');
}

window.markOneRead = function(id, el) {
  const log = _loadLog();
  const n = log.find(x => x.id === id);
  if (n) { n.read = true; _saveLog(log); _updateBadge(log); }
  if (el) el.classList.remove('notif-unread');
};

// ─── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _updateBadge();

  // Construir el HTML del panel de notificaciones en el tab correspondiente
  const tabNotif = document.getElementById('tab-notifications');
  if (tabNotif) {
    tabNotif.innerHTML = `
    <div style="padding:0 24px 24px">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:20px 0 16px">
        <div>
          <h2 style="font-size:20px;font-weight:700;color:var(--text-heading);margin:0">Centro de Notificaciones</h2>
          <p style="font-size:13px;color:var(--text-secondary);margin:4px 0 0">Historial de eventos del sistema guardado localmente</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm" style="border:1px solid var(--border-default);color:var(--text-secondary);background:transparent;font-size:12px" onclick="exportNotifCSV()">
            📥 Exportar CSV
          </button>
          <button class="btn btn-sm" style="border:1px solid var(--border-default);color:var(--text-secondary);background:transparent;font-size:12px" onclick="markAllRead()">
            ✓ Marcar leídas
          </button>
          <button class="btn btn-sm" style="border:1px solid rgba(255,51,85,0.3);color:var(--accent-red);background:transparent;font-size:12px" onclick="clearNotifLog()">
            🗑 Limpiar
          </button>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <button class="filter-chip notif-filter-btn active" onclick="setNotifFilter('all', this)">Todas</button>
        <button class="filter-chip notif-filter-btn" onclick="setNotifFilter('unread', this)">No leídas</button>
        <button class="filter-chip notif-filter-btn" onclick="setNotifFilter('alarm', this)">⚠ Alarmas</button>
        <button class="filter-chip notif-filter-btn" onclick="setNotifFilter('info', this)">ℹ Sistema</button>
        <button class="filter-chip notif-filter-btn" onclick="setNotifFilter('danger', this)">✕ Errores</button>
      </div>

      <div class="panel" style="padding:0;overflow:hidden">
        <div id="notifLogList" style="max-height:calc(100vh - 280px);overflow-y:auto"></div>
      </div>
    </div>`;
  }

  renderNotifPanel();

  // Notif de bienvenida si es primera carga
  if (_loadLog().length === 0) {
    window.showNotif('NexSCADA v5 iniciado correctamente', 'success');
  }
});
