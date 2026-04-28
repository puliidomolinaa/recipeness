// app.js — navegación y lógica principal

// ─── Navegación SPA ──────────────────────────────────────
function navegarA(seccionId) {
  document.querySelectorAll('.seccion').forEach(s => s.classList.remove('activa'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(seccionId).classList.add('activa');
  document.querySelector(`[data-seccion="${seccionId}"]`).classList.add('active');

  // Al mostrar presupuesto: verificar config sin guardar, pero NO abrir el panel automáticamente
  if (seccionId === 'sec-presupuesto') {
    if (typeof onMostrarSeccionPresupuesto === 'function') {
      onMostrarSeccionPresupuesto();
    }
if (seccionId === 'sec-historial') {
  renderHistorial();
}
  }
}

// ─── Toast ───────────────────────────────────────────────
function mostrarToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ─── Modal / Drawer ──────────────────────────────────────
let modalCallback = null;

function abrirModal(config) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = config.titulo;

  const body = document.getElementById('modal-body');
  body.innerHTML = config.html || '';

  const btnConfirmar = document.getElementById('modal-confirmar');
  btnConfirmar.textContent = config.confirmar || 'Guardar';
  modalCallback = config.onConfirmar;

  overlay.classList.add('visible');

  setTimeout(() => {
    const first = body.querySelector('input, select');
    if (first) first.focus();
  }, 100);
}

function cerrarModal() {
  document.getElementById('modal-overlay').classList.remove('visible');
  modalCallback = null;
}

// ─── Configuración Global ────────────────────────────────
async function cargarConfiguracion() {
  const campos = ['precio_gas', 'precio_kwh', 'margen_ganancia', 'salario_minimo_hora', 'multiplicador_mano_obra'];
  for (const clave of campos) {
    const reg = await db.configuracion_global.get(clave);
    const el = document.getElementById(`cfg-${clave}`);
    if (el && reg) el.value = reg.valor;
  }
}

async function guardarConfiguracion() {
  const campos = ['precio_gas', 'precio_kwh', 'margen_ganancia', 'salario_minimo_hora', 'multiplicador_mano_obra'];
  for (const clave of campos) {
    const el = document.getElementById(`cfg-${clave}`);
    if (el) {
      const valor = parseFloat(el.value) || 0;
      await db.configuracion_global.put({ clave, valor });
    }
  }
  // Ocultar aviso si existía
  const aviso = document.getElementById('aviso-config-sin-guardar');
  if (aviso) aviso.style.display = 'none';
  mostrarToast('Configuración guardada');
}

function activarAvisosConfiguracion() {
  const campos = ['precio_gas', 'precio_kwh', 'margen_ganancia', 'salario_minimo_hora', 'multiplicador_mano_obra'];
  campos.forEach(clave => {
    const el = document.getElementById(`cfg-${clave}`);
    if (el) {
      el.addEventListener('input', () => {
        const aviso = document.getElementById('aviso-config-sin-guardar');
        if (aviso) aviso.style.display = 'flex';
      });
    }
  });
}

// ─── Equipos ─────────────────────────────────────────────
async function renderEquipos() {
  const lista = document.getElementById('equipos-lista');
  const equipos = await db.equipos.toArray();

  if (equipos.length === 0) {
    lista.innerHTML = '<p class="equipos-empty">Aún no hay equipos registrados.</p>';
    return;
  }

  lista.innerHTML = equipos.map(eq => {
    const tipo = eq.tipo_energia === 'gas' ? 'Gas' : 'Eléctrico';
    const unidad = eq.tipo_energia === 'gas' ? 'L/h' : 'W';
    return `
      <div class="equipo-item" data-id="${eq.id}">
        <div class="equipo-info">
          <div class="equipo-nombre">${escapeHTML(eq.nombre)}</div>
          <div class="equipo-meta">${tipo} · ${eq.consumo_unitario} ${unidad}</div>
        </div>
        <div class="equipo-actions">
          <button class="btn-icon btn-edit" onclick="editarEquipo(${eq.id})" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-icon btn-delete" onclick="eliminarEquipo(${eq.id})" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

function htmlFormEquipo(equipo = null) {
  const nombre = equipo ? escapeHTML(equipo.nombre) : '';
  const tipo = equipo ? equipo.tipo_energia : 'electrico';
  const consumo = equipo ? equipo.consumo_unitario : '';
  const labelConsumo = tipo === 'gas' ? 'Consumo (litros/hora)' : 'Consumo (watts)';

  return `
    <div class="form-row">
      <label>Nombre del equipo</label>
      <input type="text" id="eq-nombre" value="${nombre}" placeholder="Ej: Horno, Batidora..." maxlength="80">
    </div>
    <div class="form-row">
      <label>Tipo de energía</label>
      <select id="eq-tipo" onchange="actualizarLabelConsumo()">
        <option value="electrico" ${tipo === 'electrico' ? 'selected' : ''}>Eléctrico</option>
        <option value="gas" ${tipo === 'gas' ? 'selected' : ''}>Gas</option>
      </select>
    </div>
    <div class="form-row">
      <label id="eq-consumo-label">${labelConsumo}</label>
      <input type="number" id="eq-consumo" value="${consumo}" min="0" step="any" placeholder="0">
    </div>`;
}

function actualizarLabelConsumo() {
  const tipo = document.getElementById('eq-tipo')?.value;
  const label = document.getElementById('eq-consumo-label');
  if (label) {
    label.textContent = tipo === 'gas' ? 'Consumo (litros/hora)' : 'Consumo (watts)';
  }
}

function abrirModalEquipo(equipo = null) {
  abrirModal({
    titulo: equipo ? 'Editar equipo' : 'Nuevo equipo',
    html: htmlFormEquipo(equipo),
    confirmar: equipo ? 'Guardar cambios' : 'Agregar equipo',
    onConfirmar: async () => {
      const nombre = document.getElementById('eq-nombre').value.trim();
      const tipo = document.getElementById('eq-tipo').value;
      const consumo = parseFloat(document.getElementById('eq-consumo').value) || 0;

      if (!nombre) {
        mostrarToast('El nombre es obligatorio');
        return false;
      }

      if (equipo) {
        await db.equipos.update(equipo.id, { nombre, tipo_energia: tipo, consumo_unitario: consumo });
        mostrarToast('Equipo actualizado');
      } else {
        await db.equipos.add({ nombre, tipo_energia: tipo, consumo_unitario: consumo });
        mostrarToast('Equipo agregado');
      }

      await renderEquipos();
      return true;
    }
  });
}

async function editarEquipo(id) {
  const eq = await db.equipos.get(id);
  if (eq) abrirModalEquipo(eq);
}

async function eliminarEquipo(id) {
  if (!confirm('¿Eliminar este equipo? Esta acción no se puede deshacer.')) return;
  await db.equipos.delete(id);
  await renderEquipos();
  mostrarToast('Equipo eliminado');
}

// ─── Insumos catálogo ─────────────────────────────────────
async function renderInsumosCatalogo() {
  const lista = document.getElementById('insumos-catalogo-lista');
  const insumos = await db.insumos_catalogo.toArray();

  if (insumos.length === 0) {
    lista.innerHTML = '<p class="equipos-empty">Aún no hay insumos registrados.</p>';
    return;
  }

  lista.innerHTML = insumos.map(ins => {
    const costoPieza = ins.piezas > 0
      ? `$${(ins.precio_paquete / ins.piezas).toFixed(2)}/pieza`
      : '';
    return `
      <div class="equipo-item" data-id="${ins.id}">
        <div class="equipo-info">
          <div class="equipo-nombre">${escapeHTML(ins.nombre)}</div>
          <div class="equipo-meta">
            $${ins.precio_paquete} por paquete · ${ins.piezas} piezas
            ${costoPieza ? ` · ${costoPieza}` : ''}
          </div>
        </div>
        <div class="equipo-actions">
          <button class="btn-icon btn-edit" onclick="editarInsumoCatalogo(${ins.id})" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-icon btn-delete" onclick="eliminarInsumoCatalogo(${ins.id})" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

function htmlFormInsumoCatalogo(insumo = null) {
  const nombre = insumo ? escapeHTML(insumo.nombre) : '';
  const precio = insumo ? insumo.precio_paquete : '';
  const piezas = insumo ? insumo.piezas : '';

  return `
    <div class="form-row">
      <label>Nombre del insumo</label>
      <input type="text" id="ins-nombre" value="${nombre}" placeholder="Ej: Caja, Bolsa, Etiqueta..." maxlength="80">
    </div>
    <div class="form-row">
      <label>Precio del paquete</label>
      <input type="number" id="ins-precio" value="${precio}" min="0" step="any" placeholder="0.00">
    </div>
    <div class="form-row">
      <label>Piezas por paquete</label>
      <input type="number" id="ins-piezas" value="${piezas}" min="1" step="1" placeholder="ej: 100">
    </div>`;
}

function abrirModalInsumoCatalogo(insumo = null) {
  abrirModal({
    titulo: insumo ? 'Editar insumo' : 'Nuevo insumo',
    html: htmlFormInsumoCatalogo(insumo),
    confirmar: insumo ? 'Guardar cambios' : 'Agregar insumo',
    onConfirmar: async () => {
      const nombre = document.getElementById('ins-nombre').value.trim();
      const precio_paquete = parseFloat(document.getElementById('ins-precio').value) || 0;
      const piezas = parseInt(document.getElementById('ins-piezas').value) || 0;

      if (!nombre) {
        mostrarToast('El nombre es obligatorio');
        return false;
      }
      if (piezas < 1) {
        mostrarToast('Las piezas por paquete deben ser al menos 1');
        return false;
      }

      if (insumo) {
        await db.insumos_catalogo.update(insumo.id, { nombre, precio_paquete, piezas });
        mostrarToast('Insumo actualizado');
      } else {
        await db.insumos_catalogo.add({ nombre, precio_paquete, piezas });
        mostrarToast('Insumo agregado');
      }

      await renderInsumosCatalogo();
      return true;
    }
  });
}

async function editarInsumoCatalogo(id) {
  const ins = await db.insumos_catalogo.get(id);
  if (ins) abrirModalInsumoCatalogo(ins);
}

async function eliminarInsumoCatalogo(id) {
  if (!confirm('¿Eliminar este insumo? Esta acción no se puede deshacer.')) return;
  await db.insumos_catalogo.delete(id);
  await renderInsumosCatalogo();
  mostrarToast('Insumo eliminado');
}

// ─── Respaldo ────────────────────────────────────────────
async function handleExportar() {
  try {
    await exportarRespaldo();
    mostrarToast('Respaldo exportado');
  } catch (e) {
    mostrarToast('Error al exportar');
    console.error(e);
  }
}

function handleImportar() {
  const input = document.getElementById('input-importar');
  input.click();
}

async function procesarImportacion(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const ok = confirm('Esto reemplazará todos tus datos. ¿Continuar?');
  if (!ok) {
    e.target.value = '';
    return;
  }

  try {
    await importarRespaldo(archivo);
    await cargarConfiguracion();
    await renderEquipos();
    await renderInsumosCatalogo();
    await renderRecetario();
    mostrarToast('Datos restaurados correctamente');
  } catch (err) {
    mostrarToast('Error: archivo inválido');
    console.error(err);
  }
  e.target.value = '';
}

// ─── Utilidades ──────────────────────────────────────────
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/recipeness/sw.js').catch(console.error);
  }

  await initDB();

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      navegarA(item.dataset.seccion);
      if (item.dataset.seccion === 'sec-configuracion') {
        renderCategoriasConfig();
        renderInsumosCatalogo();
      }
    });
  });

  document.getElementById('modal-confirmar').addEventListener('click', async () => {
    if (modalCallback) {
      const cerrar = await modalCallback();
      if (cerrar !== false) cerrarModal();
    }
  });

  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) cerrarModal();
  });

  document.getElementById('input-importar').addEventListener('change', procesarImportacion);

  await cargarConfiguracion();
  await renderEquipos();
  aqait initHistorial();
  await renderInsumosCatalogo();
  await initRecetario();
  activarAvisosConfiguracion();

  navegarA('sec-recetario');



  const filtrosEl = document.getElementById('filtros-categorias');
  let isDragging = false, startX, scrollLeft;
  filtrosEl.addEventListener('mousedown', e => {
    isDragging = true;
    startX = e.pageX - filtrosEl.offsetLeft;
    scrollLeft = filtrosEl.scrollLeft;
    filtrosEl.classList.add('dragging');
  });
  filtrosEl.addEventListener('mouseleave', () => { isDragging = false; filtrosEl.classList.remove('dragging'); });
  filtrosEl.addEventListener('mouseup', () => { isDragging = false; filtrosEl.classList.remove('dragging'); });
  filtrosEl.addEventListener('mousemove', e => {
    if (!isDragging) return;
    e.preventDefault();
    filtrosEl.scrollLeft = scrollLeft - (e.pageX - filtrosEl.offsetLeft - startX);
  });
});
