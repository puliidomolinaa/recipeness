// db.js — definición de base de datos con Dexie.js

const db = new Dexie('CalculadoraEmprendimiento');

db.version(1).stores({
  configuracion_global:     'clave',
  equipos:                  '++id, nombre, tipo_energia',
  ingredientes_catalogo:    '++id, nombre',
  recetas:                  '++id, nombre, categoria, fecha_creacion',
  procesos_receta:          '++id, receta_id, equipo_id',
  ingredientes_receta:      '++id, receta_id, ingrediente_catalogo_id',
  insumos_adicionales:      '++id, presupuesto_snapshot_id, nombre',
  resultados_presupuesto:   '++id, receta_id, fecha'
});

// Versión 2: agrega catálogo de insumos reutilizables (cajas, etiquetas, bolsas, etc.)
db.version(2).stores({
  configuracion_global:     'clave',
  equipos:                  '++id, nombre, tipo_energia',
  ingredientes_catalogo:    '++id, nombre',
  recetas:                  '++id, nombre, categoria, fecha_creacion',
  procesos_receta:          '++id, receta_id, equipo_id',
  ingredientes_receta:      '++id, receta_id, ingrediente_catalogo_id',
  insumos_adicionales:      '++id, presupuesto_snapshot_id, nombre',
  resultados_presupuesto:   '++id, receta_id, fecha',
  insumos_catalogo:         '++id, nombre'
});

const CONFIG_DEFAULTS = [
  { clave: 'precio_gas',               valor: 0 },
  { clave: 'precio_kwh',               valor: 0 },
  { clave: 'margen_ganancia',          valor: 30 },
  { clave: 'salario_minimo_hora',      valor: 0 },
  { clave: 'multiplicador_mano_obra',  valor: 2 },
];

async function seedConfiguracion() {
  for (const item of CONFIG_DEFAULTS) {
    const existe = await db.configuracion_global.get(item.clave);
    if (!existe) {
      await db.configuracion_global.put(item);
    }
  }
}

async function initDB() {
  await seedConfiguracion();
}
