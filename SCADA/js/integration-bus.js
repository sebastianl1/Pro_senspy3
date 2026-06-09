/**
 * NexSCADA — integration-bus.js
 * Bus de eventos compartido entre P&ID, HMI 3D y Dashboard.
 *
 * Eventos:
 *   - 'tag:select'  → un módulo informa que el usuario seleccionó un tag/variable.
 *                     detail: { varId?, tag?, source: 'pid'|'hmi'|'dashboard' }
 *   - 'tag:focus'   → solicitar a los otros módulos resaltar ese tag.
 *                     detail: { varId, tag, source }
 *
 * También expone un panel flotante "Tag Inspector" que aparece al seleccionar
 * un tag y permite saltar entre las pestañas P&ID, HMI y Dashboard manteniendo
 * el contexto del tag activo.
 */
(function () {
  if (window.scadaBus) return;

  // ───── Bus ─────────────────────────────────────────────────────
  const bus = new EventTarget();
  bus.emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
  bus.on   = (type, cb)     => bus.addEventListener(type, e => cb(e.detail || {}));
  window.scadaBus = bus;

  // ───── Resolver: dado un varId o tag arbitrario, devolver la variable ─────
  function resolveVariable({ varId, tag }) {
    const vars = (window.variableManager && window.variableManager.variables) || [];
    if (varId) {
      const v = vars.find(x => x.id === varId);
      if (v) return v;
    }
    if (tag) {
      const norm = String(tag).trim().toLowerCase();
      const v = vars.find(x =>
        (x.id  && x.id.toLowerCase()  === norm) ||
        (x.tag && x.tag.toLowerCase() === norm) ||
        (x.tag && x.tag.toLowerCase().includes(norm))
      );
      if (v) return v;
    }
    return varId ? { id: varId, tag: varId, unit: '' } : null;
  }
  window.scadaResolveVar = resolveVariable;

  // ───── Estado del tag activo ────────────────────────────────────
  let activeVar = null;

  // ───── Tag Inspector (panel flotante) ───────────────────────────
  function ensurePanel() {
    let p = document.getElementById('tagInspector');
    if (p) return p;
    p = document.createElement('div');
    p.id = 'tagInspector';
    p.style.cssText = `
      position:fixed; right:18px; bottom:18px; z-index:9999;
      min-width:280px; max-width:340px;
      background:var(--bg-panel,#161b22); color:var(--text-primary,#e6edf3);
      border:1px solid var(--border-subtle,#30363d); border-radius:12px;
      box-shadow:0 12px 32px rgba(0,0,0,0.45);
      font-family:'Inter',system-ui,sans-serif; font-size:13px;
      display:none; overflow:hidden;
    `;
    p.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:10px 12px;border-bottom:1px solid var(--border-subtle,#30363d);
                  background:rgba(255,255,255,0.03)">
        <div style="display:flex;align-items:center;gap:8px;font-weight:600;letter-spacing:.04em;font-size:11px;color:var(--text-muted,#8b949e);text-transform:uppercase">
          <span style="width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e"></span>
          Tag activo
        </div>
        <button id="tagInspectorClose" style="background:none;border:none;color:var(--text-muted,#8b949e);cursor:pointer;font-size:16px;line-height:1;padding:2px 6px;border-radius:4px">×</button>
      </div>
      <div style="padding:12px">
        <div id="tagInspectorTag"  style="font-weight:600;font-size:14px;margin-bottom:2px"></div>
        <div id="tagInspectorDesc" style="font-size:11px;color:var(--text-muted,#8b949e);margin-bottom:10px"></div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:12px">
          <div id="tagInspectorVal" style="font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:600;color:#22c55e">--</div>
          <div id="tagInspectorUnit" style="font-size:11px;color:var(--text-muted,#8b949e)"></div>
          <div id="tagInspectorSrc"  style="margin-left:auto;font-size:9px;letter-spacing:.1em;color:var(--text-muted,#8b949e);text-transform:uppercase"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
          <button data-go="process"   class="ti-btn">P&amp;ID</button>
          <button data-go="3d"        class="ti-btn">HMI 3D</button>
          <button data-go="dashboard" class="ti-btn">Dashboard</button>
        </div>
      </div>
    `;
    document.body.appendChild(p);

    // Estilo de los botones
    const style = document.createElement('style');
    style.textContent = `
      #tagInspector .ti-btn {
        background:rgba(34,197,94,0.10); color:#22c55e;
        border:1px solid rgba(34,197,94,0.35); border-radius:8px;
        padding:7px 6px; font-size:11px; font-weight:600; letter-spacing:.04em;
        cursor:pointer; transition:all .15s;
      }
      #tagInspector .ti-btn:hover {
        background:rgba(34,197,94,0.18); transform:translateY(-1px);
      }
    `;
    document.head.appendChild(style);

    p.querySelector('#tagInspectorClose').addEventListener('click', () => {
      p.style.display = 'none';
      activeVar = null;
    });

    p.querySelectorAll('button[data-go]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!activeVar) return;
        const tab = btn.getAttribute('data-go');
        if (typeof window.showTab === 'function') window.showTab(tab);
        // Pequeño delay para que la pestaña esté visible antes de pedir focus
        setTimeout(() => {
          bus.emit('tag:focus', { varId: activeVar.id, tag: activeVar.tag, source: 'inspector' });
        }, 80);
      });
    });

    return p;
  }

  function renderInspector(v, source) {
    const p = ensurePanel();
    p.style.display = 'block';
    p.querySelector('#tagInspectorTag').textContent  = v.tag || v.id;
    p.querySelector('#tagInspectorDesc').textContent = v.desc || v.id || '';
    p.querySelector('#tagInspectorUnit').textContent = v.unit || '';
    p.querySelector('#tagInspectorSrc').textContent  = source ? 'desde ' + source : '';
    updateInspectorValue();
  }

  function updateInspectorValue() {
    if (!activeVar) return;
    const valEl = document.getElementById('tagInspectorVal');
    if (!valEl) return;
    const pv = window.processVars && window.processVars[activeVar.id];
    if (pv && pv.val != null) {
      const n = Number(pv.val);
      valEl.textContent = isNaN(n) ? String(pv.val) : n.toFixed(2);
    } else {
      valEl.textContent = '--';
    }
  }
  // Refresco en vivo del valor
  setInterval(updateInspectorValue, 1500);

  // ───── Listener principal ──────────────────────────────────────
  bus.on('tag:select', (detail) => {
    const v = resolveVariable(detail);
    if (!v) return;
    activeVar = v;
    renderInspector(v, detail.source);
    // Reemitir focus para que todas las vistas resalten
    bus.emit('tag:focus', { varId: v.id, tag: v.tag, source: detail.source });
  });

  // API conveniente
  window.scadaSelectTag = (varOrTag, source = 'api') => {
    if (typeof varOrTag === 'string') {
      bus.emit('tag:select', { varId: varOrTag, tag: varOrTag, source });
    } else {
      bus.emit('tag:select', { ...varOrTag, source });
    }
  };
})();
