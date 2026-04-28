// historial.js — Módulo 4: Historial de presupuestos

// ─── Formateo ─────────────────────────────────────────────
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function formatFecha(isoStr) {
  const d = new Date(isoStr);
  return `${String(d.getDate()).padStart(2,'0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatMoneda(n) {
  return '$' + (parseFloat(n) || 0).toFixed(2);
}

// ─── Renderizado principal del historial ──────────────────
async function renderHistorial() {
  const contenedor = document.getElementById('historial-contenido');
  if (!contenedor) return;

  const todos = await db.resultados_presupuesto.toArray();

  if (todos.length === 0) {
    contenedor.innerHTML = `
      <div class="placeholder-content">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <p>Aún no hay presupuestos guardados.</p>
        <p style="font-family:var(--font-body);font-style:italic;font-size:13px;color:var(--ink-3);text-transform:none;letter-spacing:0;margin-top:-8px">Genera uno desde la sección Presupuesto.</p>
      </div>`;
    return;
  }

  // Agrupar por nombre_receta
  const grupos = {};
  for (const r of todos) {
    const key = r.nombre_receta || 'Sin nombre';
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(r);
  }

  // Ordenar registros dentro de cada grupo por fecha descendente
  for (const key of Object.keys(grupos)) {
    grupos[key].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }

  // Ordenar grupos por la fecha más reciente de cada uno
  const gruposOrdenados = Object.entries(grupos).sort((a, b) => {
    return new Date(b[1][0].fecha) - new Date(a[1][0].fecha);
  });

  let html = '';
  for (const [nombreReceta, registros] of gruposOrdenados) {
    const mostrarTendencia = registros.length >= 2;
    const itemsHtml = registros.map(r => `
      <div class="historial-item" onclick="abrirDetalleHistorial(${r.id})">
        <span class="historial-fecha">${formatFecha(r.fecha)}</span>
        <span class="historial-costo">${formatMoneda(r.costo_individual)}/pza</span>
        <span class="historial-minimo">${formatMoneda(r.precio_minimo_sugerido)} mínimo</span>
        <svg class="historial-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>`).join('');

    html += `
      <div class="historial-grupo card">
        <div class="card-title historial-grupo-nombre">${escapeHTML(nombreReceta)}</div>
        <div class="historial-items">${itemsHtml}</div>
        ${mostrarTendencia ? `
        <button class="btn btn-ghost historial-btn-tendencia" onclick="abrirTendencia(${JSON.stringify(nombreReceta).replace(/"/g, '&quot;')})">
          Ver tendencia
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>` : ''}
      </div>`;
  }

  contenedor.innerHTML = html;
}

// ─── Panel de detalle ─────────────────────────────────────
async function abrirDetalleHistorial(id) {
  const r = await db.resultados_presupuesto.get(id);
  if (!r) return;

  const panel = document.getElementById('historial-detalle-panel');
  const cuerpo = document.getElementById('historial-detalle-cuerpo');

  cuerpo.innerHTML = `
    <div class="detalle-header">
      <div class="detalle-receta-nombre">${escapeHTML(r.nombre_receta || 'Sin nombre')}</div>
      <div class="detalle-fecha">${formatFecha(r.fecha)}</div>
    </div>

    <div class="detalle-row">
      <span class="detalle-label">Porciones calculadas</span>
      <span class="detalle-valor">${r.porciones_calculadas}</span>
    </div>

    <div class="divider-label" style="margin:16px 0 12px">Desglose de costos</div>

    <div class="detalle-row">
      <span class="detalle-label">Ingredientes</span>
      <span class="detalle-valor">${formatMoneda(r.subtotal_ingredientes)}</span>
    </div>
    <div class="detalle-row">
      <span class="detalle-label">Energía</span>
      <span class="detalle-valor">${formatMoneda(r.subtotal_energia)}</span>
    </div>
    <div class="detalle-row">
      <span class="detalle-label">Mano de obra</span>
      <span class="detalle-valor">${formatMoneda(r.mano_de_obra)}</span>
    </div>
    <div class="detalle-row">
      <span class="detalle-label">Insumos adicionales</span>
      <span class="detalle-valor">${formatMoneda(r.subtotal_insumos)}</span>
    </div>
    <div class="detalle-row detalle-row-total">
      <span class="detalle-label">Total costo de producción</span>
      <span class="detalle-valor">${formatMoneda(r.costo_produccion_total)}</span>
    </div>

    <div class="divider-label" style="margin:16px 0 12px">Resultados</div>

    <div class="detalle-row">
      <span class="detalle-label">Costo por pieza</span>
      <span class="detalle-valor detalle-accent">${formatMoneda(r.costo_individual)}</span>
    </div>
    <div class="detalle-row">
      <span class="detalle-label">Precio mínimo sugerido</span>
      <span class="detalle-valor detalle-accent">${formatMoneda(r.precio_minimo_sugerido)}</span>
    </div>
    <div class="detalle-row">
      <span class="detalle-label">Ganancia por pieza</span>
      <span class="detalle-valor">${formatMoneda(r.ganancia_por_pieza)}</span>
    </div>
    <div class="detalle-row">
      <span class="detalle-label">Inversión inicial</span>
      <span class="detalle-valor">${formatMoneda(r.inversion_inicial)}</span>
    </div>
    <div class="detalle-row">
      <span class="detalle-label">Ganancia desde cero</span>
      <span class="detalle-valor">${formatMoneda(r.ganancia_desde_cero)}</span>
    </div>

    <div class="divider-label" style="margin:16px 0 12px">Contexto usado</div>

    <div class="detalle-row">
      <span class="detalle-label">Precio gas</span>
      <span class="detalle-valor">${formatMoneda(r.precio_gas_usado)}/L</span>
    </div>
    <div class="detalle-row">
      <span class="detalle-label">Precio kWh</span>
      <span class="detalle-valor">${formatMoneda(r.precio_kwh_usado)}</span>
    </div>
    <div class="detalle-row">
      <span class="detalle-label">Margen aplicado</span>
      <span class="detalle-valor">${r.margen_usado}%</span>
    </div>
  `;

  panel.classList.add('visible');
}

function cerrarDetalleHistorial() {
  document.getElementById('historial-detalle-panel').classList.remove('visible');
}

// ─── Panel de tendencia ───────────────────────────────────
async function abrirTendencia(nombreReceta) {
  const todos = await db.resultados_presupuesto.toArray();
  const registros = todos
    .filter(r => r.nombre_receta === nombreReceta)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  if (registros.length < 2) return;

  const panel = document.getElementById('historial-tendencia-panel');
  const cuerpo = document.getElementById('historial-tendencia-cuerpo');

  const fechaInicio = formatFecha(registros[0].fecha);
  const fechaFin = formatFecha(registros[registros.length - 1].fecha);
  const n = registros.length;

  // Regresión lineal para costo_individual
  const costos = registros.map(r => parseFloat(r.costo_individual) || 0);
  const precios = registros.map(r => parseFloat(r.precio_minimo_sugerido) || 0);

  let pendiente = 0, intercepto = 0;
  const hasTrend = n >= 3;

  if (hasTrend) {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += costos[i];
      sumXY += i * costos[i];
      sumX2 += i * i;
    }
    pendiente = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    intercepto = (sumY - pendiente * sumX) / n;
  }

  // Variación
  const primero = costos[0];
  const ultimo = costos[n - 1];
  const variacion = ultimo - primero;
  const variacionPct = primero !== 0 ? ((variacion / primero) * 100) : 0;
  const signoVar = variacion >= 0 ? '+' : '';

  // Etiqueta semántica de tendencia
  let etiquetaTendencia = '';
  if (hasTrend) {
    if (pendiente > 0.05) etiquetaTendencia = '📈 Costos en aumento';
    else if (pendiente < -0.05) etiquetaTendencia = '📉 Costos bajando';
    else etiquetaTendencia = '➡️ Costos estables';
  }

  // Proyección de sostenibilidad
  let proyeccionHtml = '';
  if (hasTrend) {
    const precioActual = precios[n - 1];
    if (pendiente > 0) {
      const periodos = (precioActual - ultimo) / pendiente;
      if (periodos > 0) {
        proyeccionHtml = `<p class="tendencia-proyeccion">Al ritmo actual, el precio mínimo podría sostenerse aproximadamente <strong>${Math.floor(periodos)}</strong> presupuesto${Math.floor(periodos) !== 1 ? 's' : ''} más.</p>`;
      } else {
        proyeccionHtml = `<p class="tendencia-proyeccion">El costo proyectado ya supera el precio mínimo actual. Considera ajustar el precio.</p>`;
      }
    } else {
      proyeccionHtml = `<p class="tendencia-proyeccion">Los costos se mantienen estables o bajan. No hay presión inmediata para ajustar el precio.</p>`;
    }
    proyeccionHtml += `<p class="tendencia-nota"><em>Proyección basada en la tendencia histórica. Los precios reales pueden variar.</em></p>`;
  }

  cuerpo.innerHTML = `
    <div class="tendencia-header">
      <div class="tendencia-receta-nombre">${escapeHTML(nombreReceta)}</div>
      <div class="tendencia-rango">${fechaInicio} — ${fechaFin}</div>
      <div class="tendencia-count">${n} presupuesto${n !== 1 ? 's' : ''} registrado${n !== 1 ? 's' : ''}</div>
    </div>

    <div class="tendencia-canvas-wrap">
      <canvas id="grafica-tendencia" height="220"></canvas>
    </div>

    ${!hasTrend ? `<p class="tendencia-nota-linea">Se necesitan 3 o más registros para proyectar tendencia.</p>` : ''}

    <div class="divider-label" style="margin:16px 0 12px">Resumen</div>

    <div class="detalle-row">
      <span class="detalle-label">Primer costo (${formatFecha(registros[0].fecha)})</span>
      <span class="detalle-valor">${formatMoneda(primero)}</span>
    </div>
    <div class="detalle-row">
      <span class="detalle-label">Último costo (${formatFecha(registros[n-1].fecha)})</span>
      <span class="detalle-valor">${formatMoneda(ultimo)}</span>
    </div>
    <div class="detalle-row">
      <span class="detalle-label">Variación total</span>
      <span class="detalle-valor ${variacion > 0 ? 'var-sube' : variacion < 0 ? 'var-baja' : ''}">${signoVar}${formatMoneda(variacion)} (${signoVar}${variacionPct.toFixed(1)}%)</span>
    </div>
    ${hasTrend ? `
    <div class="detalle-row">
      <span class="detalle-label">Tendencia</span>
      <span class="detalle-valor">${etiquetaTendencia}</span>
    </div>` : ''}

    ${proyeccionHtml}
  `;

  panel.classList.add('visible');

  // Dibujar gráfica después de que el DOM esté listo
  requestAnimationFrame(() => {
    dibujarGrafica('grafica-tendencia', registros, costos, precios, pendiente, intercepto, hasTrend);
  });
}

function cerrarTendencia() {
  document.getElementById('historial-tendencia-panel').classList.remove('visible');
}

// ─── Gráfica en Canvas ────────────────────────────────────
function dibujarGrafica(canvasId, registros, costos, precios, pendiente, intercepto, hasTrend) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const wrap = canvas.parentElement;
  canvas.width = wrap.offsetWidth || 300;
  canvas.height = 220;

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const PAD = { top: 16, right: 20, bottom: 40, left: 52 };
  const n = costos.length;

  // Calcular proyección 2 puntos extra si hay tendencia
  const puntosExtra = hasTrend ? 2 : 0;
  const totalPuntos = n + puntosExtra;

  // Calcular rango de valores
  let allValues = [...costos, ...precios];
  if (hasTrend) {
    for (let i = n; i < totalPuntos; i++) {
      allValues.push(pendiente * i + intercepto);
    }
  }
  const minVal = Math.min(...allValues) * 0.92;
  const maxVal = Math.max(...allValues) * 1.08;
  const rango = maxVal - minVal || 1;

  function px(xIdx) {
    return PAD.left + (xIdx / (totalPuntos - 1)) * (W - PAD.left - PAD.right);
  }
  function py(val) {
    return PAD.top + (1 - (val - minVal) / rango) * (H - PAD.top - PAD.bottom);
  }

  // Fondo
  ctx.clearRect(0, 0, W, H);

  // Grid horizontal (4 líneas)
  ctx.strokeStyle = '#DDD5C4';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  for (let i = 0; i <= 3; i++) {
    const v = minVal + (rango / 3) * i;
    const y = py(v);
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(W - PAD.right, y);
    ctx.stroke();

    // Labels eje Y
    ctx.fillStyle = '#9C8A6E';
    ctx.font = '10px DM Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('$' + v.toFixed(2), PAD.left - 6, y + 3);
  }

  // Labels eje X (fechas)
  ctx.fillStyle = '#9C8A6E';
  ctx.font = '9px DM Mono, monospace';
  ctx.textAlign = 'center';
  const maxLabels = Math.min(n, 5);
  const step = Math.max(1, Math.floor((n - 1) / (maxLabels - 1)));
  for (let i = 0; i < n; i += step) {
    const d = new Date(registros[i].fecha);
    const label = `${d.getDate()} ${MESES[d.getMonth()]}`;
    ctx.fillText(label, px(i), H - PAD.bottom + 14);
  }

  // Línea proyectada tendencia (punteada, antes que las otras líneas)
  if (hasTrend) {
    ctx.strokeStyle = '#B8A98A';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (let i = 0; i < totalPuntos; i++) {
      const v = pendiente * i + intercepto;
      const x = px(i);
      const y = py(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  // Línea precio mínimo
  ctx.strokeStyle = '#E8C97A';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = px(i);
    const y = py(precios[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Línea costo individual
  ctx.strokeStyle = '#C4501A';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = px(i);
    const y = py(costos[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Puntos costo
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = '#C4501A';
    ctx.beginPath();
    ctx.arc(px(i), py(costos[i]), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FAF7F2';
    ctx.beginPath();
    ctx.arc(px(i), py(costos[i]), 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Puntos precio mínimo
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = '#E8C97A';
    ctx.beginPath();
    ctx.arc(px(i), py(precios[i]), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FAF7F2';
    ctx.beginPath();
    ctx.arc(px(i), py(precios[i]), 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Leyenda
  const leyendaY = H - 8;
  ctx.font = '10px DM Mono, monospace';
  ctx.textAlign = 'left';

  ctx.fillStyle = '#C4501A';
  ctx.fillRect(PAD.left, leyendaY - 7, 12, 4);
  ctx.fillStyle = '#5C4A30';
  ctx.fillText('Costo/pieza', PAD.left + 16, leyendaY);

  ctx.fillStyle = '#E8C97A';
  ctx.fillRect(PAD.left + 90, leyendaY - 7, 12, 4);
  ctx.fillStyle = '#5C4A30';
  ctx.fillText('Precio mínimo', PAD.left + 106, leyendaY);

  if (hasTrend) {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#B8A98A';
    ctx.fillRect(PAD.left + 198, leyendaY - 7, 12, 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#5C4A30';
    ctx.fillText('Tendencia', PAD.left + 214, leyendaY);
  }

  // Interactividad: tooltip al tocar
  canvas._registros = registros;
  canvas._costos = costos;
  canvas._precios = precios;
  canvas._px = px;
  canvas._py = py;
  canvas._n = n;

  canvas.ontouchstart = (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    mostrarTooltipGrafica(canvas, ctx, touchX, W, H, PAD, px, py, costos, precios, n, pendiente, intercepto, hasTrend, rango, minVal);
  };
  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    mostrarTooltipGrafica(canvas, ctx, e.clientX - rect.left, W, H, PAD, px, py, costos, precios, n, pendiente, intercepto, hasTrend, rango, minVal);
  };
}

function mostrarTooltipGrafica(canvas, ctx, touchX, W, H, PAD, px, py, costos, precios, n, pendiente, intercepto, hasTrend, rango, minVal) {
  // Encontrar el punto más cercano
  let closestIdx = 0;
  let closestDist = Infinity;
  for (let i = 0; i < n; i++) {
    const dist = Math.abs(px(i) - touchX);
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = i;
    }
  }

  // Redibujar
  const registros = canvas._registros;
  // Limpiar y redibujar la gráfica completa
  dibujarGraficaConTooltip(canvas, ctx, registros, costos, precios, closestIdx, pendiente, intercepto, hasTrend, n, W, H, PAD, px, py, rango, minVal);
}

function dibujarGraficaConTooltip(canvas, ctx, registros, costos, precios, idx, pendiente, intercepto, hasTrend, n, W, H, PAD, px, py, rango, minVal) {
  const puntosExtra = hasTrend ? 2 : 0;
  const totalPuntos = n + puntosExtra;

  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = '#DDD5C4';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  for (let i = 0; i <= 3; i++) {
    const v = minVal + (rango / 3) * i;
    const y = py(v);
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(W - PAD.right, y);
    ctx.stroke();
    ctx.fillStyle = '#9C8A6E';
    ctx.font = '10px DM Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('$' + v.toFixed(2), PAD.left - 6, y + 3);
  }

  // Labels X
  ctx.fillStyle = '#9C8A6E';
  ctx.font = '9px DM Mono, monospace';
  ctx.textAlign = 'center';
  const maxLabels = Math.min(n, 5);
  const step = Math.max(1, Math.floor((n - 1) / (maxLabels - 1)));
  for (let i = 0; i < n; i += step) {
    const d = new Date(registros[i].fecha);
    const label = `${d.getDate()} ${MESES[d.getMonth()]}`;
    ctx.fillText(label, px(i), H - PAD.bottom + 14);
  }

  if (hasTrend) {
    ctx.strokeStyle = '#B8A98A';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (let i = 0; i < totalPuntos; i++) {
      const v = pendiente * i + intercepto;
      if (i === 0) ctx.moveTo(px(i), py(v));
      else ctx.lineTo(px(i), py(v));
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = '#E8C97A';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    if (i === 0) ctx.moveTo(px(i), py(precios[i]));
    else ctx.lineTo(px(i), py(precios[i]));
  }
  ctx.stroke();

  ctx.strokeStyle = '#C4501A';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    if (i === 0) ctx.moveTo(px(i), py(costos[i]));
    else ctx.lineTo(px(i), py(costos[i]));
  }
  ctx.stroke();

  for (let i = 0; i < n; i++) {
    ctx.fillStyle = '#C4501A';
    ctx.beginPath();
    ctx.arc(px(i), py(costos[i]), i === idx ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FAF7F2';
    ctx.beginPath();
    ctx.arc(px(i), py(costos[i]), i === idx ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < n; i++) {
    ctx.fillStyle = '#E8C97A';
    ctx.beginPath();
    ctx.arc(px(i), py(precios[i]), i === idx ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FAF7F2';
    ctx.beginPath();
    ctx.arc(px(i), py(precios[i]), i === idx ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tooltip para el punto seleccionado
  const xPos = px(idx);
  const yMin = Math.min(py(costos[idx]), py(precios[idx]));
  const tooltipW = 130;
  const tooltipH = 46;
  let tx = xPos - tooltipW / 2;
  tx = Math.max(PAD.left, Math.min(tx, W - PAD.right - tooltipW));
  const ty = Math.max(PAD.top, yMin - tooltipH - 10);

  ctx.fillStyle = '#2C1810';
  ctx.beginPath();
  ctx.roundRect(tx, ty, tooltipW, tooltipH, 6);
  ctx.fill();

  ctx.fillStyle = '#E8C97A';
  ctx.font = '10px DM Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`Costo: $${costos[idx].toFixed(2)}`, tx + 8, ty + 16);
  ctx.fillStyle = '#FAF7F2';
  ctx.fillText(`Mín: $${precios[idx].toFixed(2)}`, tx + 8, ty + 32);

  // Leyenda
  const leyendaY = H - 8;
  ctx.font = '10px DM Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#C4501A';
  ctx.fillRect(PAD.left, leyendaY - 7, 12, 4);
  ctx.fillStyle = '#5C4A30';
  ctx.fillText('Costo/pieza', PAD.left + 16, leyendaY);
  ctx.fillStyle = '#E8C97A';
  ctx.fillRect(PAD.left + 90, leyendaY - 7, 12, 4);
  ctx.fillStyle = '#5C4A30';
  ctx.fillText('Precio mínimo', PAD.left + 106, leyendaY);
  if (hasTrend) {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#B8A98A';
    ctx.fillRect(PAD.left + 198, leyendaY - 7, 12, 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#5C4A30';
    ctx.fillText('Tendencia', PAD.left + 214, leyendaY);
  }
}

// ─── Init ─────────────────────────────────────────────────
function initHistorial() {
  // Cerrar detalle al tocar overlay
  const detallePanel = document.getElementById('historial-detalle-panel');
  if (detallePanel) {
    detallePanel.addEventListener('click', (e) => {
      if (e.target === detallePanel) cerrarDetalleHistorial();
    });
  }

  const tendenciaPanel = document.getElementById('historial-tendencia-panel');
  if (tendenciaPanel) {
    tendenciaPanel.addEventListener('click', (e) => {
      if (e.target === tendenciaPanel) cerrarTendencia();
    });
  }
}
