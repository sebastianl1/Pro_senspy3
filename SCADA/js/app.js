/**
 * NexSCADA — app.js (Webpack entry)
 * ───────────────────────────────────
 * Webpack compila ESTE archivo a /js/app.js
 * Solo contiene: i18n (setLang) + login + logout
 *
 * Los CSS se cargan directamente en index.html
 * scada-core.js, variable-manager.js, file-manager.js
 * también se cargan directamente en index.html ANTES que este script
 */

// ─── i18n ─────────────────────────────────────────────────────────
const T = {
  es: {
    'login.subtitle':    'SISTEMA DE CONTROL INDUSTRIAL v5.0',
    'login.user':        'GRUPO3',
    'login.pass':        '12345',
    'login.plant':       'Planta',
    'login.btn':         'INICIAR SESIÓN',
    'nav.supervision':   'SUPERVISIÓN',
    'nav.alerts':        'ALERTAS & DATOS',
    'nav.visualization': 'VISUALIZACIÓN',
    'nav.intelligence':  'INTELIGENCIA',
    'nav.admin':         'ADMINISTRACIÓN',
    'nav.dashboard':     'Dashboard',
    'nav.process':       'Proceso P&ID',
    'nav.alarms':        'Alarmas',
    'nav.historics':     'Históricos',
    'nav.3d':            'Vista 3D',
    'nav.calendar':      'Calendario',
    'nav.ai':            'IA & Predicción',
    'nav.config':        'Configuración',
    'nav.notifications': 'Notificaciones',
    'nav.files':         'Archivos',
    'nav.docs':          'Documental',
  },
  en: {
    'login.subtitle':    'INDUSTRIAL CONTROL SYSTEM v5.0',
    'login.user':        'Username',
    'login.pass':        'Password',
    'login.plant':       'Plant',
    'login.btn':         'SIGN IN',
    'nav.supervision':   'SUPERVISION',
    'nav.alerts':        'ALERTS & DATA',
    'nav.visualization': 'VISUALIZATION',
    'nav.intelligence':  'INTELLIGENCE',
    'nav.admin':         'ADMINISTRATION',
    'nav.dashboard':     'Dashboard',
    'nav.process':       'P&ID Process',
    'nav.alarms':        'Alarms',
    'nav.historics':     'Historical',
    'nav.3d':            '3D View',
    'nav.calendar':      'Calendar',
    'nav.ai':            'AI & Prediction',
    'nav.config':        'Settings',
    'nav.notifications': 'Notifications',
    'nav.files':         'Files',
    'nav.docs':          'Documentation',
  },
  de: {
    'login.subtitle':    'INDUSTRIELLES LEITSYSTEM v5.0',
    'login.user':        'Benutzer',
    'login.pass':        'Passwort',
    'login.plant':       'Anlage',
    'login.btn':         'ANMELDEN',
    'nav.supervision':   'ÜBERWACHUNG',
    'nav.alerts':        'ALARME & DATEN',
    'nav.visualization': 'VISUALISIERUNG',
    'nav.intelligence':  'INTELLIGENZ',
    'nav.admin':         'VERWALTUNG',
    'nav.dashboard':     'Dashboard',
    'nav.process':       'P&ID Prozess',
    'nav.alarms':        'Alarme',
    'nav.historics':     'Verlauf',
    'nav.3d':            '3D-Ansicht',
    'nav.calendar':      'Kalender',
    'nav.ai':            'KI & Prognose',
    'nav.config':        'Einstellungen',
    'nav.notifications': 'Benachrichtigungen',
    'nav.files':         'Dateien',
    'nav.docs':          'Dokumentation',
  }
};

// ─── NOTIFICACIONES ──────────────────────────────────────────────
// Definida aquí porque scada-core.js la usa pero no la define
window.showNotif = function(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `scada-toast toast show align-items-center text-white bg-${type} border-0 position-fixed bottom-0 end-0 m-3`;
  toast.style.cssText = 'z-index:9999;min-width:280px;';
  toast.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.closest('.scada-toast').remove()"></button></div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
};


// ─── THEME TOGGLE ────────────────────────────────────────────────
window.toggleTheme = function() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('scada_theme', next);
  const icon = document.querySelector('[onclick="toggleTheme()"] i');
  if (icon) {
    icon.setAttribute('data-feather', next === 'dark' ? 'sun' : 'moon');
    if (typeof feather !== 'undefined') feather.replace();
  }
};

// ─── CUSTOMIZER (panel lateral de opciones) ───────────────────────
window.toggleCustomizer = function() {
  const panel = document.getElementById('customizerPanel');
  if (panel) {
    panel.classList.toggle('open');
  } else {
    if (typeof window.showNotif === 'function') {
      window.showNotif('Panel de personalización próximamente', 'info');
    }
  }
};

// ─── SIDEBAR TOGGLE ───────────────────────────────────────────────
window.toggleSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  const wrapper = document.querySelector('.wrapper');
  if (sidebar) sidebar.classList.toggle('collapsed');
  if (wrapper) wrapper.classList.toggle('sidebar-collapsed');
};

// ─── SHOW TAB ─────────────────────────────────────────────────────
// Definida aquí porque scada-core.js no la tiene
window.showTab = function(tabId) {
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('active');
  });

  const target = document.getElementById('tab-' + tabId);
  if (target) {
    target.style.display = tabId === 'files' ? 'flex' : 'block';
    target.classList.add('active');
  }

  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  const navItem = document.querySelector('.sidebar-item[data-tab="' + tabId + '"]');
  if (navItem) navItem.classList.add('active');

  // Actualizar título de página
  const pageTitleEl = document.getElementById('pageTitle');
  if (pageTitleEl) {
    const titles = {
      dashboard: 'Dashboard Principal', process: 'Proceso P&ID',
      alarms: 'Alarmas', historics: 'Históricos', '3d': 'HMI',
      calendar: 'Calendario', ai: 'IA & Predicción', config: 'Configuración del Sistema',
      notifications: 'Notificaciones', files: 'Archivos', docs: 'Documental'
    };
    pageTitleEl.innerText = titles[tabId] || tabId;
  }

  // Breadcrumb
  const bcEl = document.getElementById('breadcrumbCurrent');
  if (bcEl) bcEl.innerText = tabId.charAt(0).toUpperCase() + tabId.slice(1);

  // Acciones por tab
  if (tabId === 'files' && typeof window.refreshFiles === 'function') window.refreshFiles();
  if (tabId === 'config' && typeof window.setConfigSubTab === 'function') {
    const firstItem = document.querySelector('.config-nav-item');
    if (firstItem) firstItem.click();
  }
  if (tabId === '3d') {
    setTimeout(() => {
      if (typeof init3D === 'function' && !window.threeRenderer) init3D();
    }, 100);
  }
  if (tabId === 'alarms' && typeof populateAlarmTable === 'function') populateAlarmTable();
  if (tabId === 'config' && typeof populateTags === 'function') populateTags();
  if (tabId === 'ai' && typeof populateAnomaly === 'function') populateAnomaly();
};

// ─── SET CONFIG SUB-TAB ───────────────────────────────────────────
window.setConfigSubTab = function(paneId, el) {
  document.querySelectorAll('.config-pane').forEach(p => p.style.display = 'none');
  const target = document.getElementById('config-' + paneId);
  if (target) target.style.display = 'block';
  if (el) {
    document.querySelectorAll('.config-nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
  }
  if (paneId === 'variables' && window.variableManager) {
    window.variableManager.renderTable();
  }
};

// ─── INIT APP ─────────────────────────────────────────────────────
// Llamada desde doLogin() — inicializa todo el SCADA
function initApp() {
  if (typeof feather !== 'undefined') feather.replace();
  setInterval(updateClock, 1000);
  window.variableManager = new VariableManager();
  if (window.variableManager) window.variableManager.renderTable();
}

window.setLang = function(lang) {
  if (!T[lang]) return;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (T[lang][key] !== undefined) el.innerText = T[lang][key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (T[lang][key] !== undefined) el.placeholder = T[lang][key];
  });

  const flags = { es: '🇪🇸', en: '🇺🇸', de: '🇩🇪' };
  const flagEl  = document.getElementById('langFlag');
  const labelEl = document.getElementById('langLabel');
  if (flagEl)  flagEl.textContent  = flags[lang] || '🌐';
  if (labelEl) labelEl.textContent = lang.toUpperCase();

  localStorage.setItem('scada_lang', lang);

  // showNotif viene de scada-core.js, ya cargado antes que este script
  if (typeof window.showNotif === 'function') {
    window.showNotif(
      lang === 'en' ? 'Language: English' :
      lang === 'de' ? 'Sprache: Deutsch'  : 'Idioma: Español',
      'info'
    );
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────
window.doLogin = function() {
  const user = document.getElementById('loginUser')?.value?.trim().toLowerCase();
  const pass = document.getElementById('loginPass')?.value;

  if (user === 'grupo3' && (pass === 'grupo3' || pass === '12345')) {
    const modal = document.getElementById('loginModal');
    if (modal) {
      modal.style.transition = 'opacity 0.4s ease';
      modal.style.opacity = '0';
      setTimeout(() => { modal.style.display = 'none'; }, 400);
    }
    // initApp viene de scada-core.js
    if (typeof initApp === 'function') initApp();
    if (typeof window.showNotif === 'function') {
      window.showNotif('Sesión iniciada como Administrador', 'success');
    }
  } else {
    if (typeof window.showNotif === 'function') {
      window.showNotif('esta mal la clave maricon, viva petro y el pacto en esta monda', 'danger');
    }
    const passInput = document.getElementById('loginPass');
    if (passInput) {
      passInput.style.borderColor = 'var(--danger, #dc3545)';
      setTimeout(() => { passInput.style.borderColor = ''; }, 1500);
    }
  }
};

window.doLogout = function() {
  localStorage.removeItem('scada_lang');
  location.reload();
};

// ─── DOM READY ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Enter en contraseña
  const passInput = document.getElementById('loginPass');
  if (passInput) {
    passInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') window.doLogin();
    });
  }

  // Restaurar tema guardado
  const savedTheme = localStorage.getItem('scada_theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

  // Restaurar idioma guardado
  const savedLang = localStorage.getItem('scada_lang');
  if (savedLang && savedLang !== 'es' && T[savedLang]) {
    window.setLang(savedLang);
  }
});
