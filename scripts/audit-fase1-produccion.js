/**
 * Auditoría post Fase 1 — solo lectura
 * node scripts/audit-fase1-produccion.js
 */
require('dotenv').config();
const { db } = require('../src/db/db');

(async () => {
  try {
    console.log('=== AUDITORÍA FASE 1 (solo lectura) ===\n');

    const [totals] = await db.query(`
      SELECT COUNT(*)::int AS total FROM "comprasCotizacionItems"
    `);
    console.log('1. Total filas comprasCotizacionItems:', totals[0].total);

    const [byTipo] = await db.query(`
      SELECT COALESCE("tipo", '(null)') AS tipo, COUNT(*)::int AS count
      FROM "comprasCotizacionItems"
      GROUP BY "tipo"
      ORDER BY count DESC
    `);
    console.log('\n2. Conteo por tipo:');
    console.table(byTipo);

    const [orphanNull] = await db.query(`
      SELECT *
      FROM "comprasCotizacionItems"
      WHERE "tipo" IS NULL
    `);
    console.log('\n3. Filas con tipo NULL (completas):');
    console.log(JSON.stringify(orphanNull, null, 2));

    const [testRows] = await db.query(`
      SELECT id, "comprasCotizacionId", "tipo", "descripcionLibre", "precio", "precioTotal",
             "createdAt", "updatedAt"
      FROM "comprasCotizacionItems"
      WHERE "descripcionLibre" ILIKE '%prueba fase1%'
         OR "descripcionLibre" ILIKE '%Transporte flete prueba%'
         OR "descripcionLibre" ILIKE '%Soldadura externa prueba%'
    `);
    console.log('\n4. Filas de prueba residuales (descripcionLibre):');
    console.log(JSON.stringify(testRows, null, 2));

    const [serviciosLibres] = await db.query(`
      SELECT id, "comprasCotizacionId", "descripcionLibre", "precioTotal", "createdAt"
      FROM "comprasCotizacionItems"
      WHERE "tipo" = 'servicio_libre'
      ORDER BY id DESC
      LIMIT 20
    `);
    console.log('\n5. Todos servicio_libre (max 20):');
    console.log(JSON.stringify(serviciosLibres, null, 2));

    const [recentInserts] = await db.query(`
      SELECT id, "tipo", "descripcionLibre", "materiaId", "productoId", "precioTotal", "createdAt"
      FROM "comprasCotizacionItems"
      WHERE "createdAt" >= NOW() - INTERVAL '24 hours'
      ORDER BY id DESC
    `);
    console.log('\n6. Inserts últimas 24h:');
    console.log(JSON.stringify(recentInserts, null, 2));

    const [itemToProjectRecent] = await db.query(`
      SELECT itp.*
      FROM "itemToProjects" itp
      LEFT JOIN "comprasCotizacionItems" ci ON ci.id = itp."comprasCotizacionItemId"
      WHERE ci.id IS NULL
      LIMIT 20
    `);
    console.log('\n7. itemToProjects huérfanos (sin comprasCotizacionItem):');
    console.log(JSON.stringify(itemToProjectRecent, null, 2));

    if (orphanNull.length === 1) {
      const oid = orphanNull[0].id;
      const [beforeMigrationEvidence] = await db.query(`
        SELECT id, "createdAt", "updatedAt", "materiaId", "materiumId", "productoId",
               "precio", "precioTotal", "cantidad", "comprasCotizacionId"
        FROM "comprasCotizacionItems"
        WHERE id = :id
      `, { replacements: { id: oid } });
      console.log('\n8. Detalle fila huérfana id=' + oid + ':');
      console.log(JSON.stringify(beforeMigrationEvidence[0], null, 2));
    }

    const [maxId] = await db.query(`SELECT MAX(id)::int AS max_id FROM "comprasCotizacionItems"`);
    console.log('\n9. MAX(id) actual:', maxId[0].max_id);

  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await db.close();
  }
})();
