// presupuesto.js — flujo completo de presupuestos

let presupuestoState = {
  paso: 1,
  receta: null,
  porciones: 0,
  precioGas: 0,
  precioKwh: 0,
  margen: 30,
  ingredientesConPrecio: [],
  horasTrabajadas: 0,
  tarifaHora: 0,
  insumosAdicionales: [],
  resultados: null
};

// ─── Paso 1: Seleccionar receta ─────────────────────────
async function renderPaso1() {
  const recetas = await db.recetas.toArray();
  const container = document.getElementById('presupuesto-container');
  
  if (recetas.length === 0) {
    container.innerHTML = `
      <div class="placeholder-content">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="2"/>
        </svg>
        <p>Crea una receta primero</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="seccion-header">
      <h1>Nuevo presupuesto</h1>
      <p>Paso 1 de 4 — Seleccionar receta</p>
    </div>
    <div class="card">
      <div class="recetas-lista" id="recetas-seleccion"></div>
    </div>`;

  const lista = document.getElementById('recetas-seleccion');
  lista.innerHTML = recetas.map(r => `
    <div class="receta-item-seleccion" onclick="seleccionarReceta(${r.id})">
      <div class="receta-nombre">${escapeHTML(r.nombre)}</div>
      <div class="receta-meta">${r.porciones_base || 0} porciones</div>
    </div>`).join('');
}

async function seleccionarReceta(id) {
  const receta = await db.recetas.get(id);
  if (!receta) return;

  presupuestoState.receta = receta;
  presupuestoState.porciones = receta.porciones_base || 1;
  presupuestoState.paso = 2;

  // Precargar valores de configuración
  const gas = await db.configuracion_global.get('precio_gas');
  const kwh = await db.configuracion_global.get('precio_kwh');
  const margen = await db.configuracion_global.get('margen_ganancia');
  
  presupuestoState.precioGas = gas?.valor || 0;
  presupuestoState.precioKwh = kwh?.valor || 0;
  presupuestoState.margen = margen?.valor || 30;

  renderPaso2();
}

// ─── Paso 2: Porciones y precios energéticos ────────────
function renderPaso2() {
  const container = document.getElementById('presupuesto-container');
  const r = presupuestoState.receta;

  container.innerHTML = `
    <div class="seccion-header">
      <h1>${escapeHTML(r.nombre)}</h1>
      <p>Paso 2 de 4 — Configurar porciones y precios</p>
    </div>
    
    <div class="card">
      <div class="form-row">
        <label>Porciones a calcular</label>
        <input type="number" id="porciones-input" value="${presupuestoState.porciones}" min="1" step="1">
      </div>
      
      <div class="divider-label">Precios energéticos</div>
      
      <div class="form-row">
        <label>Precio gas (por litro)</label>
        <input type="number" id="precio-gas-input" value="${presupuestoState.precioGas}" min="0" step="any">
      </div>
      
      <div class="form-row">
        <label>Precio electricidad (kWh)</label>
        <input type="number" id="precio-kwh-input" value="${presupuestoState.precioKwh}" min="0" step="any">
      </div>
      
      <div class="form-row">
        <label>Margen de ganancia (%)</label>
        <input type="number" id="margen-input" value="${presupuestoState.margen}" min="0" step="1">
      </div>
      
      <p style="font-size:12px;color:var(--ink-3);font-style:italic;margin-top:8px">
        Precompletado desde Configuración. Modifica si el precio cambió hoy.
      </p>
      
      <button class="btn btn-primary" style="margin-top:20px" onclick="avanzarPaso3()">Continuar</button>
    </div>`;
}

async function avanzarPaso3() {
  presupuestoState.porciones = parseFloat(document.getElementById('porciones-input').value) || 1;
  presupuestoState.precioGas = parseFloat(document.getElementById('precio-gas-input').value) || 0;
  presupuestoState.precioKwh = parseFloat(document.getElementById('precio-kwh-input').value) || 0;
  presupuestoState.margen = parseFloat(document.getElementById('margen-input').value) || 30;

  presupuestoState.paso = 3;
  await renderPaso3();
}

// ─── Paso 3: Precios de ingredientes ────────────────────
async function renderPaso3() {
  const container = document.getElementById('presupuesto-container');
  const r = presupuestoState.receta;
  
  const ingredientes = await db.ingredientes_receta
    .where('receta_id').equals(r.id)
    .toArray();

  if (ingredientes.length === 0) {
    container.innerHTML = `
      <div class="seccion-header">
        <h1>${escapeHTML(r.nombre)}</h1>
        <p>Paso 3 de 4</p>
      </div>
      <div class="card">
        <p style="color:var(--ink-3);font-style:italic">Esta receta no tiene ingredientes. Continúa al siguiente paso.</p>
        <button class="btn btn-primary" style="margin-top:16px" onclick="avanzarPaso4()">Continuar</button>
      </div>`;
    presupuestoState.ingredientesConPrecio = [];
    return;
  }

  // Calcular cantidades escaladas
  const ingredientesEscalados = ingredientes.map(ing => {
    const cantidadNecesaria = ing.cantidad * (presupuestoState.porciones / r.porciones_base);
    return { ...ing, cantidadNecesaria };
  });

  presupuestoState.ingredientesConPrecio = ingredientesEscalados.map(ing => ({
    ingrediente_id: ing.id,
    ingrediente_catalogo_id: ing.ingrediente_catalogo_id,
    cantidadNecesaria: ing.cantidadNecesaria,
    unidad: ing.unidad,
    precioPaquete: 0,
    cantidadPaquete: 0
  }));

  container.innerHTML = `
    <div class="seccion-header">
      <h1>${escapeHTML(r.nombre)}</h1>
      <p>Paso 3 de 4 — Precios de ingredientes</p>
    </div>
    
    <div class="card">
      <div id="ingredientes-precio-lista"></div>
      <button class="btn btn-primary" style="margin-top:20px" id="btn-continuar-paso4" disabled onclick="avanzarPaso4()">Continuar</button>
    </div>`;

  const lista = document.getElementById('ingredientes-precio-lista');
  
  for (let i = 0; i < ingredientesEscalados.length; i++) {
    const ing = ingredientesEscalados[i];
    const catalogo = await db.ingredientes_catalogo.get(ing.ingrediente_catalogo_id);
    
    const item = document.createElement('div');
    item.className = 'ingrediente-precio-item';
    item.innerHTML = `
      <div style="margin-bottom:8px">
        <div style="font-weight:600;font-size:14px">${escapeHTML(catalogo?.nombre || 'Ingrediente')}</div>
        <div style="font-size:12px;color:var(--ink-3)">
          Necesitas: ${ing.cantidadNecesaria.toFixed(2)} ${ing.unidad || ''}
        </div>
      </div>
      <div class="form-row-inline">
        <div>
          <label style="font-size:12px">Precio del paquete</label>
          <input type="number" class="precio-paquete-input" data-index="${i}" min="0" step="any" placeholder="25">
        </div>
        <div>
          <label style="font-size:12px">Cantidad del paquete</label>
          <input type="number" class="cantidad-paquete-input" data-index="${i}" min="0" step="any" placeholder="1000">
        </div>
      </div>
      <p style="font-size:11px;color:var(--ink-3);font-style:italic;margin-top:4px">
        Ej: paquete de 1000 ${ing.unidad || 'unidades'} a $25
      </p>`;
    lista.appendChild(item);
  }

  document.querySelectorAll('.precio-paquete-input, .cantidad-paquete-input').forEach(input => {
    input.addEventListener('input', validarPaso3);
  });
}

function validarPaso3() {
  const precios = document.querySelectorAll('.precio-paquete-input');
  const cantidades = document.querySelectorAll('.cantidad-paquete-input');
  
  let todosLlenos = true;
  precios.forEach((input, i) => {
    const precio = parseFloat(input.value);
    const cantidad = parseFloat(cantidades[i].value);
    
    if (!precio || precio <= 0 || !cantidad || cantidad <= 0) {
      todosLlenos = false;
    } else {
      presupuestoState.ingredientesConPrecio[i].precioPaquete = precio;
      presupuestoState.ingredientesConPrecio[i].cantidadPaquete = cantidad;
    }
  });

  document.getElementById('btn-continuar-paso4').disabled = !todosLlenos;
}

// ─── Paso 4: Mano de obra e insumos ─────────────────────
async function avanzarPaso4() {
  presupuestoState.paso = 4;
  
  // Precargar tarifa de mano de obra
  const salario = await db.configuracion_global.get('salario_minimo_hora');
  const multiplicador = await db.configuracion_global.get('multiplicador_mano_obra');
  presupuestoState.tarifaHora = (salario?.valor || 0) * (multiplicador?.valor || 2);
  presupuestoState.horasTrabajadas = 0;
  presupuestoState.insumosAdicionales = [];

  renderPaso4();
}

function renderPaso4() {
  const container = document.getElementById('presupuesto-container');
  const r = presupuestoState.receta;

  container.innerHTML = `
    <div class="seccion-header">
      <h1>${escapeHTML(r.nombre)}</h1>
      <p>Paso 4 de 4 — Mano de obra e insumos</p>
    </div>
    
    <div class="card">
      <div class="card-title">Mano de obra</div>
      
      <div class="form-row">
        <label>Horas trabajadas</label>
        <input type="number" id="horas-input" value="${presupuestoState.horasTrabajadas}" min="0" step="0.1" oninput="actualizarManoObra()">
      </div>
      
      <div class="form-row">
        <label>Tarifa por hora</label>
        <input type="number" id="tarifa-input" value="${presupuestoState.tarifaHora}" min="0" step="any" oninput="actualizarManoObra()">
      </div>
      
      <div id="mano-obra-total" style="font-size:14px;color:var(--ink-2);margin-top:8px;font-family:var(--font-mono)">
        Mano de obra: $0
      </div>
    </div>
    
    <div class="card">
      <div class="card-title">Insumos adicionales</div>
      <div id="insumos-lista"></div>
      <button class="btn btn-secondary" style="margin-top:14px" onclick="agregarInsumo()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Agregar insumo
      </button>
    </div>
    
    <button class="btn btn-primary" onclick="calcularResultados()">Calcular</button>`;

  actualizarManoObra();
  renderInsumosLista();
}

function actualizarManoObra() {
  const horas = parseFloat(document.getElementById('horas-input')?.value) || 0;
  const tarifa = parseFloat(document.getElementById('tarifa-input')?.value) || 0;
  
  presupuestoState.horasTrabajadas = horas;
  presupuestoState.tarifaHora = tarifa;
  
  const total = horas * tarifa;
  const display = document.getElementById('mano-obra-total');
  if (display) {
    display.textContent = `Mano de obra: $${total.toFixed(2)}`;
  }
}

function agregarInsumo() {
  presupuestoState.insumosAdicionales.push({
    id: Date.now(),
    nombre: '',
    costoPorPieza: 0
  });
  renderInsumosLista();
}

function renderInsumosLista() {
  const lista = document.getElementById('insumos-lista');
  if (!lista) return;

  if (presupuestoState.insumosAdicionales.length === 0) {
    lista.innerHTML = '<p style="font-size:13px;color:var(--ink-3);font-style:italic">Sin insumos adicionales</p>';
    return;
  }

  lista.innerHTML = presupuestoState.insumosAdicionales.map((insumo, i) => {
    const subtotal = insumo.costoPorPieza * presupuestoState.porciones;
    return `
      <div class="insumo-item" style="padding:12px 0;border-bottom:1px solid var(--border)">
        <div class="form-row-inline" style="margin-bottom:8px">
          <div>
            <label style="font-size:12px">Nombre</label>
            <input type="text" value="${escapeHTML(insumo.nombre)}" oninput="actualizarInsumo(${i}, 'nombre', this.value)" placeholder="Ej: Caja">
          </div>
          <div>
            <label style="font-size:12px">Costo por pieza</label>
            <input type="number" value="${insumo.costoPorPieza}" min="0" step="any" oninput="actualizarInsumo(${i}, 'costo', parseFloat(this.value))">
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12px;color:var(--ink-3);font-family:var(--font-mono)">
            Subtotal: $${subtotal.toFixed(2)}
          </span>
          <button class="btn-icon btn-delete" onclick="eliminarInsumo(${i})" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
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
    presupuestoState.insumosAdicionales[index].costoPorPieza = valor || 0;
    renderInsumosLista();
  }
}

function eliminarInsumo(index) {
  presupuestoState.insumosAdicionales.splice(index, 1);
  renderInsumosLista();
}

// ─── Paso 5: Resultados ──────────────────────────────────
async function calcularResultados() {
  const r = presupuestoState.receta;
  
  // Subtotal ingredientes y costo total para iniciar
  let subtotalIngredientes = 0;
  let costoTotalInicio = 0;
  
  presupuestoState.ingredientesConPrecio.forEach(ing => {
    const costoIngrediente = (ing.cantidadNecesaria / ing.cantidadPaquete) * ing.precioPaquete;
    subtotalIngredientes += costoIngrediente;
    costoTotalInicio += ing.precioPaquete;
  });

  // Subtotal energía
  let subtotalEnergia = 0;
  const procesos = await db.procesos_receta.where('receta_id').equals(r.id).toArray();
  
  for (const proceso of procesos) {
    if (!proceso.equipo_id) continue;
    
    const equipo = await db.equipos.get(proceso.equipo_id);
    if (!equipo) continue;

    if (equipo.tipo_energia === 'gas') {
      // (litros_por_hora / 60) * minutos * precio_gas
      const costo = (equipo.consumo_unitario / 60) * proceso.minutos * presupuestoState.precioGas;
      subtotalEnergia += costo;
    } else if (equipo.tipo_energia === 'electrico') {
      // (watts / 1000 / 60) * minutos * precio_kwh
      const costo = (equipo.consumo_unitario / 1000 / 60) * proceso.minutos * presupuestoState.precioKwh;
      subtotalEnergia += costo;
    }
  }

  // Mano de obra
  const manoDeObra = presupuestoState.horasTrabajadas * presupuestoState.tarifaHora;

  // Subtotal insumos adicionales
  const subtotalInsumos = presupuestoState.insumosAdicionales.reduce((sum, insumo) => {
    return sum + (insumo.costoPorPieza * presupuestoState.porciones);
  }, 0);

  // Costo individual
  const costoIndividual = (subtotalIngredientes + subtotalEnergia + manoDeObra + subtotalInsumos) / presupuestoState.porciones;

  // Precio mínimo sugerido
  const precioMinimo = costoIndividual * (1 + presupuestoState.margen / 100);

  // Ganancias
  const gananciaDesdeCero = (precioMinimo * presupuestoState.porciones) - costoTotalInicio;
  const gananciaPromedio = precioMinimo - costoIndividual;

  presupuestoState.resultados = {
    subtotalIngredientes,
    subtotalEnergia,
    manoDeObra,
    subtotalInsumos,
    costoTotalInicio,
    costoIndividual,
    precioMinimo,
    gananciaDesdeCero,
    gananciaPromedio
  };

  renderResultados();
}

function renderResultados() {
  const container = document.getElementById('presupuesto-container');
  const r = presupuestoState.receta;
  const res = presupuestoState.resultados;
  const fecha = new Date().toLocaleDateString('es-ES');

  container.innerHTML = `
    <div class="resultados-zona-imprimible">
      <div class="seccion-header" style="border-bottom:2px solid var(--border-dark)">
        <h1 style="font-size:24px">${escapeHTML(r.nombre)}</h1>
        <div style="display:flex;justify-content:space-between;margin-top:8px">
          <p style="margin:0">Porciones: ${presupuestoState.porciones}</p>
          <p style="margin:0">${fecha}</p>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Desglose de costos</div>
        <div class="resultado-linea">
          <span>Subtotal ingredientes</span>
          <span>$${res.subtotalIngredientes.toFixed(2)}</span>
        </div>
        <div class="resultado-linea">
          <span>Subtotal energía</span>
          <span>$${res.subtotalEnergia.toFixed(2)}</span>
        </div>
        <div class="resultado-linea">
          <span>Mano de obra</span>
          <span>$${res.manoDeObra.toFixed(2)}</span>
        </div>
        <div class="resultado-linea">
          <span>Subtotal insumos adicionales</span>
          <span>$${res.subtotalInsumos.toFixed(2)}</span>
        </div>
        <div class="resultado-linea" style="border-top:2px solid var(--border-dark);margin-top:8px;padding-top:8px;font-weight:600;font-size:16px">
          <span>Total costos de producción</span>
          <span>$${(res.subtotalIngredientes + res.subtotalEnergia + res.manoDeObra + res.subtotalInsumos).toFixed(2)}</span>
        </div>
      </div>

      <div class="card resultados-principales">
        <div class="resultado-principal">
          <div class="resultado-icono">💰</div>
          <div>
            <div class="resultado-label">Costo total para iniciar</div>
            <div class="resultado-valor">$${res.costoTotalInicio.toFixed(2)}</div>
          </div>
        </div>
        
        <div class="resultado-principal">
          <div class="resultado-icono">🧮</div>
          <div>
            <div class="resultado-label">Costo individual por pieza</div>
            <div class="resultado-valor">$${res.costoIndividual.toFixed(2)}</div>
          </div>
        </div>
        
        <div class="resultado-principal">
          <div class="resultado-icono">📊</div>
          <div>
            <div class="resultado-label">Precio mínimo sugerido (+${presupuestoState.margen}%)</div>
            <div class="resultado-valor">$${res.precioMinimo.toFixed(2)}</div>
          </div>
        </div>
        
        <div class="resultado-principal">
          <div class="resultado-icono">📈</div>
          <div>
            <div class="resultado-label">Ganancia esperada desde cero</div>
            <div class="resultado-valor">$${res.gananciaDesdeCero.toFixed(2)}</div>
          </div>
        </div>
        
        <div class="resultado-principal">
          <div class="resultado-icono">✅</div>
          <div>
            <div class="resultado-label">Ganancia promedio por pieza</div>
            <div class="resultado-valor">$${res.gananciaPromedio.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Contexto usado</div>
        <div class="resultado-linea">
          <span>Precio gas</span>
          <span>$${presupuestoState.precioGas}/litro</span>
        </div>
        <div class="resultado-linea">
          <span>Precio electricidad</span>
          <span>$${presupuestoState.precioKwh}/kWh</span>
        </div>
        <div class="resultado-linea">
          <span>Margen aplicado</span>
          <span>${presupuestoState.margen}%</span>
        </div>
      </div>
    </div>

    <div class="resultados-acciones">
      <button class="btn btn-primary" onclick="guardarEnHistorial()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
        </svg>
        Guardar en historial
      </button>
      <div class="backup-row">
        <button class="btn btn-secondary" onclick="volverEditar()">Volver a editar</button>
        <button class="btn btn-secondary" onclick="nuevoPresupuesto()">Nuevo presupuesto</button>
      </div>
    </div>`;
}

async function guardarEnHistorial() {
  const r = presupuestoState.receta;
  const res = presupuestoState.resultados;

  const snapshot = {
    receta_id: r.id,
    nombre_receta: r.nombre,
    porciones_calculadas: presupuestoState.porciones,
    subtotal_ingredientes: res.subtotalIngredientes,
    subtotal_energia: res.subtotalEnergia,
    mano_de_obra: res.manoDeObra,
    subtotal_insumos: res.subtotalInsumos,
    costo_total_inicio: res.costoTotalInicio,
    costo_individual: res.costoIndividual,
    precio_minimo_sugerido: res.precioMinimo,
    ganancia_desde_cero: res.gananciaDesdeCero,
    ganancia_promedio: res.gananciaPromedio,
    precio_gas_usado: presupuestoState.precioGas,
    precio_kwh_usado: presupuestoState.precioKwh,
    margen_usado: presupuestoState.margen,
    fecha: new Date().toISOString()
  };

  await db.resultados_presupuesto.add(snapshot);
  
  // Guardar insumos adicionales con referencia al presupuesto
  const presupuestoId = await db.resultados_presupuesto.orderBy('id').last().then(p => p.id);
  for (const insumo of presupuestoState.insumosAdicionales) {
    if (insumo.nombre.trim()) {
      await db.insumos_adicionales.add({
        presupuesto_snapshot_id: presupuestoId,
        nombre: insumo.nombre
      });
    }
  }

  mostrarToast('Presupuesto guardado en historial');
  setTimeout(() => nuevoPresupuesto(), 1000);
}

function volverEditar() {
  presupuestoState.paso = 4;
  renderPaso4();
}

function nuevoPresupuesto() {
  presupuestoState = {
    paso: 1,
    receta: null,
    porciones: 0,
    precioGas: 0,
    precioKwh: 0,
    margen: 30,
    ingredientesConPrecio: [],
    horasTrabajadas: 0,
    tarifaHora: 0,
    insumosAdicionales: [],
    resultados: null
  };
  renderPaso1();
}

// ─── Init al cargar sección ──────────────────────────────
function initPresupuesto() {
  renderPaso1();
}
