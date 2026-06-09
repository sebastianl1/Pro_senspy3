/**
 * NexSCADA — notifications-manager.js
 * Historial de notificaciones · Marcar como leído · Filtros · Badge
 * Intercepta window.showNotif para capturar automáticamente cada notificación
 */

const NotificationsManager = (function () {

  const STORAGE_KEY = 'scada_notifications';
  const MAX_ITEMS   = 150;

  // ─── Store ────────────────────────────────────────────────────────
  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }

  function save(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS))); } catch {}
  }

  // ─── Type config ─────────────────────────────────────────────────
  const typeConfig = {
    success: { color: 'var(--accent-green)', icon: '✓', label: 'OK'      },
    danger:  { color: 'var(--accent-red)',   icon: '⚠', label: 'ERROR'   },
    warning: { color: 'var(--accent-amber)', icon: '!', label: 'AVISO'   },
    info:    { color: 'var(--primary)',       icon: 'ℹ', label: 'INFO'    },
    alarm:   { color: 'var(--accent-red)',   icon: '🔔', label: 'ALARMA' },
  };

  // ─── Unread count ─────────────────────────────────────────────────
  function unreadCount() {
    return load().filter(n => !n.read).length;
  }

  function updateBadge() {
    const count = unreadCount();
    const el = document.getElementById('notifCount');
    if (el) {
      el.textContent = count;
      el.style.display = count > 0 ? 'inline-block' : 'none';
    }
    // Also update topbar bell badge
    const topBadge = document.getElementById('notifIndicator');
    if (topBadge) topBadge.textContent = count;
  }

  // ─── Public API ──────────────────────────────────────────────────
  const api = {

    add(msg, type) {
      const items = load();
      items.unshift({
        id:   'n' + Date.now(),
        msg:  msg,
        type: type || 'info',
        ts:   new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
        read: false,
      });
      save(items);
      updateBadge();
      // Re-render if panel is visible
      const tab = document.getElementById('tab-notifications');
      if (tab && tab.style.display !== 'none') api.render();
    },

    markRead(id) {
      const items = load().map(n => n.id === id ? { ...n, read: true } : n);
      save(items);
      updateBadge();
      api.render();
    },

    markAllRead() {
      const items = load().map(n => ({ ...n, read: true }));
      save(items);
      updateBadge();
      api.render();
      if (typeof window.showNotifRaw === 'function') {
        window.showNotifRaw('Todas las notificaciones marcadas como leídas', 'info');
      }
    },

    delete(id) {
      save(load().filter(n => n.id !== id));
      updateBadge();
      api.render();
    },

    clearAll() {
      save([]);
      updateBadge();
      api.render();
    },

    // Render the full notifications tab
    render(filter) {
      const container = document.getElementById('notifPanelList');
      if (!container) return;

      let items = load();
      if (filter && filter !== 'all') {
        if (filter === 'unread') items = items.filter(n => !n.read);
        else items = items.filter(n => n.type === filter);
      }

      if (items.length === 0) {
        container.innerHTML = `<div style="padding:48px 24px;text-align:center;color:var(--text-muted)">
          <div style="font-size:32px;margin-bottom:12px;opacity:0.3">🔔</div>
          <div style="font-size:13px">Sin notificaciones</div>
        </div>`;
        return;
      }

      container.innerHTML = items.map(n => {
        const cfg = typeConfig[n.type] || typeConfig.info;
        return `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);
            background:${n.read ? 'transparent' : 'rgba(99,139,255,0.04)'};transition:background 0.15s;cursor:pointer"
            onclick="NotificationsManager.markRead('${n.id}')">
            <div style="width:8px;height:8px;border-radius:50%;background:${cfg.color};margin-top:5px;flex-shrink:0;
              ${n.read ? 'opacity:0.3' : 'box-shadow:0 0 6px ' + cfg.color}"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;color:${n.read ? 'var(--text-secondary)' : 'var(--text-primary)'};font-weight:${n.read ? '400' : '500'};line-height:1.4">${n.msg}</div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-muted);margin-top:3px">${n.date} · ${n.ts}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
              <span style="font-family:'JetBrains Mono',monospace;font-size:9px;background:${cfg.color}22;color:${cfg.color};padding:1px 6px;border-radius:3px">${cfg.label}</span>
              <button onclick="event.stopPropagation();NotificationsManager.delete('${n.id}')"
                style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;padding:0;line-height:1"
                title="Eliminar">×</button>
            </div>
          </div>`;
      }).join('');
    },

    // Build the notifications tab HTML (injects into placeholder)
    buildTab() {
      const tab = document.getElementById('tab-notifications');
      if (!tab) return;

      tab.innerHTML = `
        <div class="section-label">CENTRO DE NOTIFICACIONES</div>
        <div style="display:grid;grid-template-columns:1fr 260px;gap:16px">

          <!-- Panel principal -->
          <div class="panel fade-in" style="margin-bottom:0">
            <div class="panel-header">
              <div class="panel-title">Historial</div>
              <span class="panel-badge count" id="notifCount" style="margin-left:8px">0</span>
              <div class="panel-spacer"></div>
              <!-- Filtros -->
              <div style="display:flex;gap:4px" id="notifFilters">
                <div class="filter-chip active" onclick="NotificationsManager.setFilter('all',this)">TODAS</div>
                <div class="filter-chip" onclick="NotificationsManager.setFilter('unread',this)">NO LEÍDAS</div>
                <div class="filter-chip" onclick="NotificationsManager.setFilter('danger',this)">ERRORES</div>
                <div class="filter-chip" onclick="NotificationsManager.setFilter('warning',this)">AVISOS</div>
              </div>
              <button onclick="NotificationsManager.markAllRead()"
                style="margin-left:8px;background:none;border:1px solid var(--border);color:var(--text-secondary);border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer"
                title="Marcar todas como leídas">✓ Todo leído</button>
              <button onclick="if(confirm('¿Borrar todo el historial?'))NotificationsManager.clearAll()"
                style="margin-left:4px;background:none;border:1px solid rgba(239,68,68,0.3);color:var(--accent-red);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer"
                title="Limpiar historial">🗑</button>
            </div>
            <div id="notifPanelList" style="max-height:calc(100vh - 260px);overflow-y:auto"></div>
          </div>

          <!-- Panel lateral: stats -->
          <div style="display:flex;flex-direction:column;gap:14px">
            <div class="panel fade-in" style="margin-bottom:0">
              <div class="panel-header"><div class="panel-title">Resumen</div></div>
              <div class="panel-body" style="display:flex;flex-direction:column;gap:10px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:13px;color:var(--text-secondary)">No leídas</span>
                  <span id="statUnread" style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--primary);font-weight:700">0</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:13px;color:var(--text-secondary)">Errores</span>
                  <span id="statDanger" style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent-red)">0</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:13px;color:var(--text-secondary)">Avisos</span>
                  <span id="statWarning" style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent-amber)">0</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:13px;color:var(--text-secondary)">Total</span>
                  <span id="statTotal" style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text-primary)">0</span>
                </div>
              </div>
            </div>

            <!-- Historial de alarmas (reusa AlarmManager) -->
            <div class="panel fade-in" style="margin-bottom:0">
              <div class="panel-header"><div class="panel-title">Historial de ACKs</div></div>
              <div id="alarmHistoryList" style="max-height:280px;overflow-y:auto">
                <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Sin historial</div>
              </div>
            </div>
          </div>
        </div>`;

      updateBadge();
      api.render();
      api.updateStats();
      // Also render alarm history if AlarmManager is loaded
      if (typeof AlarmManager !== 'undefined') AlarmManager.renderHistory();
    },

    setFilter(filter, el) {
      document.querySelectorAll('#notifFilters .filter-chip').forEach(c => c.classList.remove('active'));
      if (el) el.classList.add('active');
      api.currentFilter = filter;
      api.render(filter);
    },

    updateStats() {
      const items = load();
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('statUnread',  items.filter(n => !n.read).length);
      set('statDanger',  items.filter(n => n.type === 'danger').length);
      set('statWarning', items.filter(n => n.type === 'warning').length);
      set('statTotal',   items.length);
    },

    currentFilter: 'all',

    init() {
      // Intercept showNotif to capture all notifications
      const originalShowNotif = window.showNotif;
      window.showNotifRaw = originalShowNotif; // keep raw for internal use

      window.showNotif = function (msg, type, duration) {
        // 1. Show the toast as usual
        if (typeof originalShowNotif === 'function') {
          originalShowNotif(msg, type, duration);
        }
        // 2. Store in history
        api.add(msg, type);
        api.updateStats();
      };

      updateBadge();
      window.NotificationsManager = api;
    }
  };

  return api;
})();

document.addEventListener('DOMContentLoaded', () => {
  NotificationsManager.init();

  // Build tab when user navigates to it
  const originalShowTab = window.showTab;
  if (typeof originalShowTab === 'function') {
    window.showTab = function (tabId) {
      originalShowTab(tabId);
      if (tabId === 'notifications') {
        NotificationsManager.buildTab();
        if (typeof AlarmManager !== 'undefined') {
          setTimeout(() => AlarmManager.renderHistory(), 50);
        }
      }
      if (tabId === 'alarms') {
        if (typeof AlarmManager !== 'undefined') {
          setTimeout(() => AlarmManager.refreshTable(), 50);
        }
      }
    };
  }
});
