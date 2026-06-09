class VariableManager {
    constructor() {
        this.variables = JSON.parse(localStorage.getItem('scada-variables')) || [
            { id: 'Var20', tag: 'pH Salida Planta', desc: 'pH de la salida de la planta de tratamiento', unit: 'pH', dbIdDisp: '95', dbTable: 'variable2', dbVar: 'var2', dbVar20: '1', toGraph: true },
            { id: 'Var21', tag: 'Turbiedad Salida', desc: 'Turbiedad del agua a la salida', unit: 'NTU', dbIdDisp: '95', dbTable: 'variable2', dbVar: 'var9', dbVar20: '2', toGraph: true },
            { id: 'Var22', tag: 'Cloro Residual', desc: 'Concentración de cloro a la salida', unit: 'mg/L', dbIdDisp: '95', dbTable: 'variable2', dbVar: 'var17', dbVar20: '2', toGraph: true }
        ];
        this.renderTable();
    }

    save() {
        localStorage.setItem('scada-variables', JSON.stringify(this.variables));
        this.renderTable();
        // Sincronizar con el resto del sistema si es necesario
        // Sincronizar con el resto del sistema
        if (typeof updateWidgetSelectors === 'function') updateWidgetSelectors();
        if (typeof updateHistoricalSelectors === 'function') updateHistoricalSelectors();
        if (typeof updateTrendChart === 'function') updateTrendChart();
    }

    add(v) {
        this.variables.push(v);
        this.save();
    }

    update(id, updated) {
        const idx = this.variables.findIndex(v => v.id === id);
        if (idx !== -1) {
            this.variables[idx] = { ...this.variables[idx], ...updated };
            this.save();
        }
    }

    delete(id) {
        this.variables = this.variables.filter(v => v.id !== id);
        this.save();
    }

    renderTable() {
        const body = document.getElementById('varManagerBody');
        if (!body) return;
        body.innerHTML = '';
        this.variables.forEach(v => {
            // Unificamos Origen Datos para incluir ID, Tabla, Columna y VAR20
            const originStr = `ID:${v.dbIdDisp || '95'} -> ${v.dbTable}.${v.dbVar} (@${v.dbVar20 || '1'})`;
            body.innerHTML += `
                <tr>
                    <td class="font-mono">${v.id}</td>
                    <td class="fw-bold">${v.tag}</td>
                    <td class="text-muted small">${v.desc}</td>
                    <td><span class="primary-soft-badge">${v.unit}</span></td>
                    <td class="font-mono text-muted small" style="font-size:11px">${originStr}</td>
                    <td>${v.toGraph ? '<span class="badge bg-success" style="font-size:10px">GRAFICADA</span>' : '<span class="badge bg-secondary" style="font-size:10px">OCULTA</span>'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="openVarEditor('${v.id}')"><i data-feather="edit-2" class="feather-xs"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="variableManager.delete('${v.id}')"><i data-feather="trash-2" class="feather-xs"></i></button>
                    </td>
                </tr>`;
        });
        if (typeof feather !== 'undefined') feather.replace();
    }
}

window.openVarEditor = function(id) {
    const v = id ? window.variableManager.variables.find(x => x.id === id) : null;
    const modal = document.getElementById('varEditorModal');
    if (!modal) return;
    
    const nextId = 'Var' + (window.variableManager.variables.length + 1);
    document.getElementById('varEditorId').value = v ? v.id : nextId;
    document.getElementById('editVarTag').value = v ? v.tag : '';
    document.getElementById('editVarDesc').value = v ? v.desc : '';
    document.getElementById('editVarUnit').value = v ? v.unit : '';
    document.getElementById('editVarIdDisp').value = v ? (v.dbIdDisp || '95') : '95';
    document.getElementById('editVarTable').value = v ? v.dbTable : '';
    document.getElementById('editVarColumn').value = v ? v.dbVar : '';
    document.getElementById('editVarVar20').value = v ? (v.dbVar20 || '') : '';
    document.getElementById('editVarToGraph').checked = v ? v.toGraph : true;
    
    document.getElementById('varEditorTitle').innerText = v ? 'Editar Variable' : 'Añadir Nueva Variable';
    // Desactivamos el ID si es edición para no romper referencias (opcional)
    // document.getElementById('varEditorId').readOnly = !!v; 
    
    modal.style.display = 'flex';
};

window.saveVarEditor = function() {
    const targetId = document.getElementById('varEditorId').value;
    const isNew = !window.variableManager.variables.some(v => v.id === targetId);

    const data = {
        id: targetId,
        tag: document.getElementById('editVarTag').value,
        desc: document.getElementById('editVarDesc').value,
        unit: document.getElementById('editVarUnit').value,
        dbIdDisp: document.getElementById('editVarIdDisp').value,
        dbTable: document.getElementById('editVarTable').value,
        dbVar: document.getElementById('editVarColumn').value,
        dbVar20: document.getElementById('editVarVar20').value,
        toGraph: document.getElementById('editVarToGraph').checked
    };

    if (isNew) {
        window.variableManager.add(data);
        showNotif('Variable añadida correctamente', 'success');
    } else {
        window.variableManager.update(targetId, data);
        showNotif('Variable actualizada correctamente', 'success');
    }
    document.getElementById('varEditorModal').style.display = 'none';
};
