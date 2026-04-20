// app.js — navegación y lógica principal

// ─── Navegación SPA ──────────────────────────────────────
function navegarA(seccionId) {
  document.querySelectorAll('.seccion').forEach(s => s.classList.remove('activa'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(seccionId).classList.add('activa');
  document.querySelector(`[data-seccion="${seccionId}"]`).classList.add('active');
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

  // Construir formulario dinámico
  const body = document.getElementById('modal-body');
  body.innerHTML = config.html || '';

  // Callbacks
  const btnConfirmar = document.getElementById('modal-confirmar');
  btnConfirmar.textContent = config.confirmar || 'Guardar';
  modalCallback = config.onConfirmar;

  overlay.classList.add('visible');

  // Opcional: focus en primer input
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
  mostrarToast('Configuración guardada');
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
        return false; // no cerrar modal
      }

      if (equipo) {
        await db.equipos.update(equipo.id, { nombre, tipo_energia: tipo, consumo_unitario: consumo });
        mostrarToast('Equipo actualizado');
      } else {
        await db.equipos.add({ nombre, tipo_energia: tipo, consumo_unitario: consumo });
        mostrarToast('Equipo agregado');
      }

      await renderEquipos();
      return true; // cerrar modal
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
    mostrarToast('Datos restaurados correctamente');
  } catch (err) {
    mostrarToast('Error: archivo inválido');
    console.error(err);
  }
  e.target.value = '';
}

// ─── Utilidades ──────────────────────────────────────────
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Registrar Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/recipeness/sw.js').catch(console.error);
  }

  // Inicializar DB
  await initDB();

  // Navegación
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      navegarA(item.dataset.seccion);
    });
  });

  // Modal — botón confirmar
  document.getElementById('modal-confirmar').addEventListener('click', async () => {
    if (modalCallback) {
      const cerrar = await modalCallback();
      if (cerrar !== false) cerrarModal();
    }
  });

  // Modal — cerrar al tocar overlay
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) cerrarModal();
  });

  // Importar archivo
  document.getElementById('input-importar').addEventListener('change', procesarImportacion);

  // Cargar datos iniciales
  await cargarConfiguracion();
  await renderEquipos();

  // Mostrar sección inicial
  navegarA('sec-configuracion');
});
