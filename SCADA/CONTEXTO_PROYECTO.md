# CONTEXTO DEL PROYECTO — NexSCADA

Soy el desarrollador de **NexSCADA**, un sistema SCADA industrial corriendo con `webpack-dev-server` en `localhost:8080`.

---

## STACK

- **Servidor:** Node.js + webpack-dev-server
- **Frontend:** HTML5 + Bootstrap 5 + Feather Icons + Chart.js + Three.js
- **Estilos:** CSS custom (no SASS) — cargados directo en HTML
- **Build:** Webpack compila solo `js/app.js` → `/js/app.js` en memoria
- **Idiomas:** ES / EN / DE via `setLang()` en app.js

---

## ESTRUCTURA

```
SCADA/
├── index.html              ← HTML principal. NO mover scripts ni CSS
├── css/
│   ├── style.css           ← variables globales, layout, componentes
│   └── scada-core.css      ← estilos específicos del SCADA
├── js/
│   ├── app.js              ← entry point webpack. Funciones globales + i18n
│   ├── scada-core.js       ← datos, charts, 3D, simulación, populate*
│   ├── variable-manager.js ← clase VariableManager, openVarEditor, saveVarEditor
│   └── file-manager.js     ← refreshFiles, uploadFile, deleteFile
└── webpack.config.js
```

---

## REGLA DE ORO

Cada archivo tiene su responsabilidad. **Nunca mover funciones entre archivos sin pedírmelo explícitamente.**

| Archivo | Contiene | NO tocar |
|---|---|---|
| `scada-core.js` | updateClock, simulate, initCharts, initGauges, drawPID, sendAI, populate*, toggle3D*, filterAlarms, setRange | ✋ Solo leer |
| `variable-manager.js` | VariableManager class, openVarEditor, saveVarEditor | ✋ Solo leer |
| `file-manager.js` | refreshFiles, uploadFile, deleteFile | ✋ Solo leer |
| `app.js` | showNotif, initApp, doLogin, doLogout, showTab, setLang, toggleTheme, toggleCustomizer, toggleSidebar, setConfigSubTab, doSearch | ✏️ Editable |
| `index.html` | Estructura HTML completa | ✏️ Editable con cuidado |
| `css/style.css` | Variables CSS, layout | ✏️ Editable |
| `css/scada-core.css` | Componentes SCADA | ✏️ Editable |

---

## CÓMO RESPONDERME

Cuando te pida un cambio:

1. **Dime qué archivo tocas** antes de mostrar código
2. **Muestra solo el bloque modificado** con contexto de 2 líneas arriba y abajo — no el archivo completo salvo que lo pida
3. **Si el cambio rompe algo**, avísame antes de aplicarlo
4. **Si necesitas ver un archivo** para responder bien, pídemelo

---

## ESTADO ACTUAL

- ✅ webpack-dev-server corriendo en :8080
- ✅ CSS cargando correctamente
- ✅ Login funcional (admin / admin123)
- ✅ Navegación entre tabs funcional
- ✅ Charts, 3D, P&ID operativos
- ✅ File Manager operativo
- ✅ Variable Manager operativo
- ✅ i18n ES/EN/DE funcional
- ✅ toggleTheme funcional

---

## LO QUE VIENE — BACKLOG

Estas son las mejoras pendientes. Cuando te diga **"siguiente"** o el número, trabajamos esa:

1. Dashboard con widgets reales (Chart.js) en lugar del catálogo de tarjetas actual
2. Sidebar colapsable con animación suave (mini-mode con solo íconos)
3. Página de Alarmas con tabla filtrable y reconocimiento de alarmas
4. Históricos con selector de rango de fechas y exportar a CSV/Excel
5. Vista 3D con modelo GLB real desde `models/`
6. Configuración — sub-tabs completos (Tags, Variables, Conexiones, Usuarios)
7. Notificaciones — panel lateral con historial
8. Calendario de mantenimiento
9. IA & Predicción — chatbot funcional conectado al backend Python
10. Modo responsive/móvil completo

---

## CUANDO ME DES CÓDIGO

- Usa el mismo estilo del proyecto: **CSS variables** (`var(--primary)`), clases Bootstrap solo donde ya se usan
- Fuentes del proyecto: `Inter`, `JetBrains Mono`, `Rajdhani`
- Tema oscuro por defecto — `data-theme="dark"` en `<html>`
- Colores principales: `--primary: #638bff`, `--success: #34d399`, `--danger: #f87171`, `--warning: #fbbf24`
- Sin frameworks nuevos salvo que yo los pida explícitamente
