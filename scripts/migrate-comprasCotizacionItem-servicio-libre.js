/**
 * Migración Fase 1 — tipo + descripcionLibre en comprasCotizacionItems
 * Uso: node scripts/migrate-comprasCotizacionItem-servicio-libre.js
 */
require('dotenv').config();

const migration = require('../migrations/20260819000000-compras-cotizacion-item-servicio-libre');
const { db } = require('../src/db/db');

(async () => {
  try {
    console.log('=== Migración servicio_libre OC ===');

    const [before] = await db.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'comprasCotizacionItems'
        AND column_name IN ('materiaId', 'productoId', 'materiumId', 'tipo', 'descripcionLibre')
      ORDER BY column_name
    `);
    console.log('Estado previo:', JSON.stringify(before, null, 2));

    await migration.up(db.getQueryInterface(), db);

    const [after] = await db.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'comprasCotizacionItems'
        AND column_name IN ('materiaId', 'productoId', 'materiumId', 'tipo', 'descripcionLibre')
      ORDER BY column_name
    `);
    console.log('Estado posterior:', JSON.stringify(after, null, 2));

    const [tipoCounts] = await db.query(`
      SELECT "tipo", COUNT(*)::int AS count
      FROM "comprasCotizacionItems"
      GROUP BY "tipo"
      ORDER BY "tipo" NULLS FIRST
    `);
    console.log('Backfill tipo:', JSON.stringify(tipoCounts, null, 2));

    console.log('✅ Migración completada');
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
})();
