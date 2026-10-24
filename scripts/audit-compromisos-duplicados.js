/**
 * Auditoría de cotizacion_compromiso duplicados — solo lectura
 * Uso: node scripts/audit-compromisos-duplicados.js
 */
require('dotenv').config();
const { cotizacion_compromiso, db } = require('../src/db/db');

function claveCompromiso(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  const cotizacionId = plain.cotizacionId;
  const productoId = plain.productoId ?? '';
  const materiaId = plain.materiaId ?? plain.materiumId ?? '';
  const medida = plain.medida ?? '';
  return `${cotizacionId}|${materiaId}|${productoId}|${medida}`;
}

function filaResumen(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    cotizacionId: plain.cotizacionId,
    materiaId: plain.materiaId,
    materiumId: plain.materiumId,
    productoId: plain.productoId,
    medida: plain.medida,
    cantidadComprometida: plain.cantidadComprometida,
    cantidadEntregada: plain.cantidadEntregada,
    estado: plain.estado,
    createdAt: plain.createdAt,
  };
}

(async () => {
  try {
    console.log('=== AUDITORÍA compromisos duplicados (solo lectura) ===\n');

    const rows = await cotizacion_compromiso.findAll({
      order: [['cotizacionId', 'ASC'], ['id', 'ASC']],
    });

    const grupos = new Map();
    for (const row of rows) {
      const k = claveCompromiso(row);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(row);
    }

    const duplicados = [...grupos.entries()].filter(([, g]) => g.length > 1);
    console.log(`Total filas: ${rows.length}`);
    console.log(`Grupos con duplicados: ${duplicados.length}`);
    console.log(`Filas en grupos duplicados: ${duplicados.reduce((n, [, g]) => n + g.length, 0)}\n`);

    const porCotizacion = new Map();
    for (const [, grupo] of duplicados) {
      const cId = grupo[0].cotizacionId;
      if (!porCotizacion.has(cId)) {
        porCotizacion.set(cId, { grupos: 0, filasExtra: 0, detalle: [] });
      }
      const agg = porCotizacion.get(cId);
      agg.grupos += 1;
      agg.filasExtra += grupo.length - 1;
      agg.detalle.push(grupo.map(filaResumen));
    }

    const cotizacionIds = [...porCotizacion.keys()].sort((a, b) => a - b);
    for (const cId of cotizacionIds) {
      const { grupos: numGrupos, filasExtra, detalle } = porCotizacion.get(cId);
      console.log(`--- Cotización ${cId}: ${numGrupos} claves duplicadas, ${filasExtra} filas de más ---`);
      for (const grupo of detalle) {
        console.log(JSON.stringify(grupo, null, 2));
      }
      console.log('');
    }

    if (duplicados.length === 0) {
      console.log('No se encontraron duplicados por clave lógica.');
    }
  } catch (err) {
    console.error('Error en auditoría:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
})();
