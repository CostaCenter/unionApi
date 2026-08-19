require('dotenv').config();
const { db } = require('../src/db/db');

(async () => {
  try {
    const [gaps] = await db.query(`
      SELECT s.id AS missing_id
      FROM generate_series(
        (SELECT COALESCE(MAX(id), 0) - 30 FROM "comprasCotizacionItems"),
        (SELECT COALESCE(MAX(id), 0) + 5 FROM "comprasCotizacionItems")
      ) AS s(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM "comprasCotizacionItems" c WHERE c.id = s.id
      )
      ORDER BY s.id
    `);
    console.log('IDs faltantes (últimos 30+5):', gaps.map(r => r.missing_id));

    const [itpToday] = await db.query(`
      SELECT itp.id, itp."comprasCotizacionItemId", itp."requisicionId", itp."createdAt",
             ci.id AS item_exists
      FROM "itemToProjects" itp
      LEFT JOIN "comprasCotizacionItems" ci ON ci.id = itp."comprasCotizacionItemId"
      WHERE itp."createdAt" >= '2026-08-19T19:00:00Z'
      ORDER BY itp.id DESC
    `);
    console.log('\nitemToProjects creados desde ~19:00 UTC hoy:');
    console.log(JSON.stringify(itpToday, null, 2));

    const [orden59] = await db.query(`
      SELECT cc.id, cc.name, cc."estadoPago", cc."createdAt"
      FROM "comprasCotizacions" cc
      WHERE cc.id = 59
    `);
    console.log('\nOrden compra #59 (OC de fila huérfana 113):');
    console.log(JSON.stringify(orden59, null, 2));

    const [row113Itp] = await db.query(`
      SELECT * FROM "itemToProjects" WHERE "comprasCotizacionItemId" = 113
    `);
    console.log('\nitemToProjects para item 113:');
    console.log(JSON.stringify(row113Itp, null, 2));

    const [backfillCheck] = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE "tipo" = 'producto' AND "productoId" IS NOT NULL)::int AS producto_ok,
        COUNT(*) FILTER (WHERE "tipo" = 'material' AND ("materiaId" IS NOT NULL OR "materiumId" IS NOT NULL))::int AS material_ok,
        COUNT(*) FILTER (WHERE "tipo" IS NULL)::int AS tipo_null,
        COUNT(*) FILTER (WHERE "tipo" = 'producto' AND "productoId" IS NULL)::int AS producto_inconsistente,
        COUNT(*) FILTER (WHERE "tipo" = 'material' AND "materiaId" IS NULL AND "materiumId" IS NULL)::int AS material_inconsistente
      FROM "comprasCotizacionItems"
    `);
    console.log('\nConsistencia post-backfill:');
    console.log(JSON.stringify(backfillCheck[0], null, 2));

  } finally {
    await db.close();
  }
})();
