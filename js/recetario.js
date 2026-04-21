// recetario.js — Módulo 2: Recetario completo

// ─── Estado ──────────────────────────────────────────────
let recetaEnEdicion = null; // null = nueva receta, objeto = editar
let ingredientesFilas = []; // [{id, nombre, cantidad, unidad, esNuevo}]
let procesosFilas = [];     // [{id, equipo_id, minutos}]
let _filaCounter = 0;

function _newFilaId() { return ++_filaCounter; }

// ─── Onboarding ──────────────────────────────────────────
async function verificarOnboarding() {
  const reg = await db.configuracion_global.get('onboarding_completo');
  if (!reg || reg.valor !== 'true') {
    mostrarOnboarding();
  }
}

function mostrarOnboarding() {
  document.getElementById('onboarding-overlay').classList.add('visible');
}

async function cerrarOnboarding(irAConfig = false) {
  await db.configuracion_global.put({ clave: 'onboarding_completo', valor: 'true' });
  document.getElementById('onboarding-overlay').classList.remove('visible');
  if (irAConfig) {
    navegarA('sec-configuracion');
  } else {
    navegarA('sec-recetario');
  }
}

// ─── Lista de recetas ─────────────────────────────────────
async function renderRecetario() {
  const lista = document.getElementById('recetas-lista');
  const empty = document.getElementById('recetas-empty');
  const recetas = await db.recetas.orderBy('fecha_creacion').reverse().toArray();

  if (recetas.length === 0) {
    lista.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  lista.innerHTML = recetas.map(r => {
    const fecha = new Date(r.fecha_modificacion || r.fecha_creacion);
    const fechaStr = fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    return `
      <div class="receta-item" data-id="${r.id}">
        <div class="receta-item-body" onclick="abrirDetalleReceta(${r.id})">
          <div class="receta-nombre">${escapeHTML(r.nombre)}</div>
          <div class="receta-meta">
            <span class="receta-categoria">${escapeHTML(r.categoria || 'Sin categoría')}</span>
            <span class="receta-fecha">${fechaStr}</span>
          </div>
        </div>
        <button class="btn-icon btn-delete" onclick="confirmarEliminarReceta(event, ${r.id}, '${escapeHTML(r.nombre).replace(/'/g, "\\'")}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>`;
  }).join('');
}

async function confirmarEliminarReceta(e, id, nombre) {
  e.stopPropagation();
  if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
  await db.ingredientes_receta.where('receta_id').equals(id).delete();
  await db.procesos_receta.where('receta_id').equals(id).delete();
  await db.recetas.delete(id);
  await renderRecetario();
  mostrarToast('Receta eliminada');
}

// ─── Vista de detalle ─────────────────────────────────────
async function abrirDetalleReceta(id) {
  const receta = await db.recetas.get(id);
  if (!receta) return;

  const ingredientes = await db.ingredientes_receta.where('receta_id').equals(id).toArray();
  const procesos = await db.procesos_receta.where('receta_id').equals(id).toArray();

  // Enriquecer ingredientes con nombre del catálogo
  for (const ing of ingredientes) {
    const cat = await db.ingredientes_catalogo.get(ing.ingrediente_catalogo_id);
    ing.nombre_ingrediente = cat ? cat.nombre : '(desconocido)';
  }

  // Enriquecer procesos con nombre del equipo
  for (const proc of procesos) {
    const eq = await db.equipos.get(proc.equipo_id);
    proc.nombre_equipo = eq ? eq.nombre : '(desconocido)';
  }

  const fechaCreacion = new Date(receta.fecha_creacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  const fechaMod = receta.fecha_modificacion
    ? new Date(receta.fecha_modificacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    : fechaCreacion;

  const panel = document.getElementById('detalle-panel');
  document.getElementById('detalle-nombre').textContent = receta.nombre;

  document.getElementById('detalle-body').innerHTML = `
    <div class="detalle-meta-row">
      <span class="detalle-badge">${escapeHTML(receta.categoria || 'Sin categoría')}</span>
      <span class="detalle-porciones">${receta.porciones_base} porción${receta.porciones_base !== 1 ? 'es' : ''}</span>
    </div>
    ${receta.notas ? `<div class="detalle-notas">${escapeHTML(receta.notas)}</div>` : ''}

    <div class="detalle-section-title">Ingredientes</div>
    ${ingredientes.length === 0
      ? '<p class="detalle-empty">Sin ingredientes registrados.</p>'
      : `<div class="detalle-tabla">
          ${ingredientes.map(i => `
            <div class="detalle-fila">
              <span class="detalle-fila-nombre">${escapeHTML(i.nombre_ingrediente)}</span>
              <span class="detalle-fila-valor">${i.cantidad} ${escapeHTML(i.unidad)}</span>
            </div>`).join('')}
        </div>`}

    <div class="detalle-section-title">Procesos de cocción</div>
    ${procesos.length === 0
      ? '<p class="detalle-empty">Sin procesos registrados.</p>'
      : `<div class="detalle-tabla">
          ${procesos.map(p => `
            <div class="detalle-fila">
              <span class="detalle-fila-nombre">${escapeHTML(p.nombre_equipo)}</span>
              <span class="detalle-fila-valor">${p.minutos} min</span>
            </div>`).join('')}
        </div>`}

    <div class="detalle-fechas">
      <span>Creada: ${fechaCreacion}</span>
      <span>Modificada: ${fechaMod}</span>
    </div>
  `;

  document.getElementById('detalle-btn-editar').onclick = () => {
    cerrarDetalle();
    abrirFormularioReceta(receta.id);
  };
  document.getElementById('detalle-btn-eliminar').onclick = () => {
    cerrarDetalle();
    confirmarEliminarReceta({ stopPropagation: () => {} }, receta.id, receta.nombre);
  };

  panel.classList.add('visible');
}

function cerrarDetalle() {
  document.getElementById('detalle-panel').classList.remove('visible');
}

// ─── Formulario de receta ─────────────────────────────────
async function abrirFormularioReceta(id = null) {
  recetaEnEdicion = null;
  ingredientesFilas = [];
  procesosFilas = [];
  _filaCounter = 0;

  const equipos = await db.equipos.toArray();

  if (id !== null) {
    recetaEnEdicion = await db.recetas.get(id);
    if (!recetaEnEdicion) return;

    // Verificar si tiene historial
    const historial = await db.resultados_presupuesto.where('receta_id').equals(id).count();
    if (historial > 0) {
      document.getElementById('form-historial-aviso').style.display = 'block';
    } else {
      document.getElementById('form-historial-aviso').style.display = 'none';
    }

    // Cargar ingredientes existentes
    const ings = await db.ingredientes_receta.where('receta_id').equals(id).toArray();
    for (const ing of ings) {
      const cat = await db.ingredientes_catalogo.get(ing.ingrediente_catalogo_id);
      ingredientesFilas.push({
        filaId: _newFilaId(),
        ingrediente_catalogo_id: ing.ingrediente_catalogo_id,
        nombre: cat ? cat.nombre : '',
        cantidad: ing.cantidad,
        unidad: ing.unidad,
        esNuevo: false,
        confirmado: true
      });
    }

    // Cargar procesos existentes
    const procs = await db.procesos_receta.where('receta_id').equals(id).toArray();
    for (const proc of procs) {
      procesosFilas.push({
        filaId: _newFilaId(),
        equipo_id: proc.equipo_id,
        minutos: proc.minutos
      });
    }
  } else {
    document.getElementById('form-historial-aviso').style.display = 'none';
  }

  // Título
  document.getElementById('form-titulo').textContent = id ? 'Editar receta' : 'Nueva receta';

  // Campos básicos
  document.getElementById('rf-nombre').value = recetaEnEdicion ? recetaEnEdicion.nombre : '';
  document.getElementById('rf-categoria').value = recetaEnEdicion ? recetaEnEdicion.categoria : 'Postre';
  document.getElementById('rf-porciones').value = recetaEnEdicion ? recetaEnEdicion.porciones_base : '';
  document.getElementById('rf-notas').value = recetaEnEdicion ? (recetaEnEdicion.notas || '') : '';

  // Renderizar listas
  renderIngredientesFilas(equipos);
  renderProcesosFilas(equipos);

  document.getElementById('receta-form-panel').classList.add('visible');
  document.getElementById('rf-nombre').focus();
}

function cerrarFormulario() {
  document.getElementById('receta-form-panel').classList.remove('visible');
  // Limpiar estado pendiente de autocomplete
  _cerrarDropdown();
}

// ─── Filas de ingredientes ────────────────────────────────
function renderIngredientesFilas() {
  const contenedor = document.getElementById('ingredientes-filas');
  contenedor.innerHTML = ingredientesFilas.map(f => buildFilaIngrediente(f)).join('');
}

function buildFilaIngrediente(f) {
  const avisoHtml = (f.pendienteConfirmacion)
    ? `<div class="ing-aviso" id="aviso-${f.filaId}">
        <span>"${escapeHTML(f.nombre)}" es nuevo. ¿Agregarlo al catálogo?</span>
        <div class="aviso-btns">
          <button class="btn-aviso-si" onclick="confirmarNuevoIngrediente(${f.filaId})">Sí</button>
          <button class="btn-aviso-no" onclick="corregirIngrediente(${f.filaId})">Corregir</button>
        </div>
      </div>`
    : '';

  return `
    <div class="ing-fila" id="fila-ing-${f.filaId}">
      <div class="ing-fila-inputs">
        <div class="ing-campo-nombre" style="position:relative;">
          <input
            type="text"
            class="ing-nombre-input"
            id="ing-nombre-${f.filaId}"
            value="${escapeHTML(f.nombre)}"
            placeholder="Ingrediente"
            autocomplete="off"
            oninput="handleIngNombreInput(${f.filaId}, this.value)"
            onblur="handleIngNombreBlur(${f.filaId}, this.value)"
            onfocus="handleIngNombreFocus(${f.filaId})"
          >
          <div class="autocomplete-dropdown" id="ac-${f.filaId}" style="display:none;"></div>
        </div>
        <input
          type="number"
          class="ing-cantidad-input"
          id="ing-cant-${f.filaId}"
          value="${f.cantidad || ''}"
          placeholder="Cant."
          min="0"
          step="any"
          onchange="handleIngCantidadChange(${f.filaId}, this.value)"
        >
        <select
          class="ing-unidad-select"
          id="ing-unidad-${f.filaId}"
          onchange="handleIngUnidadChange(${f.filaId}, this.value)"
        >
          ${['gr','ml','unidad','taza','cucharada','oz'].map(u =>
            `<option value="${u}" ${f.unidad === u ? 'selected' : ''}>${u}</option>`
          ).join('')}
        </select>
        <button class="btn-icon btn-delete ing-btn-delete" onclick="eliminarFilaIngrediente(${f.filaId})" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      ${avisoHtml}
    </div>`;
}

function agregarFilaIngrediente() {
  ingredientesFilas.push({
    filaId: _newFilaId(),
    ingrediente_catalogo_id: null,
    nombre: '',
    cantidad: '',
    unidad: 'gr',
    esNuevo: false,
    pendienteConfirmacion: false,
    confirmado: false
  });
  renderIngredientesFilas();
  // Focus al nuevo input
  const ultimo = ingredientesFilas[ingredientesFilas.length - 1];
  setTimeout(() => {
    const el = document.getElementById(`ing-nombre-${ultimo.filaId}`);
    if (el) el.focus();
  }, 50);
}

function eliminarFilaIngrediente(filaId) {
  ingredientesFilas = ingredientesFilas.filter(f => f.filaId !== filaId);
  renderIngredientesFilas();
}

function handleIngCantidadChange(filaId, val) {
  const f = ingredientesFilas.find(f => f.filaId === filaId);
  if (f) f.cantidad = parseFloat(val) || 0;
}

function handleIngUnidadChange(filaId, val) {
  const f = ingredientesFilas.find(f => f.filaId === filaId);
  if (f) f.unidad = val;
}

// ─── Autocomplete ─────────────────────────────────────────
let _acFilaActiva = null;
let _acTimer = null;

function handleIngNombreFocus(filaId) {
  _acFilaActiva = filaId;
}

async function handleIngNombreInput(filaId, valor) {
  const f = ingredientesFilas.find(f => f.filaId === filaId);
  if (!f) return;
  f.nombre = valor;
  f.ingrediente_catalogo_id = null;
  f.esNuevo = false;
  f.pendienteConfirmacion = false;

  clearTimeout(_acTimer);
  if (valor.trim().length < 2) {
    _cerrarDropdown(filaId);
    return;
  }
  _acTimer = setTimeout(() => _buscarSugerencias(filaId, valor), 150);
}

async function _buscarSugerencias(filaId, query) {
  const lowerQ = query.toLowerCase();
  const todos = await db.ingredientes_catalogo.toArray();
  const matches = todos.filter(i => i.nombre.toLowerCase().includes(lowerQ));

  const dropdown = document.getElementById(`ac-${filaId}`);
  if (!dropdown) return;

  if (matches.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  dropdown.innerHTML = matches.slice(0, 6).map(i =>
    `<div class="ac-item" onmousedown="seleccionarSugerencia(${filaId}, ${i.id}, '${escapeHTML(i.nombre).replace(/'/g, "\\'")}')">
      ${escapeHTML(i.nombre)}
    </div>`
  ).join('');
  dropdown.style.display = 'block';
}

function seleccionarSugerencia(filaId, catId, nombre) {
  const f = ingredientesFilas.find(f => f.filaId === filaId);
  if (!f) return;
  f.nombre = nombre;
  f.ingrediente_catalogo_id = catId;
  f.esNuevo = false;
  f.pendienteConfirmacion = false;
  f.confirmado = true;
  _cerrarDropdown(filaId);
  // Actualizar input visualmente
  const input = document.getElementById(`ing-nombre-${filaId}`);
  if (input) input.value = nombre;
  // Focus a cantidad
  const cantInput = document.getElementById(`ing-cant-${filaId}`);
  if (cantInput) cantInput.focus();
}

async function handleIngNombreBlur(filaId, valor) {
  _cerrarDropdown(filaId);
  const f = ingredientesFilas.find(f => f.filaId === filaId);
  if (!f || !valor.trim()) return;

  // Ya está vinculado al catálogo
  if (f.ingrediente_catalogo_id) return;
  if (f.confirmado) return;

  // Buscar coincidencia insensible a mayúsculas
  const lowerVal = valor.trim().toLowerCase();
  const todos = await db.ingredientes_catalogo.toArray();
  const exacto = todos.find(i => i.nombre.toLowerCase() === lowerVal);

  if (exacto) {
    // Existe en catálogo — vincular silenciosamente
    f.nombre = exacto.nombre;
    f.ingrediente_catalogo_id = exacto.id;
    f.esNuevo = false;
    f.pendienteConfirmacion = false;
    f.confirmado = true;
    const input = document.getElementById(`ing-nombre-${filaId}`);
    if (input) input.value = exacto.nombre;
    return;
  }

  // Es nuevo — pedir confirmación
  f.esNuevo = true;
  f.pendienteConfirmacion = true;
  f.confirmado = false;
  // Re-render solo esta fila para mostrar aviso
  _rerenderFila(filaId);
}

function confirmarNuevoIngrediente(filaId) {
  const f = ingredientesFilas.find(f => f.filaId === filaId);
  if (!f) return;
  f.pendienteConfirmacion = false;
  f.esNuevo = true;
  f.confirmado = true;
  _rerenderFila(filaId);
}

function corregirIngrediente(filaId) {
  const f = ingredientesFilas.find(f => f.filaId === filaId);
  if (!f) return;
  f.pendienteConfirmacion = false;
  f.esNuevo = false;
  f.confirmado = false;
  f.nombre = '';
  f.ingrediente_catalogo_id = null;
  _rerenderFila(filaId);
  setTimeout(() => {
    const input = document.getElementById(`ing-nombre-${filaId}`);
    if (input) { input.value = ''; input.focus(); }
  }, 50);
}

function _rerenderFila(filaId) {
  const f = ingredientesFilas.find(f => f.filaId === filaId);
  if (!f) return;
  const el = document.getElementById(`fila-ing-${filaId}`);
  if (!el) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = buildFilaIngrediente(f);
  el.replaceWith(tmp.firstElementChild);
}

function _cerrarDropdown(filaId = null) {
  if (filaId !== null) {
    const dd = document.getElementById(`ac-${filaId}`);
    if (dd) dd.style.display = 'none';
  } else {
    document.querySelectorAll('.autocomplete-dropdown').forEach(d => d.style.display = 'none');
  }
}

// ─── Filas de procesos ────────────────────────────────────
async function renderProcesosFilas(equiposPre = null) {
  const equipos = equiposPre || await db.equipos.toArray();
  const contenedor = document.getElementById('procesos-filas');
  contenedor.innerHTML = procesosFilas.map(f => buildFilaProceso(f, equipos)).join('');
}

function buildFilaProceso(f, equipos) {
  const sinEquipos = equipos.length === 0;
  const opcionesEquipos = sinEquipos
    ? `<option value="" disabled>Sin equipos — ve a Configuración</option>`
    : equipos.map(eq =>
        `<option value="${eq.id}" ${f.equipo_id == eq.id ? 'selected' : ''}>${escapeHTML(eq.nombre)}</option>`
      ).join('');

  return `
    <div class="proc-fila" id="fila-proc-${f.filaId}">
      <select
        class="proc-equipo-select"
        id="proc-equipo-${f.filaId}"
        ${sinEquipos ? 'disabled' : ''}
        onchange="handleProcEquipoChange(${f.filaId}, this.value)"
      >
        ${!sinEquipos && !f.equipo_id ? '<option value="" disabled selected>Seleccionar equipo</option>' : ''}
        ${opcionesEquipos}
      </select>
      <input
        type="number"
        class="proc-minutos-input"
        id="proc-min-${f.filaId}"
        value="${f.minutos || ''}"
        placeholder="Min."
        min="0"
        step="1"
        onchange="handleProcMinutosChange(${f.filaId}, this.value)"
      >
      <button class="btn-icon btn-delete proc-btn-delete" onclick="eliminarFilaProceso(${f.filaId})" title="Eliminar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>`;
}

async function agregarFilaProceso() {
  const equipos = await db.equipos.toArray();
  procesosFilas.push({
    filaId: _newFilaId(),
    equipo_id: equipos.length > 0 ? equipos[0].id : null,
    minutos: ''
  });
  renderProcesosFilas(equipos);
}

function eliminarFilaProceso(filaId) {
  procesosFilas = procesosFilas.filter(f => f.filaId !== filaId);
  renderProcesosFilas();
}

function handleProcEquipoChange(filaId, val) {
  const f = procesosFilas.find(f => f.filaId === filaId);
  if (f) f.equipo_id = parseInt(val);
}

function handleProcMinutosChange(filaId, val) {
  const f = procesosFilas.find(f => f.filaId === filaId);
  if (f) f.minutos = parseFloat(val) || 0;
}

// ─── Guardar receta ───────────────────────────────────────
async function guardarReceta() {
  const nombre = document.getElementById('rf-nombre').value.trim();
  const categoria = document.getElementById('rf-categoria').value;
  const porciones = parseFloat(document.getElementById('rf-porciones').value);
  const notas = document.getElementById('rf-notas').value.trim();

  // Validaciones
  if (!nombre) {
    mostrarToast('El nombre es obligatorio');
    document.getElementById('rf-nombre').focus();
    return;
  }
  if (!porciones || porciones <= 0) {
    mostrarToast('Las porciones deben ser mayor a cero');
    document.getElementById('rf-porciones').focus();
    return;
  }

  // Validar ingredientes pendientes de confirmación
  const pendientes = ingredientesFilas.filter(f => f.pendienteConfirmacion);
  if (pendientes.length > 0) {
    mostrarToast('Confirma o corrige los ingredientes nuevos');
    return;
  }

  // Validar que ingredientes con nombre tengan catálogo vinculado o sean nuevos confirmados
  const invalidos = ingredientesFilas.filter(f =>
    f.nombre.trim() && !f.ingrediente_catalogo_id && !f.esNuevo
  );
  if (invalidos.length > 0) {
    mostrarToast('Algunos ingredientes no están vinculados al catálogo');
    return;
  }

  const ahora = Date.now();

  // 1. Insertar ingredientes nuevos en catálogo
  for (const f of ingredientesFilas) {
    if (f.esNuevo && f.nombre.trim() && !f.ingrediente_catalogo_id) {
      const nuevoId = await db.ingredientes_catalogo.add({ nombre: f.nombre.trim() });
      f.ingrediente_catalogo_id = nuevoId;
    }
  }

  // 2. Guardar o actualizar receta
  let recetaId;
  if (recetaEnEdicion) {
    await db.recetas.update(recetaEnEdicion.id, {
      nombre, categoria,
      porciones_base: porciones,
      notas,
      fecha_modificacion: ahora
    });
    recetaId = recetaEnEdicion.id;
    // Limpiar ingredientes y procesos existentes para reescribir
    await db.ingredientes_receta.where('receta_id').equals(recetaId).delete();
    await db.procesos_receta.where('receta_id').equals(recetaId).delete();
  } else {
    recetaId = await db.recetas.add({
      nombre, categoria,
      porciones_base: porciones,
      notas,
      fecha_creacion: ahora,
      fecha_modificacion: ahora
    });
  }

  // 3. Insertar ingredientes (solo los que tienen nombre y están vinculados)
  const ingParaGuardar = ingredientesFilas.filter(f =>
    f.nombre.trim() && f.ingrediente_catalogo_id
  );
  for (const f of ingParaGuardar) {
    await db.ingredientes_receta.add({
      receta_id: recetaId,
      ingrediente_catalogo_id: f.ingrediente_catalogo_id,
      cantidad: f.cantidad || 0,
      unidad: f.unidad || 'gr'
    });
  }

  // 4. Insertar procesos (solo los que tienen equipo y minutos)
  const procParaGuardar = procesosFilas.filter(f => f.equipo_id && f.minutos > 0);
  for (const f of procParaGuardar) {
    await db.procesos_receta.add({
      receta_id: recetaId,
      equipo_id: f.equipo_id,
      minutos: f.minutos
    });
  }

  cerrarFormulario();
  await renderRecetario();
  mostrarToast(recetaEnEdicion ? 'Receta actualizada' : 'Receta guardada');
}

// ─── Init Recetario ───────────────────────────────────────
async function initRecetario() {
  await verificarOnboarding();
  await renderRecetario();
}
