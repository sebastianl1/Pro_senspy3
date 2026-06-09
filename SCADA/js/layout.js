/**
 * layout.js — Sidebar toggle + Customizer panel
 * NexSCADA v5 — Módulo independiente de layout
 */

// ─── SIDEBAR TOGGLE ──────────────────────────────────────────────
window.toggleSidebar = function () {
  const sidebar = document.getElementById('sidebar');
  const wrapper = document.querySelector('.wrapper');
  if (sidebar) sidebar.classList.toggle('collapsed');
  if (wrapper) wrapper.classList.toggle('sidebar-collapsed');
  localStorage.setItem('scada_sidebar', sidebar && sidebar.classList.contains('collapsed') ? 'collapsed' : 'open');
};

// ─── CUSTOMIZER HTML ─────────────────────────────────────────────
function buildCustomizerHTML() {
  return `
  <div id="customizerOverlay" onclick="toggleCustomizer()"></div>
  <div id="customizerPanel">
    <div class="customizer-header">
      <h5><span style="color:var(--primary)">⚙</span> Personalizar</h5>
      <button class="customizer-close" onclick="toggleCustomizer()">✕</button>
    </div>

    <!-- TEMA -->
    <div class="customizer-section">
      <div class="customizer-section-title">Tema</div>
      <div class="customizer-btn-row">
        <button class="customizer-btn" id="cust-dark" onclick="setTheme('dark')">
          🌙 Oscuro
        </button>
        <button class="customizer-btn" id="cust-light" onclick="setTheme('light')">
          ☀️ Claro
        </button>
      </div>
    </div>

    <!-- COLOR PRIMARIO -->
    <div class="customizer-section">
      <div class="customizer-section-title">Color Principal</div>
      <div class="color-swatches" id="colorSwatches">
        <div class="color-swatch" data-color="blue"    style="background:#3b82f6"  title="Azul"    onclick="setColor('blue')"></div>
        <div class="color-swatch" data-color="default" style="background:#4e7cfe"  title="Índigo"  onclick="setColor('default')"></div>
        <div class="color-swatch" data-color="violet"  style="background:#8b5cf6"  title="Violeta" onclick="setColor('violet')"></div>
        <div class="color-swatch" data-color="rose"    style="background:#f43f5e"  title="Rosa"    onclick="setColor('rose')"></div>
        <div class="color-swatch" data-color="orange"  style="background:#f97316"  title="Naranja" onclick="setColor('orange')"></div>
        <div class="color-swatch" data-color="green"   style="background:#10b981"  title="Verde"   onclick="setColor('green')"></div>
        <div class="color-swatch" data-color="zinc"    style="background:#71717a"  title="Zinc"    onclick="setColor('zinc')"></div>
      </div>
    </div>

    <!-- DENSIDAD -->
    <div class="customizer-section">
      <div class="customizer-section-title">Densidad de Texto</div>
      <div class="customizer-btn-row" style="grid-template-columns:1fr 1fr 1fr">
        <button class="customizer-btn" id="cust-compact"     onclick="setDensity('compact')">Compacto</button>
        <button class="customizer-btn" id="cust-comfortable" onclick="setDensity('comfortable')">Normal</button>
        <button class="customizer-btn" id="cust-spacious"    onclick="setDensity('spacious')">Amplio</button>
      </div>
    </div>

    <!-- LAYOUT SIDEBAR -->
    <div class="customizer-section">
      <div class="customizer-section-title">Barra Lateral</div>
      <div class="customizer-btn-row">
        <button class="customizer-btn" id="cust-sidebar-open"     onclick="setSidebarState('open')">Expandida</button>
        <button class="customizer-btn" id="cust-sidebar-collapsed" onclick="setSidebarState('collapsed')">Colapsada</button>
      </div>
    </div>

    <!-- RESET -->
    <div class="customizer-section" style="border-bottom:none">
      <button class="customizer-btn" style="width:100%;color:var(--danger);border-color:rgba(255,51,85,0.3)"
        onclick="resetCustomizer()">
        ↺ Resetear todo
      </button>
    </div>
  </div>`;
}

// ─── CUSTOMIZER TOGGLE ───────────────────────────────────────────
window.toggleCustomizer = function () {
  const panel = document.getElementById('customizerPanel');
  const overlay = document.getElementById('customizerOverlay');
  if (!panel) return;
  panel.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
};

// ─── APLICAR TEMA ────────────────────────────────────────────────
window.setTheme = function (theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('scada_theme', theme);
  // sync icon en topbar
  const icon = document.getElementById('themeIcon');
  if (icon && typeof feather !== 'undefined') {
    icon.setAttribute('data-feather', theme === 'dark' ? 'sun' : 'moon');
    feather.replace();
  }
  _custHighlight('cust-dark', 'cust-light', theme === 'dark' ? 'cust-dark' : 'cust-light');
};

// ─── APLICAR COLOR ───────────────────────────────────────────────
window.setColor = function (color) {
  // Eliminar data-color anterior
  document.documentElement.removeAttribute('data-color');
  if (color !== 'default') document.documentElement.setAttribute('data-color', color);
  localStorage.setItem('scada_color', color);
  // Highlight swatch activo
  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === color);
  });
};

// ─── APLICAR DENSIDAD ────────────────────────────────────────────
window.setDensity = function (density) {
  document.documentElement.removeAttribute('data-density');
  if (density !== 'spacious') document.documentElement.setAttribute('data-density', density);
  localStorage.setItem('scada_density', density);
  _custHighlight('cust-compact', 'cust-comfortable', 'cust-spacious', 'cust-' + density);
};

// ─── SIDEBAR STATE ───────────────────────────────────────────────
window.setSidebarState = function (state) {
  const sidebar = document.getElementById('sidebar');
  const wrapper = document.querySelector('.wrapper');
  if (state === 'collapsed') {
    sidebar && sidebar.classList.add('collapsed');
    wrapper && wrapper.classList.add('sidebar-collapsed');
  } else {
    sidebar && sidebar.classList.remove('collapsed');
    wrapper && wrapper.classList.remove('sidebar-collapsed');
  }
  localStorage.setItem('scada_sidebar', state);
  _custHighlight('cust-sidebar-open', 'cust-sidebar-collapsed', 'cust-sidebar-' + state);
};

// ─── RESET ───────────────────────────────────────────────────────
window.resetCustomizer = function () {
  setTheme('dark');
  setColor('default');
  setDensity('spacious');
  setSidebarState('open');
};

// ─── HELPER: Resalta el botón activo ────────────────────────────
function _custHighlight(...ids) {
  const active = ids[ids.length - 1]; // último argumento = el activo
  ids.slice(0, -1).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id === active);
  });
}

// ─── RESTAURAR PREFERENCIAS ──────────────────────────────────────
function restorePreferences() {
  const theme   = localStorage.getItem('scada_theme')   || 'dark';
  const color   = localStorage.getItem('scada_color')   || 'default';
  const density = localStorage.getItem('scada_density') || 'spacious';
  const sidebar = localStorage.getItem('scada_sidebar') || 'open';

  // Tema
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('themeIcon');
  if (icon) icon.setAttribute('data-feather', theme === 'dark' ? 'sun' : 'moon');

  // Color
  if (color !== 'default') document.documentElement.setAttribute('data-color', color);

  // Densidad
  if (density !== 'spacious') document.documentElement.setAttribute('data-density', density);

  // Sidebar
  if (sidebar === 'collapsed') {
    const s = document.getElementById('sidebar');
    const w = document.querySelector('.wrapper');
    if (s) s.classList.add('collapsed');
    if (w) w.classList.add('sidebar-collapsed');
  }
}

// ─── INIT ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Inyectar HTML del customizer en body
  const custContainer = document.createElement('div');
  custContainer.innerHTML = buildCustomizerHTML();
  document.body.appendChild(custContainer);

  // Restaurar preferencias guardadas
  restorePreferences();

  // Sync highlights del customizer
  const theme   = localStorage.getItem('scada_theme')   || 'dark';
  const color   = localStorage.getItem('scada_color')   || 'default';
  const density = localStorage.getItem('scada_density') || 'spacious';
  const sidebar = localStorage.getItem('scada_sidebar') || 'open';

  setTimeout(() => {
    _custHighlight('cust-dark', 'cust-light', theme === 'dark' ? 'cust-dark' : 'cust-light');
    _custHighlight('cust-compact', 'cust-comfortable', 'cust-spacious', 'cust-' + density);
    _custHighlight('cust-sidebar-open', 'cust-sidebar-collapsed', 'cust-sidebar-' + sidebar);
    document.querySelectorAll('.color-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.color === color);
    });
    if (typeof feather !== 'undefined') feather.replace();
  }, 100);

  // Hamburger button
  const hamburger = document.querySelector('.js-sidebar-toggle');
  if (hamburger) {
    hamburger.addEventListener('click', () => window.toggleSidebar());
  }
});
