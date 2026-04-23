// presupuesto.js — flujo completo de presupuestos

// ─── Estado del flujo ───────────────────────────────────
let presupuestoState = {
  paso: 0,
  receta: null,
  porciones: 0,
  precioGas: 0,
  precioKwh: 0,
  margen: 30,
  ingredientes: [], // { id, nombre, cantidadNecesaria, unidad, precioPaquete, cantidadPaquete }
  horasTrabajadas: 0,
  tarifaHora: 0,
  insumosAdicionales: [], // { nombre, costoPorPieza }
  resultados: null
};

// ─── Paso 1: Seleccionar receta ────────────────────────
async function iniciarPresupuesto() {
  presupuestoState = {
    paso: 1,
    receta: null,
    porciones: 0,
    precioGas: 0,
    precioKwh: 0,
    margen: 30,
    ingredientes: [],
    horasTrabajadas: 0,
    tarifaHora: 0,
    insumosAdicionales: [],
    resultados: null
  };
  
  await renderPaso1();
}

async function renderPaso1() {
  const container = document.getElementById('presupuesto-container');
  const recetas = await db.recetas.toArray();
  
  if (recetas.length === 0) {
    container.innerHTML = `
      <div class="placeholder-content">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="2"/>
        </svg>
        <p>No hay recetas disponibles</p>
        <button class="btn btn-secondary" onclick="navegarA('sec-recetario')" style="margin-top:16px">
          Crear una receta
        </button>
      </div>`;
    return;
  }
  
  container.innerHTML = `
    <div class="seccion-header">
      <h1>Nuevo Presupuesto</h1>
      <p>Paso 1 de 4 · Selecciona una receta</p>
    </div>
    
    <div class="card">
      <div id="lista-recetas-presupuesto"></div>
    </div>`;
  
  const lista = document.getElementById('lista-recetas-presupuesto');
  lista.innerHTML = recetas.map(r => `
    <div class="receta-item" onclick="seleccionarRecetaPresupuesto(${r.id})">
      <div class="receta-info">
        <div class="receta-nombre">${escapeHTML(r.nombre)}</div>
        <div class="receta-meta">${r.porciones_base} porciones · ${r.categoria || 'Sin categoría'}</div>
      </div>
      <svg class="receta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>`).join('');
}

async function seleccionarRecetaPresupuesto(recetaId) {
  const receta = await db.recetas.get(recetaId);
  if (!receta) return;
  
  presupuestoState.receta = receta;
  presupuestoState.porciones = receta.porciones_base;
  presupuestoState.paso = 2;
  
  // Precargar config global
  const cfgGas = await db.configuracion_global.get('precio_gas');
  const cfgKwh = await db.configuracion_global.get('precio_kwh');
  const cfgMargen = await db.configuracion_global.get('margen_ganancia');
  const cfgSalario = await db.configuracion_global.get('salario_minimo_hora');
  const cfgMultiplicador = await db.configuracion_global.get('multiplicador_mano_obra');
  
  presupuestoState.precioGas = cfgGas?.valor || 0;
  presupuestoState.precioKwh = cfgKwh?.valor || 0;
  presupuestoState.margen = cfgMargen?.valor || 30;
  presupuestoState.tarifaHora = (cfgSalario?.valor || 0) * (cfgMultiplicador?.valor || 2);
  
  await renderPaso2();
}

// ─── Paso 2: Porciones y precios energéticos ───────────
async function renderPaso2() {
  const container = document.getElementById('presupuesto-container');
  const r = presupuestoState.receta;
  
  container.innerHTML = `
    <div class="seccion-header">
      <h1>Nuevo Presupuesto</h1>
      <p>Paso 2 de 4 · Configuración</p>
    </div>
    
    <div class="card">
      <div class="card-title">Receta seleccionada</div>
      <div class="form-row">
        <label>Nombre</label>
        <input type="text" value="${escapeHTML(r.nombre)}" disabled>
      </div>
      
      <div class="form-row">
        <label for="pres-porciones">Porciones a calcular</label>
        <input type="number" id="pres-porciones" min="1" step="1" value="${presupuestoState.porciones}">
      </div>
    </div>
    
    <div class="card">
      <div class="card-title">Precios energéticos</div>
      <p style="font-size:12px;color:var(--ink-3);font-style:italic;margin-bottom:14px">
        Precompletado desde Configuración. Modifica si el precio cambió hoy.
      </p>
      
      <div class="form-row">
        <label for="pres-gas">Precio del gas (por litro)</label>
        <input type="number" id="pres-gas" min="0" step="any" value="${presupuestoState.precioGas}">
      </div>
      
      <div class="form-row">
        <label for="pres-kwh">Precio electricidad (kWh)</label>
        <input type="number" id="pres-kwh" min="0" step="any" value="${presupuestoState.precioKwh}">
      </div>
      
      <div class="form-row">
        <label for="pres-margen">Margen de ganancia (%)</label>
        <input type="number" id="pres-margen" min="0" step="1" value="${presupuestoState.margen}">
      </div>
      
      <button class="btn btn-primary" onclick="avanzarAPaso3()">Continuar</button>
    </div>`;
}

async function avanzarAPaso3() {
  const porciones = parseFloat(document.getElementById('pres-porciones').value) || 0;
  const gas = parseFloat(document.getElementById('pres-gas').value) || 0;
  const kwh = parseFloat(document.getElementById('pres-kwh').value) || 0;
  const margen = parseFloat(document.getElementById('pres-margen').value) || 0;
  
  if (porciones <= 0) {
    mostrarToast('Las porciones deben ser mayor a cero');
    return;
  }
  
  presupuestoState.porciones = porciones;
  presupuestoState.precioGas = gas;
  presupuestoState.precioKwh = kwh;
  presupuestoState.margen = margen;
  presupuestoState.paso = 3;
  
  // Cargar ingredientes y calcular cantidades necesarias
  const ingredientesReceta = await db.ingredientes_receta
    .where('receta_id').equals(presupuestoState.receta.id)
    .toArray();
  
  presupuestoState.ingredientes = await Promise.all(
    ingredientesReceta.map(async (ir) => {
      const catalogo = await db.ingredientes_catalogo.get(ir.ingrediente_catalogo_id);
      const cantidadNecesaria = ir.cantidad * (presupuestoState.porciones / presupuestoState.receta.porciones_base);
      
      return {
        id: ir.id,
        nombre: catalogo?.nombre || 'Ingrediente desconocido',
        cantidadNecesaria: cantidadNecesaria,
        unidad: ir.unidad,
        precioPaquete: 0,
        cantidadPaquete: 0
      };
    })
  );
  
  await renderPaso3();
}

// ─── Paso 3: Precios de ingredientes ────────────────────
async function renderPaso3() {
  const container = document.getElementById('presupuesto-container');
  
  if (presupuestoState.ingredientes.length === 0) {
    container.innerHTML = `
      <div class="seccion-header">
        <h1>Nuevo Presupuesto</h1>
        <p>Paso 3 de 4 · Ingredientes</p>
      </div>
      
      <div class="card">
        <p style="text-align:center;color:var(--ink-3);padding:20px 0">
          Esta receta no tiene ingredientes registrados.
        </p>
        <button class="btn btn-primary" onclick="avanzarAPaso4()">Continuar</button>
      </div>`;
    return;
  }
  
  container.innerHTML = `
    <div class="seccion-header">
      <h1>Nuevo Presupuesto</h1>
      <p>Paso 3 de 4 · Ingredientes</p>
    </div>
    
    <div class="card">
      <div class="card-title">Precios de ingredientes</div>
      <p style="font-size:12px;color:var(--ink-3);font-style:italic;margin-bottom:14px">
        Ejemplo: paquete de 1000 gr a $25
      </p>
      
      <div id="lista-ingredientes-precio"></div>
      
      <button class="btn btn-primary" onclick="avanzarAPaso4()" style="margin-top:16px">
        Continuar
      </button>
    </div>`;
  
  const lista = document.getElementById('lista-ingredientes-precio');
  lista.innerHTML = presupuestoState.ingredientes.map((ing, i) => `
    <div class="ingrediente-precio-item">
      <div class="ingrediente-precio-header">
        <strong>${escapeHTML(ing.nombre)}</strong>
        <span style="color:var(--ink-3);font-size:13px">
          ${ing.cantidadNecesaria.toFixed(2)} ${ing.unidad}
        </span>
      </div>
      <div class="form-row-inline" style="margin-top:8px">
        <div>
          <label>Precio paquete</label>
          <input type="number" id="precio-${i}" min="0" step="any" 
            value="${ing.precioPaquete || ''}" placeholder="0">
        </div>
        <div>
          <label>Cantidad paquete</label>
          <input type="number" id="cantidad-${i}" min="0" step="any" 
            value="${ing.cantidadPaquete || ''}" placeholder="0">
        </div>
      </div>
    </div>
  `).join('');
}

async function avanzarAPaso4() {
  // Capturar precios
  let hayErrores = false;
  
  presupuestoState.ingredientes.forEach((ing, i) => {
    const precio = parseFloat(document.getElementById(`precio-${i}`)?.value) || 0;
    const cantidad = parseFloat(document.getElementById(`cantidad-${i}`)?.value) || 0;
    
    if (precio <= 0 || cantidad <= 0) {
      hayErrores = true;
    }
    
    ing.precioPaquete = precio;
    ing.cantidadPaquete = cantidad;
  });
  
  if (hayErrores && presupuestoState.ingredientes.length > 0) {
    mostrarToast('Completa todos los precios y cantidades');
    return;
  }
  
  presupuestoState.paso = 4;
  await renderPaso4();
}

// ─── Paso 4: Mano de obra e insumos ────────────────────
async function renderPaso4() {
  const container = document.getElementById('presupuesto-container');
  
  container.innerHTML = `
    <div class="seccion-header">
      <h1>Nuevo Presupuesto</h1>
      <p>Paso 4 de 4 · Mano de obra e insumos</p>
    </div>
    
    <div class="card">
      <div class="card-title">Mano de obra</div>
      
      <div class="form-row">
        <label for="pres-horas">Horas trabajadas</label>
        <input type="number" id="pres-horas" min="0" step="0.1" 
          value="${presupuestoState.horasTrabajadas}" 
          oninput="actualizarManoObraPreview()">
      </div>
      
      <div class="form-row">
        <label for="pres-tarifa">Tarifa por hora</label>
        <input type="number" id="pres-tarifa" min="0" step="any" 
          value="${presupuestoState.tarifaHora}" 
          oninput="actualizarManoObraPreview()">
      </div>
      
      <div id="mano-obra-preview" style="font-size:14px;color:var(--ink-2);margin-top:8px"></div>
    </div>
    
    <div class="card">
      <div class="card-title">Insumos adicionales</div>
      <p style="font-size:12px;color:var(--ink-3);font-style:italic;margin-bottom:14px">
        Empaques, etiquetas, cajas, etc. El costo se multiplica por las porciones.
      </p>
      
      <div id="lista-insumos-adicionales"></div>
      
      <button class="btn btn-secondary" onclick="agregarInsumoAdicional()" style="margin-top:12px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Agregar insumo
      </button>
    </div>
    
    <button class="btn btn-primary" onclick="calcularPresupuesto()">Calcular presupuesto</button>`;
  
  actualizarManoObraPreview();
  renderInsumosAdicionales();
}

function actualizarManoObraPreview() {
  const horas = parseFloat(document.getElementById('pres-horas')?.value) || 0;
  const tarifa = parseFloat(document.getElementById('pres-tarifa')?.value) || 0;
  const total = horas * tarifa;
  
  const preview = document.getElementById('mano-obra-preview');
  if (preview) {
    preview.textContent = `Mano de obra: $${total.toFixed(2)}`;
  }
}

function agregarInsumoAdicional() {
  presupuestoState.insumosAdicionales.push({ nombre: '', costoPorPieza: 0 });
  renderInsumosAdicionales();
}

function eliminarInsumoAdicional(index) {
  presupuestoState.insumosAdicionales.splice(index, 1);
  renderInsumosAdicionales();
}

function renderInsumosAdicionales() {
  const lista = document.getElementById('lista-insumos-adicionales');
  if (!lista) return;
  
  if (presupuestoState.insumosAdicionales.length === 0) {
    lista.innerHTML = '<p style="color:var(--ink-3);font-size:13px;font-style:italic">Aún no hay insumos adicionales.</p>';
    return;
  }
  
  lista.innerHTML = presupuestoState.insumosAdicionales.map((insumo, i) => `
    <div class="insumo-adicional-item">
      <div class="form-row-inline">
        <div style="flex:2">
          <label>Nombre</label>
          <input type="text" id="insumo-nombre-${i}" value="${escapeHTML(insumo.nombre)}" placeholder="Ej: Caja">
        </div>
        <div style="flex:1">
          <label>Costo por pieza</label>
          <input type="number" id="insumo-costo-${i}" min="0" step="any" 
            value="${insumo.costoPorPieza || ''}" placeholder="0"
            oninput="actualizarInsumoSubtotal(${i})">
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        <span id="insumo-subtotal-${i}" style="font-size:13px;color:var(--ink-2)"></span>
        <button class="btn-icon btn-delete" onclick="eliminarInsumoAdicional(${i})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
  
  presupuestoState.insumosAdicionales.forEach((_, i) => actualizarInsumoSubtotal(i));
}

function actualizarInsumoSubtotal(index) {
  const costo = parseFloat(document.getElementById(`insumo-costo-${index}`)?.value) || 0;
  const subtotal = costo * presupuestoState.porciones;
  const span = document.getElementById(`insumo-subtotal-${index}`);
  if (span) {
    span.textContent = `Subtotal: $${subtotal.toFixed(2)} (${presupuestoState.porciones} porciones)`;
  }
}

// ─── Cálculos ────────────────────────────────────────────
async function calcularPresupuesto() {
  // Capturar datos finales
  presupuestoState.horasTrabajadas = parseFloat(document.getElementById('pres-horas').value) || 0;
  presupuestoState.tarifaHora = parseFloat(document.getElementById('pres-tarifa').value) || 0;
  
  presupuestoState.insumosAdicionales.forEach((insumo, i) => {
    insumo.nombre = document.getElementById(`insumo-nombre-${i}`)?.value || '';
    insumo.costoPorPieza = parseFloat(document.getElementById(`insumo-costo-${i}`)?.value) || 0;
  });
  
  // Calcular subtotal ingredientes
  let subtotalIngredientes = 0;
  let costoTotalInicio = 0;
  
  presupuestoState.ingredientes.forEach(ing => {
    const costoIngrediente = (ing.cantidadNecesaria / ing.cantidadPaquete) * ing.precioPaquete;
    subtotalIngredientes += costoIngrediente;
    costoTotalInicio += ing.precioPaquete; // Paquete completo
  });
  
  // Calcular subtotal energía
  let subtotalEnergia = 0;
  const procesos = await db.procesos_receta
    .where('receta_id').equals(presupuestoState.receta.id)
    .toArray();
  
  for (const proceso of procesos) {
    if (!proceso.equipo_id) continue;
    
    const equipo = await db.equipos.get(proceso.equipo_id);
    if (!equipo || !equipo.consumo_unitario || equipo.consumo_unitario <= 0) continue;
    
    let costoProceso = 0;
    if (equipo.tipo_energia === 'gas') {
      // (litros_por_hora / 60) * minutos * precio_gas
      costoProceso = (equipo.consumo_unitario / 60) * proceso.duracion_minutos * presupuestoState.precioGas;
    } else {
      // (watts / 1000 / 60) * minutos * precio_kwh
      costoProceso = (equipo.consumo_unitario / 1000 / 60) * proceso.duracion_minutos * presupuestoState.precioKwh;
    }
    subtotalEnergia += costoProceso;
  }
  
  // Calcular mano de obra
  const manoDeObra = presupuestoState.horasTrabajadas * presupuestoState.tarifaHora;
  
  // Calcular subtotal insumos adicionales
  const subtotalInsumos = presupuestoState.insumosAdicionales.reduce((acc, insumo) => {
    return acc + (insumo.costoPorPieza * presupuestoState.porciones);
  }, 0);
  
  // Costo individual
  const costoIndividual = (subtotalIngredientes + subtotalEnergia + manoDeObra + subtotalInsumos) / presupuestoState.porciones;
  
  // Precio mínimo sugerido
  const precioMinimo = costoIndividual * (1 + presupuestoState.margen / 100);
  
  // Ganancia desde cero
  const gananciaDesdeaCero = (precioMinimo * presupuestoState.porciones) - costoTotalInicio;
  
  // Ganancia promedio
  const gananciaPromedio = precioMinimo - costoIndividual;
  
  presupuestoState.resultados = {
    subtotalIngredientes,
    subtotalEnergia,
    manoDeObra,
    subtotalInsumos,
    costoTotalInicio,
    costoIndividual,
    precioMinimo,
    gananciaDesdeaCero,
    gananciaPromedio
  };
  
  presupuestoState.paso = 5;
  await renderResultados();
}

// ─── Paso 5: Resultados ─────────────────────────────────
async function renderResultados() {
  const container = document.getElementById('presupuesto-container');
  const r = presupuestoState.resultados;
  const fechaHoy = new Date().toLocaleDateString('es-ES', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
  
  container.innerHTML = `
    <div class="presupuesto-resultados">
      <!-- Encabezado -->
      <div class="resultado-header">
        <h2>${escapeHTML(presupuestoState.receta.nombre)}</h2>
        <div class="resultado-meta">
          ${presupuestoState.porciones} porciones · ${fechaHoy}
        </div>
      </div>
      
      <!-- Desglose -->
      <div class="resultado-seccion">
        <h3>Desglose de costos</h3>
        <div class="resultado-tabla">
          <div class="resultado-fila">
            <span>Subtotal ingredientes</span>
            <span>$${r.subtotalIngredientes.toFixed(2)}</span>
          </div>
          <div class="resultado-fila">
            <span>Subtotal energía</span>
            <span>$${r.subtotalEnergia.toFixed(2)}</span>
          </div>
          <div class="resultado-fila">
            <span>Mano de obra</span>
            <span>$${r.manoDeObra.toFixed(2)}</span>
          </div>
          <div class="resultado-fila">
            <span>Subtotal insumos adicionales</span>
            <span>$${r.subtotalInsumos.toFixed(2)}</span>
          </div>
          <div class="resultado-fila resultado-total">
            <span><strong>Total costos de producción</strong></span>
            <span><strong>$${(r.subtotalIngredientes + r.subtotalEnergia + r.manoDeObra + r.subtotalInsumos).toFixed(2)}</strong></span>
          </div>
        </div>
      </div>
      
      <!-- Resultados principales -->
      <div class="resultado-seccion">
        <h3>Resultados principales</h3>
        <div class="resultado-principales">
          <div class="resultado-card">
            <div class="resultado-emoji">💰</div>
            <div class="resultado-label">Costo total para iniciar</div>
            <div class="resultado-valor">$${r.costoTotalInicio.toFixed(2)}</div>
          </div>
          
          <div class="resultado-card">
            <div class="resultado-emoji">🧮</div>
            <div class="resultado-label">Costo individual por pieza</div>
            <div class="resultado-valor">$${r.costoIndividual.toFixed(2)}</div>
          </div>
          
          <div class="resultado-card destacado">
            <div class="resultado-emoji">📊</div>
            <div class="resultado-label">Precio mínimo sugerido (+${presupuestoState.margen}%)</div>
            <div class="resultado-valor">$${r.precioMinimo.toFixed(2)}</div>
          </div>
          
          <div class="resultado-card">
            <div class="resultado-emoji">📈</div>
            <div class="resultado-label">Ganancia esperada desde cero</div>
            <div class="resultado-valor">$${r.gananciaDesdeaCero.toFixed(2)}</div>
          </div>
          
          <div class="resultado-card">
            <div class="resultado-emoji">✅</div>
            <div class="resultado-label">Ganancia promedio por pieza</div>
            <div class="resultado-valor">$${r.gananciaPromedio.toFixed(2)}</div>
          </div>
        </div>
      </div>
      
      <!-- Contexto -->
      <div class="resultado-seccion">
        <h3>Contexto usado</h3>
        <div class="resultado-contexto">
          <div>Precio gas: $${presupuestoState.precioGas.toFixed(2)}/litro</div>
          <div>Precio electricidad: $${presupuestoState.precioKwh.toFixed(2)}/kWh</div>
          <div>Margen aplicado: ${presupuestoState.margen}%</div>
        </div>
      </div>
    </div>
    
    <!-- Botones fuera de zona imprimible -->
    <div class="resultado-acciones">
      <button class="btn btn-primary" onclick="guardarEnHistorial()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
        </svg>
        Guardar en historial
      </button>
      <button class="btn btn-secondary" onclick="iniciarPresupuesto()">Nuevo presupuesto</button>
      <button class="btn btn-ghost" onclick="volverAPaso4()">Volver a editar</button>
    </div>`;
}

function volverAPaso4() {
  presupuestoState.paso = 4;
  renderPaso4();
}

async function guardarEnHistorial() {
  const r = presupuestoState.resultados;
  
  const snapshot = {
    receta_id: presupuestoState.receta.id,
    nombre_receta: presupuestoState.receta.nombre,
    porciones_calculadas: presupuestoState.porciones,
    subtotal_ingredientes: r.subtotalIngredientes,
    subtotal_energia: r.subtotalEnergia,
    mano_de_obra: r.manoDeObra,
    subtotal_insumos: r.subtotalInsumos,
    costo_total_inicio: r.costoTotalInicio,
    costo_individual: r.costoIndividual,
    precio_minimo_sugerido: r.precioMinimo,
    ganancia_desde_cero: r.gananciaDesdeaCero,
    ganancia_promedio: r.gananciaPromedio,
    precio_gas_usado: presupuestoState.precioGas,
    precio_kwh_usado: presupuestoState.precioKwh,
    margen_usado: presupuestoState.margen,
    fecha: new Date().toISOString()
  };
  
  try {
    await db.resultados_presupuesto.add(snapshot);
    mostrarToast('Presupuesto guardado en historial');
    iniciarPresupuesto();
  } catch (e) {
    mostrarToast('Error al guardar');
    console.error(e);
  }
}

// ─── Init ───────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.iniciarPresupuesto = iniciarPresupuesto;
  window.seleccionarRecetaPresupuesto = seleccionarRecetaPresupuesto;
  window.avanzarAPaso3 = avanzarAPaso3;
  window.avanzarAPaso4 = avanzarAPaso4;
  window.actualizarManoObraPreview = actualizarManoObraPreview;
  window.agregarInsumoAdicional = agregarInsumoAdicional;
  window.eliminarInsumoAdicional = eliminarInsumoAdicional;
  window.actualizarInsumoSubtotal = actualizarInsumoSubtotal;
  window.calcularPresupuesto = calcularPresupuesto;
  window.volverAPaso4 = volverAPaso4;
  window.guardarEnHistorial = guardarEnHistorial;
}
