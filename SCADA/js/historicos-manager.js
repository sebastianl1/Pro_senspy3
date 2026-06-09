/**
 * NexSCADA — historicos-manager.js
 * Gestión avanzada de 3 gráficos históricos con estilo Dashboard
 */

const HistManager = {
    widgets: {},
    STORAGE_KEY: 'scada_historics_v2',
    
    // Configuración por defecto para los 3 contenedores
    defaults: {
        main:    { id: 'main',    type: 'trend',   title: 'Tendencias Planta', varId: 'ph_ent', varId2: 'ph_sal', multiVar: true,  points: 100 },
        scatter: { id: 'scatter', type: 'scatter', title: 'Correlación pH/Turb', varId: 'ph_ent', varId2: 'turb_ent', points: 60 },
        dist:    { id: 'dist',    type: 'bar',     title: 'Calidad Salida', varId: 'turb_sal', points: 24 }
    },

    init: function() {
        console.log('HistoricosManager (Advanced) initialized');
        this.load();
        this.renderAll();
        this.ensureModal();
    },

    load: function() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try { this.widgets = JSON.parse(saved); } catch (e) { this.widgets = {...this.defaults}; }
        } else {
            this.widgets = {...this.defaults};
        }
    },

    save: function() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.widgets));
    },

    renderAll: function() {
        this.renderWidget('hm_container_main',    this.widgets.main);
        this.renderWidget('hm_container_scatter', this.widgets.scatter);
        this.renderWidget('hm_container_dist',    this.widgets.dist);
    },

    renderWidget: function(containerId, cfg) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        const wid = cfg.id;
        const panel = document.createElement('div');
        panel.className = 'panel fade-in';
        panel.style.position = 'relative';

        // Header
        const header = document.createElement('div');
        header.className = 'panel-header';
        header.innerHTML = `
            <div class="panel-title">${cfg.title}</div>
            <div class="panel-spacer"></div>
        `;

        const menuBtn = document.createElement('button');
        menuBtn.style.cssText = 'background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;display:flex;align-items:center;border-radius:6px;transition:background 0.15s';
        menuBtn.innerHTML = '<i data-feather="more-horizontal" style="width:16px;height:16px"></i>';
        
        const menu = this.buildMenu(wid);
        header.appendChild(menuBtn);
        header.appendChild(menu);
        panel.appendChild(header);

        menuBtn.onclick = (e) => {
            e.stopPropagation();
            const wasOpen = menu.style.display === 'block';
            document.querySelectorAll('.hm-ctx-menu').forEach(m => m.style.display = 'none');
            menu.style.display = wasOpen ? 'none' : 'block';
        };
        document.addEventListener('click', () => menu.style.display = 'none');

        // Body
        const body = document.createElement('div');
        body.className = 'panel-body';
        body.style.padding = '12px';
        
        const canvasWrap = document.createElement('div');
        canvasWrap.style.height = wid === 'main' ? '320px' : '240px';
        canvasWrap.style.position = 'relative';
        
        const canvas = document.createElement('canvas');
        canvas.id = 'canvas_hm_' + wid;
        canvasWrap.appendChild(canvas);
        body.appendChild(canvasWrap);
        panel.appendChild(body);
        container.appendChild(panel);

        setTimeout(async () => {
            this.widgets[wid].chart = await this.buildChart(canvas, cfg);
            if (window.feather) feather.replace();
        }, 50);
    },

    buildMenu: function(wid) {
        const menu = document.createElement('div');
        menu.className = 'hm-ctx-menu';
        menu.style.cssText = 'position:absolute;right:10px;top:35px;z-index:100;background:var(--bg-card2,#1c2333);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.5);padding:5px;min-width:180px;display:none';

        const itemStyle = 'display:flex;align-items:center;gap:10px;width:100%;padding:8px 12px;font-size:13px;background:none;border:none;color:var(--text-secondary);cursor:pointer;border-radius:6px;text-align:left';
        
        const addItem = (icon, label, callback) => {
            const btn = document.createElement('button');
            btn.style.cssText = itemStyle;
            btn.innerHTML = `<i data-feather="${icon}" style="width:14px;height:14px"></i> ${label}`;
            btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.05)';
            btn.onmouseout = () => btn.style.background = 'none';
            btn.onclick = () => { menu.style.display = 'none'; callback(); };
            menu.appendChild(btn);
        };

        addItem('sliders', 'Editar configuración', () => this.openModal(wid));
        addItem('refresh-cw', 'Actualizar', () => this.refreshWidget(wid));
        addItem('image', 'Exportar Imagen', () => this.exportImage(wid));

        return menu;
    },

    refreshWidget: async function(wid) {
        const cfg = this.widgets[wid];
        const canvas = document.getElementById('canvas_hm_' + wid);
        if (cfg.chart) cfg.chart.destroy();
        cfg.chart = await this.buildChart(canvas, cfg);
        if (window.showNotif) showNotif('Gráfico actualizado', 'info');
    },

    exportImage: function(wid) {
        const chart = this.widgets[wid].chart;
        if (!chart) return;
        const link = document.createElement('a');
        link.href = chart.toBase64Image();
        link.download = `Historico_${wid}_${Date.now()}.png`;
        link.click();
    },

    buildChart: async function(canvas, cfg) {
        // Usamos la lógica de dashboard-manager.js si está disponible
        if (window._buildChart) {
            return await window._buildChart(canvas, cfg.type, cfg);
        }
        
        // Fallback vacío si _buildChart no es accesible
        return new Chart(canvas, {
            type: cfg.type === 'trend' ? 'line' : (cfg.type === 'scatter' ? 'scatter' : 'bar'),
            data: { labels: [], datasets: [] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    },

    openModal: function(wid) {
        const cfg = this.widgets[wid];
        this.currentWid = wid;
        
        document.getElementById('hm_title').value = cfg.title;
        document.getElementById('hm_type').value = cfg.type;
        document.getElementById('hm_var1').value = cfg.varId || 'temp';
        document.getElementById('hm_var2').value = cfg.varId2 || '';
        document.getElementById('hm_points').value = cfg.points || 60;
        
        document.getElementById('hmEditModal').style.display = 'flex';
        if (window.feather) feather.replace();
    },

    saveModal: function() {
        const wid = this.currentWid;
        const cfg = this.widgets[wid];
        
        cfg.title = document.getElementById('hm_title').value;
        cfg.type = document.getElementById('hm_type').value;
        cfg.varId = document.getElementById('hm_var1').value;
        cfg.varId2 = document.getElementById('hm_var2').value;
        cfg.points = parseInt(document.getElementById('hm_points').value);
        
        this.save();
        this.renderWidget('hm_container_' + (wid === 'main' ? 'main' : (wid === 'scatter' ? 'scatter' : 'dist')), cfg);
        document.getElementById('hmEditModal').style.display = 'none';
        if (window.showNotif) showNotif('Configuración guardada', 'success');
    },

    ensureModal: function() {
        if (document.getElementById('hmEditModal')) {
            // Actualizar lista de variables
            const vars = (window.variableManager && window.variableManager.variables) || [];
            const vOpts = vars.map(v => `<option value="${v.id}">${v.tag} (${v.unit})</option>`).join('');
            const vOptsEmpty = `<option value="">-- ninguno --</option>` + vOpts;
            const sel1 = document.getElementById('hm_var1');
            const sel2 = document.getElementById('hm_var2');
            if(sel1) sel1.innerHTML = vOpts;
            if(sel2) sel2.innerHTML = vOptsEmpty;
            return;
        }

        const vars = (window.variableManager && window.variableManager.variables) || [];
        const vOpts = vars.map(v => `<option value="${v.id}">${v.tag} (${v.unit})</option>`).join('');
        const vOptsEmpty = `<option value="">-- ninguno --</option>` + vOpts;

        const modal = document.createElement('div');
        modal.id = 'hmEditModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);display:none;align-items:center;justify-content:center;z-index:10000;backdrop-filter:blur(8px)';
        
        const S = 'background:#161b27;border:1px solid var(--border);border-radius:8px;padding:10px;width:100%;color:white;margin-bottom:15px;outline:none';
        const L = 'font-size:11px;color:var(--text-muted);margin-bottom:5px;display:block;font-weight:600';

        modal.innerHTML = `
            <div style="background:var(--bg-card2,#1c2333);border:1px solid var(--border);border-radius:20px;width:100%;max-width:500px;padding:25px;box-shadow:0 20px 60px rgba(0,0,0,0.6)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                    <h5 style="margin:0;font-weight:700;color:white;display:flex;align-items:center;gap:10px">
                        <i data-feather="sliders" style="color:var(--primary)"></i> Configurar Gráfico Histórico
                    </h5>
                    <button onclick="document.getElementById('hmEditModal').style.display='none'" style="background:none;border:none;color:var(--text-muted);font-size:24px;cursor:pointer">&times;</button>
                </div>
                
                <label style="${L}">TÍTULO DEL GRÁFICO</label>
                <input id="hm_title" style="${S}">

                <label style="${L}">TIPO DE VISUALIZACIÓN</label>
                <select id="hm_type" style="${S}">
                    <option value="trend">Tendencia Temporal</option>
                    <option value="scatter">Correlación (X/Y)</option>
                    <option value="bar">Distribución de Barras</option>
                    <option value="doughnut">Anillo de Proporción</option>
                </select>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px">
                    <div>
                        <label style="${L}">VARIABLE PRINCIPAL</label>
                        <select id="hm_var1" style="${S}">${vOpts}</select>
                    </div>
                    <div>
                        <label style="${L}">VARIABLE SECUNDARIA</label>
                        <select id="hm_var2" style="${S}">${vOptsEmpty}</select>
                    </div>
                </div>

                <label style="${L}">PUNTOS DE DATOS</label>
                <input id="hm_points" type="number" style="${S}" value="60">

                <div style="display:flex;gap:10px;margin-top:10px">
                    <button onclick="document.getElementById('hmEditModal').style.display='none'" class="btn-secondary" style="flex:1;padding:12px;border-radius:10px">Cancelar</button>
                    <button onclick="HistManager.saveModal()" class="btn-primary" style="flex:1;padding:12px;border-radius:10px">Aplicar Cambios</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (window.feather) feather.replace();
    }
};

window.updateHistoricalSelectors = function() {
    HistManager.ensureModal();
};

// Reiniciar scada-core si es necesario o esperar
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => HistManager.init(), 600);
});
