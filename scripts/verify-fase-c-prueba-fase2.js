/**
 * Verificación Fase C — SOLO SELECT (sin INSERT/UPDATE/DELETE)
 * node scripts/verify-fase-c-prueba-fase2.js
 */
require('dotenv').config();
const { db } = require('../src/db/db');

const queries = [
  {
    n: 1,
    label: 'OCs PRUEBA FASE2',
    sql: `SELECT id, name, "estadoPago", "dayCompras", "daysFinish"
FROM "comprasCotizacions"
WHERE name ILIKE '%PRUEBA FASE2%'`,
  },
  {
    n: 2,
    label: 'Items huérfanos PRUEBA FASE2',
    sql: `SELECT id, tipo, "descripcionLibre", "comprasCotizacionId"
FROM "comprasCotizacionItems"
WHERE "comprasCotizacionId" IN (
  SELECT id FROM "comprasCotizacions" WHERE name ILIKE '%PRUEBA FASE2%'
)`,
  },
  {
    n: 3,
    label: 'itemToProject ligados PRUEBA FASE2',
    sql: `SELECT COUNT(*)::int AS item_to_project_count
FROM "itemToProjects" itp
JOIN "comprasCotizacionItems" ci ON ci.id = itp."comprasCotizacionItemId"
JOIN "comprasCotizacions" cc ON cc.id = ci."comprasCotizacionId"
WHERE cc.name ILIKE '%PRUEBA FASE2%'`,
  },
];

(async () => {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    console.error('ERROR: DATABASE_URL no configurada en .env');
    process.exit(1);
  }

  console.log('=== VERIFICACION FASE C (SOLO SELECT) ===');
  console.log('Confirmacion: las 3 sentencias son SELECT exclusivamente.\n');

  for (const q of queries) {
    console.log(`--- Query ${q.n}: ${q.label} ---`);
    console.log(q.sql);
    console.log('');
    const [rows] = await db.query(q.sql);
    console.log('Resultado:', JSON.stringify(rows, null, 2));
    console.log('');
  }

  await db.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
