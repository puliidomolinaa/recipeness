// backup.js — exportar e importar JSON completo de la base de datos

async function exportarRespaldo() {
  const tablas = [
    'configuracion_global',
    'equipos',
    'ingredientes_catalogo',
    'recetas',
    'procesos_receta',
    'ingredientes_receta',
    'insumos_adicionales',
    'resultados_presupuesto'
  ];

  const respaldo = {};
  for (const tabla of tablas) {
    respaldo[tabla] = await db[tabla].toArray();
  }

  const json = JSON.stringify(respaldo, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const fecha = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `respaldo-calculadora-${fecha}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importarRespaldo(archivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const datos = JSON.parse(e.target.result);

        // Tablas que se reemplazan completamente (clear + bulkAdd)
        const tablasReemplazar = [
          'configuracion_global',
          'equipos',
          'ingredientes_catalogo',
          'recetas',
          'procesos_receta',
          'ingredientes_receta',
        ];

        for (const tabla of tablasReemplazar) {
          if (datos[tabla] !== undefined) {
            await db[tabla].clear();
            if (datos[tabla].length > 0) {
              await db[tabla].bulkAdd(datos[tabla]);
            }
          }
        }

        // Tablas de historial: mezclar con bulkPut para no borrar registros existentes
        if (datos['insumos_adicionales'] !== undefined && datos['insumos_adicionales'].length > 0) {
          await db.insumos_adicionales.bulkPut(datos['insumos_adicionales']);
        }

        if (datos['resultados_presupuesto'] !== undefined && datos['resultados_presupuesto'].length > 0) {
          await db.resultados_presupuesto.bulkPut(datos['resultados_presupuesto']);
        }

        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsText(archivo);
  });
}
