/**
 * NexSCADA — calendar-manager.js
 * Gestión completa de eventos del calendario de mantenimiento
 * Persistencia en localStorage · CRUD completo · Integración con renderCal()
 */

// ─── STORE ────────────────────────────────────────────────────────
const CalendarManager = (function () {

  const STORAGE_KEY = 'scada_calendar_events';

  const defaultEvents = [
    { id: 'e1', date: '2026-03-17', title: 'Revisión Bomba B-204',      type: 'danger',  time: '',      desc: 'Vibración crítica detectada por ML',       tech: 'JP', status: 'pending' },
    { id: 'e2', date: '2026-03-18', title: 'Inspección HX-102',         type: 'primary', time: '08:00', desc: 'Limpieza química programada',               tech: 'MR', status: 'pending' },
    { id: 'e3', date: '2026-03-22', title: 'Cambio filtros C-301',       type: 'warning', time: '14:00', desc: 'Mantenimiento preventivo trimestral',        tech: 'JP', status: 'pending' },
    { id: 'e4', date: '2026-03-28', title: 'Revisión válvulas V-301',    type: 'warning', time: '09:00', desc: 'Inspección semestral de válvulas',           tech: 'CA', status: 'pending' },
    { id: 'e5', date: '2026-03-14', title: 'Calibración PT-201',         type: 'success', time: '',      desc: 'Calibración semestral realizada',            tech: 'MR', status: 'done'    },
    { id: 'e6', date: '2026-03-10', title: 'Mantenimiento Compresor',    type: 'danger',  time: '10:00', desc: 'Revisión urgente por presión anormal',       tech: 'JP', status: 'done'    },
  ];

  // ─── Load / Save ─────────────────────────────────────────────────
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : defaultEvents;
    } catch { return defaultEvents; }
  }

  function save(events) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); } catch {}
  }

  // ─── Public API ──────────────────────────────────────────────────
  const api = {

    getAll() { return load(); },

    getByDate(dateStr) {
      return load().filter(e => e.date === dateStr);
    },

    getByMonth(year, month) {
      // month: 0-based
      const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
      return load().filter(e => e.date.startsWith(prefix));
    },

    add(event) {
      const events = load();
      event.id = 'e' + Date.now();
      event.status = event.status || 'pending';
      events.push(event);
      save(events);
      api.refresh();
      if (typeof window.showNotif === 'function') {
        window.showNotif('Evento "' + event.title + '" agregado', 'success');
      }
      return event;
    },

    update(id, changes) {
      const events = load();
      const idx = events.findIndex(e => e.id === id);
      if (idx === -1) return null;
      events[idx] = Object.assign({}, events[idx], changes);
      save(events);
      api.refresh();
      if (typeof window.showNotif === 'function') {
        window.showNotif('Evento actualizado', 'info');
      }
      return events[idx];
    },

    delete(id) {
      const events = load().filter(e => e.id !== id);
      save(events);
      api.refresh();
      if (typeof window.showNotif === 'function') {
        window.showNotif('Evento eliminado', 'info');
      }
    },

    markDone(id) {
      api.update(id, { status: 'done' });
      if (typeof window.showNotif === 'function') {
        window.showNotif('Evento marcado como completado ✓', 'success');
      }
    },

    // Re-render calendar and event list if visible
    refresh() {
      if (typeof window.renderCalWithManager === 'function') {
        window.renderCalWithManager();
      }
      api.renderEventList();
    },

    // Render the events panel list
    renderEventList() {
      const container = document.getElementById('calEventList');
      if (!container) return;

      const events = load()
        .sort((a, b) => {
          if (a.status === 'done' && b.status !== 'done') return 1;
          if (a.status !== 'done' && b.status === 'done') return -1;
          return new Date(a.date) - new Date(b.date);
        });

      const typeColors = {
        danger:  'var(--accent-red)',
        warning: 'var(--accent-amber)',
        primary: 'var(--primary)',
        success: 'var(--accent-green)',
      };

      const typeLabels = {
        danger: 'URGENTE', warning: 'PREVENTIVO',
        primary: 'INSPECCIÓN', success: 'COMPLETADO',
      };

      container.innerHTML = events.map(e => {
        const color  = typeColors[e.type]  || 'var(--primary)';
        const label  = typeLabels[e.type]  || e.type.toUpperCase();
        const date   = new Date(e.date + 'T12:00:00');
        const dayStr = date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).toUpperCase();
        const isDone = e.status === 'done';
        return `
          <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:flex-start;${isDone ? 'opacity:0.55' : ''}">
            <div style="width:3px;border-radius:2px;background:${color};align-self:stretch;flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:2px">${e.title}</div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${color}">${isDone ? '✓ COMPLETADO' : (e.time ? e.date.slice(5).split('-').reverse().join(' ') + ' · ' + e.time : dayStr)}</div>
              ${e.desc ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px">${e.desc}</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;align-items:flex-end">
              <span style="font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--text-muted)">${dayStr}</span>
              ${!isDone ? `<button onclick="CalendarManager.markDone('${e.id}')" title="Marcar completado"
                style="background:var(--accent-green);border:none;color:#fff;border-radius:4px;padding:2px 7px;font-size:10px;cursor:pointer;font-weight:600">✓</button>` : ''}
              <button onclick="CalendarManager.openEdit('${e.id}')" title="Editar"
                style="background:none;border:1px solid var(--border);color:var(--text-secondary);border-radius:4px;padding:2px 7px;font-size:10px;cursor:pointer">✎</button>
              <button onclick="CalendarManager.delete('${e.id}')" title="Eliminar"
                style="background:none;border:1px solid rgba(239,68,68,0.3);color:var(--accent-red);border-radius:4px;padding:2px 7px;font-size:10px;cursor:pointer">✕</button>
            </div>
          </div>`;
      }).join('');

      if (typeof feather !== 'undefined') feather.replace();
    },

    // Open add/edit modal
    openEdit(id) {
      const events = load();
      const e = id ? events.find(ev => ev.id === id) : null;
      const modal = document.getElementById('calEventModal');
      if (!modal) { api.createModal(); }

      document.getElementById('calEvId').value      = e ? e.id    : '';
      document.getElementById('calEvTitle').value   = e ? e.title : '';
      document.getElementById('calEvDate').value    = e ? e.date  : new Date().toISOString().slice(0, 10);
      document.getElementById('calEvTime').value    = e ? (e.time || '') : '';
      document.getElementById('calEvType').value    = e ? e.type  : 'primary';
      document.getElementById('calEvDesc').value    = e ? (e.desc || '') : '';
      document.getElementById('calEvTech').value    = e ? (e.tech || '') : '';
      document.getElementById('calEventModal').style.display = 'flex';
    },

    openAdd() { api.openEdit(null); },

    saveModal() {
      const id    = document.getElementById('calEvId').value;
      const data  = {
        title:  document.getElementById('calEvTitle').value.trim(),
        date:   document.getElementById('calEvDate').value,
        time:   document.getElementById('calEvTime').value,
        type:   document.getElementById('calEvType').value,
        desc:   document.getElementById('calEvDesc').value.trim(),
        tech:   document.getElementById('calEvTech').value.trim(),
      };
      if (!data.title || !data.date) {
        if (typeof window.showNotif === 'function') window.showNotif('Título y fecha son obligatorios', 'danger');
        return;
      }
      if (id) { api.update(id, data); } else { api.add(data); }
      document.getElementById('calEventModal').style.display = 'none';
    },

    createModal() {
      const modal = document.createElement('div');
      modal.id = 'calEventModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:none;align-items:center;justify-content:center;z-index:8000';
      modal.innerHTML = `
        <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:16px;padding:28px;width:100%;max-width:440px;box-shadow:0 16px 48px rgba(0,0,0,0.5)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
            <h5 style="margin:0;font-size:16px;font-weight:700;color:var(--text-primary)">Evento de Mantenimiento</h5>
            <button onclick="document.getElementById('calEventModal').style.display='none'"
              style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer;line-height:1">×</button>
          </div>
          <input type="hidden" id="calEvId">
          <div style="display:flex;flex-direction:column;gap:14px">
            <div>
              <label class="form-label" style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;color:var(--text-muted);display:block;margin-bottom:5px">TÍTULO *</label>
              <input id="calEvTitle" class="form-control" placeholder="Ej: Revisión Bomba B-204"
                style="background:var(--bg-card);border-color:var(--border);color:var(--text-primary);font-size:13px">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div>
                <label class="form-label" style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;color:var(--text-muted);display:block;margin-bottom:5px">FECHA *</label>
                <input id="calEvDate" type="date" class="form-control"
                  style="background:var(--bg-card);border-color:var(--border);color:var(--text-primary);font-size:13px">
              </div>
              <div>
                <label class="form-label" style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;color:var(--text-muted);display:block;margin-bottom:5px">HORA</label>
                <input id="calEvTime" type="time" class="form-control"
                  style="background:var(--bg-card);border-color:var(--border);color:var(--text-primary);font-size:13px">
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div>
                <label class="form-label" style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;color:var(--text-muted);display:block;margin-bottom:5px">TIPO</label>
                <select id="calEvType" class="form-select"
                  style="background:var(--bg-card);border-color:var(--border);color:var(--text-primary);font-size:13px">
                  <option value="warning">Preventivo</option>
                  <option value="danger">Urgente</option>
                  <option value="primary">Inspección</option>
                  <option value="success">Completado</option>
                </select>
              </div>
              <div>
                <label class="form-label" style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;color:var(--text-muted);display:block;margin-bottom:5px">TÉCNICO</label>
                <select id="calEvTech" class="form-select"
                  style="background:var(--bg-card);border-color:var(--border);color:var(--text-primary);font-size:13px">
                  <option value="JP">Juan Pérez</option>
                  <option value="MR">María Rodríguez</option>
                  <option value="CA">Carlos Aguilar</option>
                </select>
              </div>
            </div>
            <div>
              <label class="form-label" style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;color:var(--text-muted);display:block;margin-bottom:5px">DESCRIPCIÓN</label>
              <textarea id="calEvDesc" class="form-control" rows="2" placeholder="Detalles del evento..."
                style="background:var(--bg-card);border-color:var(--border);color:var(--text-primary);font-size:13px;resize:none"></textarea>
            </div>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
            <button onclick="document.getElementById('calEventModal').style.display='none'"
              style="background:none;border:1px solid var(--border);color:var(--text-secondary);border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">Cancelar</button>
            <button onclick="CalendarManager.saveModal()"
              style="background:var(--primary);border:none;color:#fff;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">Guardar</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
    },

    // Build calendar dot map for current month
    getDotsForMonth(year, month) {
      const events = api.getByMonth(year, month);
      const dots = {};
      events.forEach(e => {
        const day = parseInt(e.date.split('-')[2]);
        if (!dots[day] || e.type === 'danger') dots[day] = e.type;
      });
      return dots;
    },

    init() {
      api.createModal();
      api.renderEventList();
      // Expose globally so calendar buttons can call it
      window.CalendarManager = api;
    }
  };

  return api;
})();

// Init when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  CalendarManager.init();
});
