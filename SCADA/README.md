# NexSCADA — Industrial Control System v5.0

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-5.0.0-green.svg)
![Tech](https://img.shields.io/badge/stack-Full%20Stack-orange.svg)

**NexSCADA** es un sistema de control y adquisición de datos (SCADA) de última generación diseñado para la supervisión industrial avanzada. Combina la robustez de los protocolos industriales tradicionales con la potencia de la web moderna, visualización 3D y mantenimiento predictivo impulsado por IA.

---

## 🚀 Características Principales

### 🖥️ Dashboard Dinámico & Builder
- Panel de control totalmente personalizable con **Dashboard Builder**.
- Widgets interactivos: Tendencias multivariable, Diagramas de Sankey, Mapas de calor y Radares de salud.
- Datos en tiempo real integrados con **Chart.js**.

### 🏗️ Visualización 3D Interactiva
- Modelado de planta en tiempo real utilizando **Three.js**.
- Navegación interactiva (Orbit Controls) y modos de vista (Wireframe, Top, Front).
- Sincronización de estados físicos con gemelos digitales.

### 🧠 Inteligencia Artificial & Mantenimiento Predictivo
- **Detección de Anomalías**: Identificación temprana de desviaciones en variables críticas.
- **Predicción de Fallos**: Algoritmos que calculan la probabilidad de fallo en activos (bombas, compresores) basado en vibración y temperatura.
- **Asistente IA**: Chatbot especializado en consultas de proceso conectado a modelos de lenguaje avanzados.

### 🔌 Conectividad Industrial
- Soporte para protocolos estándar: **Modbus TCP**, **OPC-UA**, **MQTT**.
- Gestión de alarmas con niveles de prioridad (Crítica, Alta, Media).

### 🌍 Arquitectura & i18n
- Soporte multi-idioma nativo: 🇪🇸 Español, 🇺🇸 Inglés, 🇩🇪 Alemán.
- Interfaz moderna con temas Claro/Oscuro y tipografía optimizada (Inter, JetBrains Mono).

---

## 🛠️ Stack Tecnológico

- **Frontend**: HTML5, CSS3 (Custom Variables), Bootstrap 5.
- **Visualización**: Three.js (3D), Chart.js (2D), Feather Icons.
- **Logic & Build**: JavaScript (ES6+), Webpack 5, Babel.
- **Backend (Predictive)**: Node.js & Python (AI scripts).
- **Protocolos**: MQTT, Modbus, OPC-UA.

---

## 📸 Demo & Screenshots

> [!TIP]
> **[INSERTA AQUÍ UN GIF DE TU DASHBOARD EN FUNCIONAMIENTO]**
> *Recomendación: Muestra el cambio de pestañas y la interactividad del modelo 3D.*

---

## 🛠️ Instalación y Desarrollo

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/tu-usuario/NexSCADA.git
   cd NexSCADA/SCADA
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Ejecutar en modo desarrollo**:
   ```bash
   npm start
   ```
   La aplicación estará disponible en `http://localhost:8080`.

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Consulta el archivo `LICENSE` para más detalles.

---
**Desarrollado con ❤️ para la excelencia industrial.**
