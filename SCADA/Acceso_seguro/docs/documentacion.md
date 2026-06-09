# Manual de Usuario — NexSCADA Industrial v5.0

Bienvenido al sistema de supervisión y control **NexSCADA**. Este manual ha sido diseñado para guiarle a través de todas las funcionalidades de la plataforma, desde la monitorización básica hasta el análisis avanzado de datos y modelos tridimensionales.

---

## 1. Introducción al Ecosistema Zenith UI
La interfaz de NexSCADA utiliza el lenguaje de diseño **Zenith**, optimizado para entornos industriales de alta concentración. 
- **Barra Lateral (Sidebar):** Permite navegar entre las diferentes áreas del sistema (Dashboard, Alarmas, Históricos, 3D, Archivos, etc.).
- **Barra Superior (Topbar):** Muestra el estado de las conexiones (MODBUS, OPC-UA, MQTT) y permite personalizar el tema visual (Claro/Oscuro/Colores) mediante el botón de ajustes en la esquina derecha.

---

## 2. Dashboard Principal (Tablero de Control)
El Dashboard es su centro de mando. Puede personalizarlo totalmente para visualizar las variables críticas de su planta.
- **Agregar Widgets:** Presione el botón **+ ADD WIDGET** para abrir el catálogo.
- **Tipos de Gráficos:** Puede elegir entre 12 tipos de visualizaciones modernas:
  - *Tendencias:* Para ver el comportamiento de temperaturas y presiones en el tiempo.
  - *Gauges (Medidores):* Ideales para ver niveles de tanques o voltajes.
  - *Mapas de Calor:* Para detectar zonas críticas de operación.
  - *Velas Japonesas:* Para análisis estocástico de procesos.
- **Personalización:** Cada widget tiene un menú de tres puntos (`...`) que le permite cambiar su tamaño (desde 1x1 hasta ancho completo) o eliminarlo si ya no es necesario.

---

## 3. Vista 3D — Gemelo Digital
Esta sección permite visualizar sus activos industriales en un entorno tridimensional limpio y profesional.
- **Cargar Modelo:** Utilice el botón **Cargar Modelo GLB** para seleccionar un archivo de su servidor. El sistema limpiará automáticamente la escena para que solo vea su activo.
- **Interacción:** Use el ratón para rotar (clic izquierdo), hacer zoom (rueda) y desplazar la cámara (clic derecho).
- **Herramientas:** Cuenta con botones para ver el modelo en modo "Wireframe" (esqueleto) o realizar una vista de "Explosión" para inspeccionar componentes internos.

---

## 4. Proceso P&ID (Diagramas de Flujo)
Visualice sus esquemas de tuberías e instrumentación en formato vectorial de alta fidelidad.
- **Visualización:** El sistema soporta archivos `.svg`. Al cargar uno, podrá hacer zoom y desplazarse por el plano sin perder definición.
- **Datos en Vivo:** Los valores mostrados junto al diagrama se actualizan en tiempo real según los sensores de campo.

---

## 5. Gestor de Archivos (Acceso Seguro)
Un administrador central de documentos para su planta, limitado estrictamente a la carpeta **Acceso_seguro**.
- **Seguridad:** Solo los usuarios con rol de **Administrador** pueden subir nuevos archivos (planos, manuales PDF, modelos 3D) o eliminar contenido.
- **Descargas:** Todos los usuarios pueden navegar y descargar la documentación técnica necesaria para sus labores.
- **Navegación:** La interfaz es intuitiva y le permite organizar la información por carpetas (`docs`, `models`, `pid`, `reports`).

---

## 6. Alarmas y Notificaciones
El sistema monitoriza constantemente las variables de proceso.
- **Alarmas:** Se activan automáticamente cuando una variable sale de su rango normal. Se muestran en una tabla con prioridad de colores (Rojo: Crítico, Ámbar: Advertencia).
- **Historial:** Todas las alarmas quedan registradas en el log del sistema para auditorías de seguridad posteriores.

---

## 7. Configuración del Sistema
Desde este panel, el personal autorizado puede:
- Administrar usuarios y roles.
- Configurar las direcciones IP de los PLCs y protocolos de comunicación.
- Cambiar el idioma de la aplicación.
- Realizar copias de seguridad de la configuración global.
