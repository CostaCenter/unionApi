/**
 * Consolidación de cotizacion_compromiso duplicados
 * Dry-run por defecto. Aplicar cambios: node scripts/fix-compromisos-duplicados.js --apply
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { cotizacion_compromiso, db } = require('../src/db/db');

const APPLY = process.argv.includes('--apply');
const BACKUPS_DIR = path.join(__dirname, 'backups');

function claveCompromiso(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  const cotizacionId = plain.cotizacionId;
  const productoId = plain.productoId ?? '';
  const materiaId = plain.materiaId ?? plain.materiumId ?? '';
  const medida = plain.medida ?? '';
  return `${cotizacionId}|${materiaId}|${productoId}|${medida}`;
}

function estadoCompromisoDesdeCantidades(cantidadEntregada, cantidadComprometida) {
  const entregada = Number(cantidadEntregada);
  const comprometida = Number(cantidadComprometida);
  if (entregada >= comprometida) return 'completo';
  if (entregada <= 0) return 'reservado';
  return 'parcial';
}

function filaPlain(row) {
  return row.get ? row.get({ plain: true }) : { ...row };
}

(async () => {
  try {
    console.log(APPLY ? '=== MODO APPLY (escribe en BD) ===' : '=== MODO DRY-RUN (sin cambios en BD) ===');
    console.log('');

    const rows = await cotizacion_compromiso.findAll({
      order: [['id', 'ASC']],
    });

    const grupos = new Map();
    for (const row of rows) {
      const k = claveCompromiso(row);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(row);
    }

    const duplicados = [...grupos.entries()].filter(([, g]) => g.length > 1);
    if (duplicados.length === 0) {
      console.log('No hay grupos duplicados. Nada que hacer.');
      return;
    }

    const planes = duplicados.map(([clave, grupo]) => {
      const ordenados = [...grupo].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
      const conservar = ordenados[0];
      const masReciente = ordenados[ordenados.length - 1];
      const sumaEntregada = ordenados.reduce(
        (acc, r) => acc + Number(r.cantidadEntregada),
        0
      );
      const nuevaComprometida = Number(masReciente.cantidadComprometida);
      const nuevoEstado = estadoCompromisoDesdeCantidades(sumaEntregada, nuevaComprometida);
      const eliminar = ordenados.slice(1);

      return {
        clave,
        conservarId: conservar.id,
        eliminarIds: eliminar.map((r) => r.id),
        antes: ordenados.map(filaPlain),
        despuesConservar: {
          id: conservar.id,
          cantidadComprometida: nuevaComprometida,
          cantidadEntregada: sumaEntregada,
          estado: nuevoEstado,
        },
      };
    });

    for (const plan of planes) {
      console.log(`Clave ${plan.clave}`);
      console.log(`  Conservar id=${plan.conservarId}, eliminar ids=[${plan.eliminarIds.join(', ')}]`);
      console.log(`  → cantidadComprometida=${plan.despuesConservar.cantidadComprometida}, cantidadEntregada=${plan.despuesConservar.cantidadEntregada}, estado=${plan.despuesConservar.estado}`);
    }

    if (!APPLY) {
      console.log('\nDry-run terminado. Ejecuta con --apply para aplicar.');
      return;
    }

    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUPS_DIR, `compromisos-duplicados-${stamp}.json`);
    fs.writeFileSync(
      backupPath,
      JSON.stringify({ generatedAt: new Date().toISOString(), planes }, null, 2),
      'utf8'
    );
    console.log(`\nBackup escrito: ${backupPath}`);

    const t = await db.transaction();
    try {
      for (const plan of planes) {
        await cotizacion_compromiso.update(
          {
            cantidadComprometida: plan.despuesConservar.cantidadComprometida,
            cantidadEntregada: plan.despuesConservar.cantidadEntregada,
            estado: plan.despuesConservar.estado,
          },
          { where: { id: plan.conservarId }, transaction: t }
        );
        if (plan.eliminarIds.length) {
          await cotizacion_compromiso.destroy({
            where: { id: plan.eliminarIds },
            transaction: t,
          });
        }
      }
      await t.commit();
      console.log(`✅ Consolidados ${planes.length} grupos duplicados.`);
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    console.error('Error en fix:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
})();
