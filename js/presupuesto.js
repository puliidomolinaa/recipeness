// presupuesto.js — lógica del módulo de presupuesto

// ─── Estado ──────────────────────────────────────────────
let presupuestoState = {
  paso: 1,
  receta: null,
  porciones: 1,
  precioGas: 0,
  precioKwh: 0,
  margen: 30,
  ingredientesConPrecio: [],
  horasTrabajadas: 0,
  tarifaHora: 0,
  insumosAdicionales: [],
  resultados: null
};

// ─── Init ─────────────────────────────────────────────────
function initPresupuesto() {
  renderPaso1();
}

// ─── Navegación de pasos ──────────────────────────────────
function mostrarPaso(n) {
  document.querySelectorAll('.presupuesto-footer-paso').forEach(el => {
    const visible = parseInt(el.dataset.paso) === n;
    el.style.display = visible ? 'flex' : 'none';
    if (visible) { el.style.flexDirection = 'column'; el.style.gap = '8px'; }
  });
  presupuestoState.paso = n;
  document.querySelectorAll('.presupuesto-paso').forEach(el => {
    el.classList.toggle('activo', parseInt(el.dataset.paso) === n);
  });
  document.querySelectorAll('.stepper-step').forEach(el => {
    const num = parseInt(el.dataset.step);
    el.classList.toggle('completado', num < n);
    el.classList.toggle('activo', num === n);
  });
  const body = document.getElementById('presupuesto-panel-body');
  if (body) body.scrollTop = 0;
}

// ─── Paso 1: Seleccionar receta ───────────────────────────
async function renderPaso1() {
  const recetas = await db.recetas.orderBy('fecha_creacion').reverse().toArray();
  const lista = document.getElementById('p1-recetas-lista');
  const empty = document.getElementById('p1-recetas-empty');

  if (recetas.length === 0) {
    lista.innerHTML = '';
    empty.style.display = 'flex';
  } else {
    empty.style.display = 'none';
    lista.innerHTML = recetas.map(r => `
      <button class="receta-seleccion-item" onclick="seleccionarReceta(${r.id})">
        <div class="receta-seleccion-nombre">${escapeHTML(r.nombre)}</div>
        <div class="receta-seleccion-meta">
          <span>${escapeHTML(r.categoria || 'Sin categoría')}</span>
          <span>${r.porciones_base || 0} porciones</span>
        </div>
        <svg class="receta-seleccion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>`).join('');
  }

  abrirPanelPresupuesto();
  mostrarPaso(1);
}

async function seleccionarReceta(id) {
  const receta = await db.recetas.get(id);
  if (!receta) return;
  presupuestoState.receta = receta;
  presupuestoState.porciones = receta.porciones_base || 1;
  const [gas, kwh, margen] = await Promise.all([
    db.configuracion_global.get('precio_gas'),
    db.configuracion_global.get('precio_kwh'),
    db.configuracion_global.get('margen_ganancia'),
  ]);
  presupuestoState.precioGas = gas?.valor || 0;
  presupuestoState.precioKwh = kwh?.valor || 0;
  presupuestoState.margen = margen?.valor || 30;
  await renderPaso2();
}

// ─── Paso 2: Ajustes ──────────────────────────────────────
async function renderPaso2() {
  const r = presupuestoState.receta;
  document.getElementById('p2-receta-nombre').textContent = r.nombre;
  document.getElementById('p2-porciones').value = presupuestoState.porciones;
  document.getElementById('p2-precio-gas').value = presupuestoState.precioGas;
  document.getElementById('p2-precio-kwh').value = presupuestoState.precioKwh;
  document.getElementById('p2-margen').value = presupuestoState.margen;
  mostrarPaso(2);
}

async function confirmarPaso2() {
  presupuestoState.porciones = parseFloat(document.getElementById('p2-porciones').value) || 1;
  presupuestoState.precioGas = parseFloat(document.getElementById('p2-precio-gas').value) || 0;
  presupuestoState.precioKwh = parseFloat(document.getElementById('p2-precio-kwh').value) || 0;
  presupuestoState.margen = parseFloat(document.getElementById('p2-margen').value) ?? 30;
  await renderPaso3();
}

// ─── Paso 3: Precios de ingredientes ─────────────────────
async function renderPaso3() {
  const r = presupuestoState.receta;
  const ingredientes = await db.ingredientes_receta.where('receta_id').equals(r.id).toArray();
  const lista = document.getElementById('p3-ingredientes-lista');
  const avisoCero = document.getElementById('p3-sin-ingredientes');

  if (ingredientes.length === 0) {
    lista.innerHTML = '';
    avisoCero.style.display = 'block';
    presupuestoState.ingredientesConPrecio = [];
    document.getElementById('p3-btn-continuar').disabled = false;
    mostrarPaso(3);
    return;
  }

  avisoCero.style.display = 'none';
  const escala = presupuestoState.porciones / r.porciones_base;
  const ingsEscalados = [];
  for (const ing of ingredientes) {
    const cat = await db.ingredientes_catalogo.get(ing.ingrediente_catalogo_id);
    ingsEscalados.push({
      nombre: cat?.nombre || 'Ingrediente',
      cantidadNecesaria: ing.cantidad * escala,
      unidad: ing.unidad || '',
      precioPaquete: 0,
      cantidadPaquete: 0
    });
  }
  presupuestoState.ingredientesConPrecio = ingsEscalados;

  lista.innerHTML = ingsEscalados.map((ing, i) => `
    <div class="ingrediente-precio-item">
      <div class="ing-precio-header">
        <span class="ing-precio-nombre">${escapeHTML(ing.nombre)}</span>
        <span class="ing-precio-necesita">${ing.cantidadNecesaria.toFixed(2)} ${escapeHTML(ing.unidad)}</span>
      </div>
      <div class="form-row-inline">
        <div>
          <label style="font-size:12px">Precio del paquete</label>
          <input type="number" class="precio-paquete-input" data-index="${i}" min="0" step="any" placeholder="ej: 350">
        </div>
        <div>
          <label style="font-size:12px">Cantidad en el paquete (${escapeHTML(ing.unidad) || 'u'})</label>
          <input type="number" class="cantidad-paquete-input" data-index="${i}" min="0" step="any" placeholder="ej: 1000">
        </div>
      </div>
      <div class="ing-precio-costo-unitario" id="costo-unitario-${i}" style="display:none"></div>
    </div>`).join('');

  lista.querySelectorAll('.precio-paquete-input, .cantidad-paquete-input').forEach(input => {
    input.addEventListener('input', validarYActualizarPaso3);
  });
  document.getElementById('p3-btn-continuar').disabled = true;
  mostrarPaso(3);
}

function validarYActualizarPaso3() {
  const precios = document.querySelectorAll('.precio-paquete-input');
  const cantidades = document.querySelectorAll('.cantidad-paquete-input');
  let todoValido = precios.length > 0;

  precios.forEach((input, i) => {
    const precio = parseFloat(input.value);
    const cantidad = parseFloat(cantidades[i].value);
    const valido = precio > 0 && cantidad > 0;
    if (!valido) {
      todoValido = false;
      const display = document.getElementById(`costo-unitario-${i}`);
      if (display) display.style.display = 'none';
    } else {
      presupuestoState.ingredientesConPrecio[i].precioPaquete = precio;
      presupuestoState.ingredientesConPrecio[i].cantidadPaquete = cantidad;
      const costoUso = (presupuestoState.ingredientesConPrecio[i].cantidadNecesaria / cantidad) * precio;
      const display = document.getElementById(`costo-unitario-${i}`);
      if (display) {
        display.textContent = `Costo para esta receta: $${costoUso.toFixed(2)}`;
        display.style.display = 'block';
      }
    }
  });
  document.getElementById('p3-btn-continuar').disabled = !todoValido;
}

// ─── Paso 4: Mano de obra e insumos ──────────────────────
async function renderPaso4() {
  const [salario, multiplicador] = await Promise.all([
    db.configuracion_global.get('salario_minimo_hora'),
    db.configuracion_global.get('multiplicador_mano_obra'),
  ]);
  presupuestoState.tarifaHora = (salario?.valor || 0) * (multiplicador?.valor || 2);
  presupuestoState.horasTrabajadas = 0;

  // Precargar insumos del catálogo con su costo por pieza calculado
  const catalogoInsumos = await db.insumos_catalogo.toArray();
  presupuestoState.insumosAdicionales = catalogoInsumos.map(ins => ({
    id: ins.id,
    nombre: ins.nombre,
    costoPorPieza: ins.piezas > 0 ? ins.precio_paquete / ins.piezas : 0,
    precioPaquete: ins.precio_paquete,
    piezasPorPaquete: ins.piezas,
    esDeCatalogo: true
  }));

  document.getElementById('p4-horas').value = 0;
  document.getElementById('p4-tarifa').value = presupuestoState.tarifaHora;
  actualizarManoObra();
  renderInsumosLista();
  mostrarPaso(4);
}

function actualizarManoObra() {
  const horas = parseFloat(document.getElementById('p4-horas')?.value) || 0;
  const tarifa = parseFloat(document.getElementById('p4-tarifa')?.value) || 0;
  presupuestoState.horasTrabajadas = horas;
  presupuestoState.tarifaHora = tarifa;
  const total = horas * tarifa;
  const display = document.getElementById('p4-mano-obra-total');
  if (display) display.textContent = `$${total.toFixed(2)}`;
}

function agregarInsumo() {
  presupuestoState.insumosAdicionales.push({ id: Date.now(), nombre: '', costoPorPieza: 0, esDeCatalogo: false });
  renderInsumosLista();
}

function renderInsumosLista() {
  const lista = document.getElementById('p4-insumos-lista');
  if (!lista) return;

  if (presupuestoState.insumosAdicionales.length === 0) {
    lista.innerHTML = '<p class="insumos-empty">Sin insumos. Agregá manualmente o configurá en Configuración.</p>';
    return;
  }

  lista.innerHTML = presupuestoState.insumosAdicionales.map((insumo, i) => {
    const subtotal = insumo.costoPorPieza * presupuestoState.porciones;
    const badgeCatalogo = insumo.esDeCatalogo
      ? `<span class="insumo-badge-catalogo">del catálogo</span>`
      : '';
    return `
      <div class="insumo-item">
        <div class="insumo-nombre-row">
          <span class="insumo-nombre-label">${escapeHTML(insumo.nombre) || '(sin nombre)'}</span>
          ${badgeCatalogo}
        </div>
        <div class="form-row-inline" style="margin-top:8px">
          <div>
            <label style="font-size:12px">Costo por pieza</label>
            <input type="number" value="${insumo.costoPorPieza}" min="0" step="any"
              oninput="actualizarInsumo(${i}, 'costo', parseFloat(this.value) || 0)">
          </div>
          <div style="display:flex;align-items:flex-end;padding-bottom:2px">
            <span class="insumo-subtotal">× ${presupuestoState.porciones} = $${subtotal.toFixed(2)}</span>
          </div>
        </div>
        ${!insumo.esDeCatalogo ? `
        <div style="margin-top:6px">
          <label style="font-size:12px">Nombre</label>
          <input type="text" value="${escapeHTML(insumo.nombre)}"
            oninput="actualizarInsumo(${i}, 'nombre', this.value)"
            placeholder="Ej: Caja, Etiqueta...">
        </div>` : ''}
        <div class="insumo-footer-row" style="margin-top:8px">
          <span></span>
          <button class="btn-icon btn-delete" onclick="eliminarInsumo(${i})" title="Quitar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

function actualizarInsumo(index, campo, valor) {
  if (campo === 'nombre') {
    presupuestoState.insumosAdicionales[index].nombre = valor;
  } else if (campo === 'costo') {
    presupuestoState.insumosAdicionales[index].costoPorPieza = valor;
    renderInsumosLista();
  }
}

function eliminarInsumo(index) {
  presupuestoState.insumosAdicionales.splice(index, 1);
  renderInsumosLista();
}

// ─── Cálculo de resultados ────────────────────────────────
async function calcularResultados() {
  const r = presupuestoState.receta;

  // Ingredientes: costo prorrateado (uso real) vs inversión (paquete completo)
  let subtotalIngredientesProrateado = 0;
  let subtotalIngredientesInversion = 0;
  const detalleIngredientes = presupuestoState.ingredientesConPrecio.map(ing => {
    const costoPorUso = ing.cantidadPaquete > 0
      ? (ing.cantidadNecesaria / ing.cantidadPaquete) * ing.precioPaquete
      : 0;
    subtotalIngredientesProrateado += costoPorUso;
    subtotalIngredientesInversion += ing.precioPaquete;
    return { nombre: ing.nombre, costo: costoPorUso, costoInversion: ing.precioPaquete };
  });

  // Energía
  let subtotalEnergia = 0;
  const detalleEnergia = [];
  const procesos = await db.procesos_receta.where('receta_id').equals(r.id).toArray();
  for (const proceso of procesos) {
    if (!proceso.equipo_id) continue;
    const equipo = await db.equipos.get(proceso.equipo_id);
    if (!equipo) continue;
    let costo = 0;
    if (equipo.tipo_energia === 'gas') {
      costo = (equipo.consumo_unitario / 60) * proceso.minutos * presupuestoState.precioGas;
    } else if (equipo.tipo_energia === 'electrico') {
      costo = (equipo.consumo_unitario / 1000 / 60) * proceso.minutos * presupuestoState.precioKwh;
    }
    subtotalEnergia += costo;
    detalleEnergia.push({ nombre: `${equipo.nombre} · ${proceso.minutos}min`, costo });
  }

  // Mano de obra
  const manoDeObra = presupuestoState.horasTrabajadas * presupuestoState.tarifaHora;

  // Insumos
  let subtotalInsumosCorrida = 0;
  let subtotalInsumosInversion = 0;
  const detalleInsumos = presupuestoState.insumosAdicionales
    .filter(ins => ins.nombre.trim() || ins.esDeCatalogo)
    .map(ins => {
      const costoCorrida = ins.costoPorPieza * presupuestoState.porciones;
      subtotalInsumosCorrida += costoCorrida;
      const costoInversion = ins.esDeCatalogo ? (ins.precioPaquete || costoCorrida) : costoCorrida;
      subtotalInsumosInversion += costoInversion;
      return { nombre: ins.nombre, costo: costoCorrida, costoInversion };
    });

  // Por pieza
  const costoProduccionTotal = subtotalIngredientesProrateado + subtotalEnergia + manoDeObra + subtotalInsumosCorrida;
  const costoIndividual = costoProduccionTotal / presupuestoState.porciones;
  const precioMinimo = costoIndividual * (1 + presupuestoState.margen / 100);
  const gananciaPorPieza = precioMinimo - costoIndividual;

  // Inversión inicial (paquetes completos de ingredientes e insumos; energía no aplica)
  const inversionInicial = subtotalIngredientesInversion + subtotalInsumosInversion;
  const ventaTotalAPrecioMinimo = precioMinimo * presupuestoState.porciones;
  // Ganancia desde cero = lo que entra - lo que costó todo para arrancar (incluyendo energía y MO)
  const gananciaDesdeCero = ventaTotalAPrecioMinimo - inversionInicial - subtotalEnergia - manoDeObra;

  presupuestoState.resultados = {
    subtotalIngredientesProrateado, subtotalIngredientesInversion,
    subtotalEnergia, manoDeObra,
    subtotalInsumosCorrida, subtotalInsumosInversion,
    costoProduccionTotal, costoIndividual,
    precioMinimo, gananciaPorPieza,
    inversionInicial, ventaTotalAPrecioMinimo, gananciaDesdeCero,
    detalleIngredientes, detalleEnergia, detalleInsumos
  };

  renderResultados();
}

function renderResultados() {
  const r = presupuestoState.receta;
  const res = presupuestoState.resultados;
  const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

  document.getElementById('res-receta-nombre').textContent = r.nombre;
  document.getElementById('res-fecha').textContent = fecha;
  document.getElementById('res-porciones').textContent = `${presupuestoState.porciones} porciones`;

  function lineas(items, usarInversion = false) {
    if (!items || items.length === 0) return '<div class="desglose-vacio">—</div>';
    return items.map(it => `
      <div class="desglose-linea">
        <span class="desglose-nombre">${escapeHTML(it.nombre)}</span>
        <span class="desglose-valor">$${(usarInversion ? it.costoInversion : it.costo).toFixed(2)}</span>
      </div>`).join('');
  }

  // ── Inversión inicial ──
  document.getElementById('res-inv-ingredientes').innerHTML = lineas(res.detalleIngredientes, true);
  document.getElementById('res-inv-ingredientes-total').textContent = `$${res.subtotalIngredientesInversion.toFixed(2)}`;

  const secInvInsumos = document.getElementById('res-inv-insumos-seccion');
  if (res.detalleInsumos.length === 0) {
    secInvInsumos.style.display = 'none';
  } else {
    secInvInsumos.style.display = '';
    document.getElementById('res-inv-insumos').innerHTML = lineas(res.detalleInsumos, true);
    document.getElementById('res-inv-insumos-total').textContent = `$${res.subtotalInsumosInversion.toFixed(2)}`;
  }

  document.getElementById('res-inversion-total').textContent = `$${res.inversionInicial.toFixed(2)}`;
  document.getElementById('res-venta-total').textContent = `$${res.ventaTotalAPrecioMinimo.toFixed(2)}`;
  document.getElementById('res-ganancia-desde-cero').textContent = `$${res.gananciaDesdeCero.toFixed(2)}`;

  // ── Costo por pieza ──
  document.getElementById('res-ingredientes-desglose').innerHTML = lineas(res.detalleIngredientes);
  document.getElementById('res-ingredientes-total').textContent = `$${res.subtotalIngredientesProrateado.toFixed(2)}`;

  const secEnergia = document.getElementById('res-energia-seccion');
  if (res.detalleEnergia.length === 0) {
    secEnergia.style.display = 'none';
  } else {
    secEnergia.style.display = '';
    document.getElementById('res-energia-desglose').innerHTML = lineas(res.detalleEnergia);
    document.getElementById('res-energia-total').textContent = `$${res.subtotalEnergia.toFixed(2)}`;
  }

  const secMO = document.getElementById('res-mo-seccion');
  if (res.manoDeObra === 0) {
    secMO.style.display = 'none';
  } else {
    secMO.style.display = '';
    document.getElementById('res-mo-detalle').textContent =
      `${presupuestoState.horasTrabajadas}h × $${presupuestoState.tarifaHora}/h`;
    document.getElementById('res-mo-total').textContent = `$${res.manoDeObra.toFixed(2)}`;
  }

  const secInsumos = document.getElementById('res-insumos-seccion');
  if (res.detalleInsumos.length === 0) {
    secInsumos.style.display = 'none';
  } else {
    secInsumos.style.display = '';
    document.getElementById('res-insumos-desglose').innerHTML = lineas(res.detalleInsumos);
    document.getElementById('res-insumos-total').textContent = `$${res.subtotalInsumosCorrida.toFixed(2)}`;
  }

  document.getElementById('res-costo-total').textContent = `$${res.costoProduccionTotal.toFixed(2)}`;
  document.getElementById('res-costo-individual').textContent = `$${res.costoIndividual.toFixed(2)}`;
  document.getElementById('res-precio-minimo').textContent = `$${res.precioMinimo.toFixed(2)}`;
  document.getElementById('res-margen-label').textContent = `Margen ${presupuestoState.margen}% incluido`;
  document.getElementById('res-ganancia-pieza').textContent = `$${res.gananciaPorPieza.toFixed(2)}`;
  document.getElementById('res-ctx-gas').textContent = `$${presupuestoState.precioGas}/L`;
  document.getElementById('res-ctx-kwh').textContent = `$${presupuestoState.precioKwh}/kWh`;
  document.getElementById('res-ctx-margen').textContent = `${presupuestoState.margen}%`;

  mostrarPaso(5);
}

// ─── Guardar en historial ─────────────────────────────────
async function guardarEnHistorial() {
  const r = presupuestoState.receta;
  const res = presupuestoState.resultados;

  const presupuestoId = await db.resultados_presupuesto.add({
    receta_id: r.id,
    nombre_receta: r.nombre,
    porciones_calculadas: presupuestoState.porciones,
    subtotal_ingredientes: res.subtotalIngredientesProrateado,
    subtotal_energia: res.subtotalEnergia,
    mano_de_obra: res.manoDeObra,
    subtotal_insumos: res.subtotalInsumosCorrida,
    costo_produccion_total: res.costoProduccionTotal,
    costo_individual: res.costoIndividual,
    precio_minimo_sugerido: res.precioMinimo,
    ganancia_por_pieza: res.gananciaPorPieza,
    inversion_inicial: res.inversionInicial,
    ganancia_desde_cero: res.gananciaDesdeCero,
    precio_gas_usado: presupuestoState.precioGas,
    precio_kwh_usado: presupuestoState.precioKwh,
    margen_usado: presupuestoState.margen,
    fecha: new Date().toISOString()
  });

  for (const insumo of presupuestoState.insumosAdicionales) {
    if (insumo.nombre.trim()) {
      await db.insumos_adicionales.add({ presupuesto_snapshot_id: presupuestoId, nombre: insumo.nombre });
    }
  }

  mostrarToast('Guardado en historial');
  setTimeout(() => nuevoPresupuesto(), 1000);
}

// ─── Acciones del panel ───────────────────────────────────
function abrirPanelPresupuesto() {
  document.getElementById('presupuesto-panel').classList.add('visible');
}

function cerrarPanelPresupuesto() {
  document.getElementById('presupuesto-panel').classList.remove('visible');
}

function nuevoPresupuesto() {
  presupuestoState = {
    paso: 1, receta: null, porciones: 1,
    precioGas: 0, precioKwh: 0, margen: 30,
    ingredientesConPrecio: [], horasTrabajadas: 0,
    tarifaHora: 0, insumosAdicionales: [], resultados: null
  };
  renderPaso1();
}

function volverAPaso4() { renderPaso4(); }
