/**
 * config-panel.js — Panel de Configuración completo
 * NexSCADA v5 — Módulo independiente de configuración
 * Sub-tabs: Perfil, Tags, Variables, Conexiones, Alarmas, Usuarios, Sistema
 */

// ─── UTILS ───────────────────────────────────────────────────────
const USERS_KEY  = 'scada_users';
const CONFIG_KEY = 'scada_system_config';

function _defaultUsers() {
  return [
    { id:'u1', name:'Administrador', username:'admin',    email:'admin@nexscada.com',  role:'admin',    active:true,  lastLogin:new Date().toISOString() },
    { id:'u2', name:'Operador 1',    username:'operador', email:'op1@nexscada.com',    role:'operator', active:true,  lastLogin:'' },
    { id:'u3', name:'Supervisor',    username:'super',    email:'super@nexscada.com',  role:'supervisor',active:true, lastLogin:'' },
    { id:'u4', name:'Visor',         username:'visor',    email:'visor@nexscada.com',  role:'viewer',   active:false, lastLogin:'' },
  ];
}

function _loadUsers()  { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || _defaultUsers(); } catch { return _defaultUsers(); } }
function _saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
function _loadConfig() { try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {}; } catch { return {}; } }
function _saveConfig(c){ localStorage.setItem(CONFIG_KEY, JSON.stringify(c)); }

function _roleLabel(r) {
  return { admin:'Superadmin', operator:'Operador', supervisor:'Supervisor', viewer:'Visor' }[r] || r;
}
function _roleColor(r) {
  return { admin:'var(--accent-red)', operator:'var(--accent-amber)', supervisor:'var(--accent-cyan)', viewer:'var(--text-secondary)' }[r] || 'var(--text-secondary)';
}

// ─── SUB-TAB SWITCHING ───────────────────────────────────────────
window.setConfigSubTab = function(tab, el) {
  document.querySelectorAll('.config-pane').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.config-nav-item').forEach(n => n.classList.remove('active'));
  const pane = document.getElementById('config-' + tab);
  if (pane) pane.style.display = 'block';
  if (el)  el.classList.add('active');

  // Renderizar el tab correspondiente
  if (tab === 'users')     renderUsersTab();
  if (tab === 'variables') { if (window.variableManager) window.variableManager.renderTable(); }
  if (tab === 'tags')      renderTagsTab();
  if (tab === 'connections') renderConnectionsTab();
  if (tab === 'system')    renderSystemTab();
  if (tab === 'profile')   renderProfileTab();
};

// ─── PROFILE TAB ─────────────────────────────────────────────────
function renderProfileTab() {
  const pane = document.getElementById('config-profile');
  if (!pane) return;
  const users = _loadUsers();
  const currentUsername = localStorage.getItem('scada_user') || 'admin';
  const user = users.find(u => u.username === currentUsername) || users[0];
  pane.innerHTML = `
  <div class="panel fade-in" style="max-width:520px">
    <div class="panel-header"><div class="panel-title">Mi Perfil</div></div>
    <div class="panel-body">
      <div style="display:flex;gap:20px;align-items:center;margin-bottom:24px">
        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--accent-blue),var(--accent-cyan));display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;flex-shrink:0">
          ${(user.name||'?').charAt(0).toUpperCase()}
        </div>
        <div>
          <div style="font-size:16px;font-weight:600;color:var(--text-primary)">${user.name}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">@${user.username}</div>
          <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${_roleColor(user.role)}22;color:${_roleColor(user.role)};font-weight:600">${_roleLabel(user.role)}</span>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label" style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px">Nombre completo</label>
        <input type="text" id="prof-name" class="form-control" style="background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary)" value="${user.name}">
      </div>
      <div class="mb-3">
        <label class="form-label" style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px">Email</label>
        <input type="email" id="prof-email" class="form-control" style="background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary)" value="${user.email}">
      </div>
      <div class="mb-4">
        <label class="form-label" style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px">Nueva contraseña</label>
        <input type="password" id="prof-pass" class="form-control" style="background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary)" placeholder="Dejar vacío para no cambiar">
      </div>
      <button class="btn btn-primary" onclick="saveProfile('${user.id}')">Guardar cambios</button>
    </div>
  </div>`;
}

window.saveProfile = function(id) {
  const users = _loadUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return;
  users[idx].name  = document.getElementById('prof-name').value;
  users[idx].email = document.getElementById('prof-email').value;
  _saveUsers(users);
  window.showNotif('Perfil actualizado correctamente', 'success');
};

// ─── USERS TAB ───────────────────────────────────────────────────
function renderUsersTab() {
  const pane = document.getElementById('config-users');
  if (!pane) return;
  const users = _loadUsers();
  pane.innerHTML = `
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h6 class="mb-0" style="color:var(--text-heading)">Gestión de Usuarios <span style="font-size:12px;color:var(--text-disabled)">(${users.length})</span></h6>
    <button class="btn btn-primary btn-sm" onclick="openUserModal()"><i data-feather="user-plus" class="feather-xs me-1"></i>Añadir Usuario</button>
  </div>
  <div class="table-responsive">
    <table class="table table-dark table-hover align-middle" style="font-size:13px">
      <thead style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim)">
        <tr><th>Usuario</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Última Sesión</th><th class="text-end">Acciones</th></tr>
      </thead>
      <tbody>
        ${users.map(u => `<tr>
          <td style="font-family:'JetBrains Mono',monospace;color:var(--accent-cyan)">@${u.username}</td>
          <td style="font-weight:500">${u.name}</td>
          <td style="color:var(--text-secondary)">${u.email}</td>
          <td><span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${_roleColor(u.role)}22;color:${_roleColor(u.role)};font-weight:600">${_roleLabel(u.role)}</span></td>
          <td>${u.active ? '<span style="color:var(--accent-green)">● Activo</span>' : '<span style="color:var(--text-disabled)">● Inactivo</span>'}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-dim)">${u.lastLogin ? new Date(u.lastLogin).toLocaleString('es-CO') : '—'}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="openUserModal('${u.id}')"><i data-feather="edit-2" class="feather-xs"></i></button>
            <button class="btn btn-sm btn-outline-secondary me-1" onclick="toggleUserActive('${u.id}')">${u.active ? '⏸' : '▶'}</button>
            ${u.username !== 'admin' ? `<button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${u.id}')"><i data-feather="trash-2" class="feather-xs"></i></button>` : ''}
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
  ${_buildUserModal()}`;
  if (typeof feather !== 'undefined') feather.replace();
}

function _buildUserModal() {
  return `
  <div id="userModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1050;align-items:center;justify-content:center;backdrop-filter:blur(4px)">
    <div style="background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:16px;padding:28px;width:440px;max-width:95vw">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h5 id="userModalTitle" style="margin:0;font-size:16px;color:var(--text-heading)">Usuario</h5>
        <button onclick="document.getElementById('userModal').style.display='none'" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:18px">×</button>
      </div>
      <input type="hidden" id="um-id">
      <div class="mb-3"><label style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Nombre completo</label><input id="um-name" type="text" class="form-control" style="background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary)"></div>
      <div class="mb-3"><label style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Usuario</label><input id="um-username" type="text" class="form-control" style="background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary)"></div>
      <div class="mb-3"><label style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Email</label><input id="um-email" type="email" class="form-control" style="background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary)"></div>
      <div class="mb-3"><label style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Rol</label>
        <select id="um-role" class="form-select" style="background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary)">
          <option value="admin">Superadmin</option><option value="supervisor">Supervisor</option>
          <option value="operator">Operador</option><option value="viewer">Visor</option>
        </select>
      </div>
      <div class="mb-4"><label style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Contraseña</label><input id="um-pass" type="password" class="form-control" placeholder="Vacío = sin cambio" style="background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary)"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline-secondary flex-fill" onclick="document.getElementById('userModal').style.display='none'">Cancelar</button>
        <button class="btn btn-primary flex-fill" onclick="saveUserModal()">Guardar</button>
      </div>
    </div>
  </div>`;
}

window.openUserModal = function(id) {
  const users = _loadUsers();
  const u = id ? users.find(x => x.id === id) : null;
  document.getElementById('um-id').value       = u ? u.id       : '';
  document.getElementById('um-name').value     = u ? u.name     : '';
  document.getElementById('um-username').value = u ? u.username : '';
  document.getElementById('um-email').value    = u ? u.email    : '';
  document.getElementById('um-role').value     = u ? u.role     : 'operator';
  document.getElementById('um-pass').value     = '';
  document.getElementById('userModalTitle').textContent = u ? 'Editar Usuario' : 'Nuevo Usuario';
  document.getElementById('userModal').style.display = 'flex';
};

window.saveUserModal = function() {
  const id = document.getElementById('um-id').value;
  const users = _loadUsers();
  const data = {
    id:       id || 'u' + Date.now(),
    name:     document.getElementById('um-name').value,
    username: document.getElementById('um-username').value,
    email:    document.getElementById('um-email').value,
    role:     document.getElementById('um-role').value,
    active:   true,
    lastLogin: id ? (users.find(u => u.id === id) || {}).lastLogin || '' : ''
  };
  if (!data.name || !data.username) { window.showNotif('Nombre y usuario son requeridos', 'danger'); return; }
  if (id) { const idx = users.findIndex(u => u.id === id); if (idx !== -1) users[idx] = data; }
  else     { users.push(data); }
  _saveUsers(users);
  document.getElementById('userModal').style.display = 'none';
  renderUsersTab();
  window.showNotif(id ? 'Usuario actualizado' : 'Usuario creado correctamente', 'success');
};

window.deleteUser = function(id) {
  if (!confirm('¿Eliminar este usuario?')) return;
  const users = _loadUsers().filter(u => u.id !== id);
  _saveUsers(users);
  renderUsersTab();
  window.showNotif('Usuario eliminado', 'success');
};

window.toggleUserActive = function(id) {
  const users = _loadUsers();
  const u = users.find(x => x.id === id);
  if (u) u.active = !u.active;
  _saveUsers(users);
  renderUsersTab();
  window.showNotif(`Usuario ${u && u.active ? 'activado' : 'desactivado'}`, 'info');
};

// ─── TAGS TAB ────────────────────────────────────────────────────
function renderTagsTab() {
  const pane = document.getElementById('config-tags');
  if (!pane || typeof tagData === 'undefined') return;
  pane.innerHTML = `
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h6 class="mb-0" style="color:var(--text-heading)">Tags de Proceso <span style="font-size:12px;color:var(--text-disabled)">(${tagData.length})</span></h6>
    <button class="btn btn-primary btn-sm" onclick="window.showNotif('Funcion de añadir tag próximamente','info')"><i data-feather="plus" class="feather-xs me-1"></i>Nuevo Tag</button>
  </div>
  <div class="table-responsive">
    <table class="table table-dark table-hover align-middle" style="font-size:13px">
      <thead style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim)">
        <tr><th>Estado</th><th>ID</th><th>Descripción</th><th>Tipo</th><th>Unidad</th><th>Min</th><th>Max</th><th>Protocolo</th></tr>
      </thead>
      <tbody id="tagTableBody"></tbody>
    </table>
  </div>`;
  if (typeof feather !== 'undefined') feather.replace();
  if (typeof populateTags === 'function') populateTags();
}

// ─── CONNECTIONS TAB ─────────────────────────────────────────────
function renderConnectionsTab() {
  const pane = document.getElementById('config-connections');
  if (!pane) return;
  const cfg = _loadConfig();
  pane.innerHTML = `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
    ${_connCard('MODBUS TCP','modbus','var(--accent-amber)',[
      {label:'IP del PLC/RTU', id:'modbus-ip',   val: cfg.modbus_ip   || '192.168.1.10'},
      {label:'Puerto',         id:'modbus-port', val: cfg.modbus_port || '502'},
      {label:'Unit ID',        id:'modbus-uid',  val: cfg.modbus_uid  || '1'},
    ])}
    ${_connCard('OPC-UA','opcua','var(--accent-blue)',[
      {label:'Endpoint URL', id:'opcua-url',  val: cfg.opcua_url  || 'opc.tcp://192.168.1.20:4840'},
      {label:'Namespace',    id:'opcua-ns',   val: cfg.opcua_ns   || '2'},
    ])}
    ${_connCard('MQTT v5','mqtt','var(--accent-green)',[
      {label:'Broker URL', id:'mqtt-url',  val: cfg.mqtt_url  || 'mqtt://192.168.1.1'},
      {label:'Puerto',     id:'mqtt-port', val: cfg.mqtt_port || '1883'},
      {label:'Usuario',    id:'mqtt-user', val: cfg.mqtt_user || 'scada'},
    ])}
  </div>`;
}

function _connCard(title, prefix, color, fields) {
  return `<div class="panel fade-in">
    <div class="panel-header" style="background:${color}11;border-bottom:1px solid ${color}33">
      <div class="panel-title" style="color:${color}">${title}</div>
      <span style="font-size:11px;color:var(--accent-green)">● Simulado</span>
    </div>
    <div class="panel-body">
      ${fields.map(f => `<div class="mb-3">
        <label style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">${f.label}</label>
        <input id="${f.id}" type="text" class="form-control" value="${f.val}" style="background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary);font-family:'JetBrains Mono',monospace;font-size:13px">
      </div>`).join('')}
      <button class="btn btn-sm" style="border:1px solid ${color}55;color:${color};background:${color}11;font-size:12px" onclick="saveConnConfig('${prefix}'); window.showNotif('Configuración ${title} guardada','success')">Guardar</button>
      <button class="btn btn-sm ms-2" style="border:1px solid ${color}33;color:var(--text-secondary);background:transparent;font-size:12px" onclick="window.showNotif('Probando conexión ${title}...','info')">Probar Conexión</button>
    </div>
  </div>`;
}

window.saveConnConfig = function(prefix) {
  const cfg = _loadConfig();
  const inputs = document.querySelectorAll(`[id^="${prefix}-"]`);
  inputs.forEach(inp => { cfg[inp.id.replace('-','_')] = inp.value; });
  _saveConfig(cfg);
};

// ─── SYSTEM TAB ──────────────────────────────────────────────────
function renderSystemTab() {
  const pane = document.getElementById('config-system');
  if (!pane) return;
  const cfg = _loadConfig();
  pane.innerHTML = `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
    <div class="panel fade-in">
      <div class="panel-header"><div class="panel-title">Información de Planta</div></div>
      <div class="panel-body">
        <div class="mb-3"><label style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Nombre de Planta</label><input id="sys-plant" type="text" class="form-control" value="${cfg.plant_name || 'NexSCADA — Planta Industrial'}" style="background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary)"></div>
        <div class="mb-3"><label style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Zona Horaria</label>
          <select id="sys-tz" class="form-select" style="background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary)">
            <option ${cfg.tz==='America/Bogota'?'selected':''}>America/Bogota</option>
            <option ${cfg.tz==='America/Lima'?'selected':''}>America/Lima</option>
            <option ${cfg.tz==='America/Mexico_City'?'selected':''}>America/Mexico_City</option>
            <option ${cfg.tz==='Europe/Madrid'?'selected':''}>Europe/Madrid</option>
            <option ${cfg.tz==='UTC'?'selected':''}>UTC</option>
          </select>
        </div>
        <div class="mb-4"><label style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Idioma por defecto</label>
          <select id="sys-lang" class="form-select" style="background:var(--bg-input);border:1px solid var(--border-subtle);color:var(--text-primary)">
            <option value="es" ${cfg.lang==='es'?'selected':''}>Español</option>
            <option value="en" ${cfg.lang==='en'?'selected':''}>English</option>
          </select>
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveSysConfig()">Guardar</button>
      </div>
    </div>
    <div class="panel fade-in">
      <div class="panel-header"><div class="panel-title">Backup & Restore</div></div>
      <div class="panel-body">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Exporta o importa toda la configuración del sistema en formato JSON.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" style="border:1px solid var(--border-default);color:var(--text-secondary);background:transparent" onclick="exportConfig()">📥 Exportar Config</button>
          <label class="btn btn-sm" style="border:1px solid var(--border-default);color:var(--text-secondary);background:transparent;cursor:pointer;margin:0">📤 Importar Config<input type="file" accept=".json" style="display:none" onchange="importConfig(event)"></label>
        </div>
        <hr style="border-color:var(--border-subtle);margin:16px 0">
        <p style="font-size:12px;color:var(--text-disabled)">Versión del sistema: <span style="color:var(--accent-cyan);font-family:'JetBrains Mono',monospace">NexSCADA v5.0.0</span></p>
      </div>
    </div>
  </div>`;
}

window.saveSysConfig = function() {
  const cfg = _loadConfig();
  cfg.plant_name = document.getElementById('sys-plant').value;
  cfg.tz         = document.getElementById('sys-tz').value;
  cfg.lang       = document.getElementById('sys-lang').value;
  _saveConfig(cfg);
  const titleEl = document.getElementById('plant-name-topbar');
  if (titleEl) titleEl.textContent = cfg.plant_name;
  window.showNotif('Configuración del sistema guardada', 'success');
};

window.exportConfig = function() {
  const data = { users: _loadUsers(), config: _loadConfig(), variables: JSON.parse(localStorage.getItem('scada-variables') || '[]') };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'nexscada_config.json'; a.click();
  URL.revokeObjectURL(url);
  window.showNotif('Configuración exportada correctamente', 'success');
};

window.importConfig = function(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.users)     _saveUsers(data.users);
      if (data.config)    _saveConfig(data.config);
      if (data.variables) localStorage.setItem('scada-variables', JSON.stringify(data.variables));
      window.showNotif('Configuración importada correctamente. Recargando...', 'success');
      setTimeout(() => location.reload(), 1500);
    } catch { window.showNotif('Archivo JSON inválido', 'danger'); }
  };
  reader.readAsText(file);
};

// ─── INIT ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Registra el usuario logueado en la lista si existe
  const currentUser = localStorage.getItem('scada_user') || 'admin';
  const users = _loadUsers();
  const u = users.find(x => x.username === currentUser);
  if (u) { u.lastLogin = new Date().toISOString(); _saveUsers(users); }

  // El primer sub-task activo por defecto es 'profile'
  setTimeout(() => {
    const firstActive = document.querySelector('#tab-config .config-nav-item.active');
    if (firstActive) firstActive.click();
    else renderProfileTab();
  }, 200);
});
