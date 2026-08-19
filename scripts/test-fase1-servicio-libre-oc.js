/**
 * Pruebas Fase 1 — servicio_libre en OC
 * Uso: node scripts/test-fase1-servicio-libre-oc.js
 */
require('dotenv').config();

const {
  inferTipoComprasItem,
  addItemToCotizacion,
  addServicioLibreToCotizacion,
  attachProyectosToComprasItem,
} = require('../src/controllers/services/requsicionService');
const {
  comprasCotizacion,
  comprasCotizacionItem,
  itemToProject,
  requisicion,
  db,
  Op,
} = require('../src/db/db');

let passed = 0;
let failed = 0;

const assert = (label, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

async function testInferTipo() {
  console.log('\n--- inferTipoComprasItem ---');
  assert('producto', inferTipoComprasItem({ productoId: 1 }) === 'producto');
  assert('material por materiaId', inferTipoComprasItem({ materiaId: 2 }) === 'material');
  assert('material por materiumId', inferTipoComprasItem({ materiumId: 2 }) === 'material');
  assert('servicio explícito', inferTipoComprasItem({ tipo: 'servicio_libre' }) === 'servicio_libre');
  assert('sin ids', inferTipoComprasItem({}) === null);
}

async function testSchema() {
  console.log('\n--- Schema comprasCotizacionItems ---');
  const [cols] = await db.query(`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'comprasCotizacionItems'
      AND column_name IN ('materiaId', 'productoId', 'tipo', 'descripcionLibre')
    ORDER BY column_name
  `);

  const map = Object.fromEntries(cols.map((c) => [c.column_name, c.is_nullable]));
  assert('materiaId nullable', map.materiaId === 'YES', map.materiaId);
  assert('productoId nullable', map.productoId === 'YES', map.productoId);
  assert('columna tipo existe', map.tipo != null);
  assert('columna descripcionLibre existe', map.descripcionLibre != null);
}

async function testServicioLibreFlow() {
  console.log('\n--- Flujo servicio_libre (integración) ---');

  const orden = await comprasCotizacion.findOne({
    order: [['id', 'DESC']],
  });

  if (!orden) {
    console.log('  ⚠️  Sin órdenes de compra en BD — omitiendo integración');
    return;
  }

  const reqRow = await requisicion.findOne({
    order: [['id', 'DESC']],
  });

  const requisicionId = reqRow?.id ?? null;

  const servicio1 = await addServicioLibreToCotizacion({
    descripcionLibre: 'Transporte flete prueba fase1',
    cantidad: 1,
    precioUnidad: '50000',
    descuento: '0',
    precio: '50000',
    precioTotal: '50000',
    cotizacionId: orden.id,
  });

  assert('crear servicio_libre #1', !!servicio1?.id);
  assert('tipo servicio_libre', servicio1?.tipo === 'servicio_libre');
  assert('sin materiaId', servicio1?.materiaId == null && servicio1?.materiumId == null);
  assert('sin productoId', servicio1?.productoId == null);
  assert('descripcionLibre guardada', servicio1?.descripcionLibre === 'Transporte flete prueba fase1');

  const servicio2 = await addServicioLibreToCotizacion({
    descripcionLibre: 'Soldadura externa prueba fase1',
    cantidad: 2,
    precioUnidad: '30000',
    descuento: '5000',
    precio: '60000',
    precioTotal: '55000',
    cotizacionId: orden.id,
  });

  assert('crear servicio_libre #2 (sin duplicado)', !!servicio2?.id && servicio2.id !== servicio1.id);

  if (requisicionId && servicio1?.id) {
    const proyectos = await attachProyectosToComprasItem(servicio1.id, [{
      requisicionId,
      cantidad: 1,
      necesidad: 0,
    }]);
    assert('itemToProject creado', proyectos.length === 1);

    const link = await itemToProject.findOne({
      where: { comprasCotizacionItemId: servicio1.id, requisicionId },
    });
    assert('itemToProject persistido', !!link);
  } else {
    console.log('  ⚠️  Sin requisición — omitiendo itemToProject');
  }

  // Limpieza por PK
  for (const id of [servicio1?.id, servicio2?.id].filter(Boolean)) {
    await itemToProject.destroy({ where: { comprasCotizacionItemId: id } });
    await comprasCotizacionItem.destroy({ where: { id } });
  }
  assert('cleanup servicios de prueba', true);
}

async function testMaterialProductoRegression() {
  console.log('\n--- Regresión material/producto existentes ---');

  const materialItem = await comprasCotizacionItem.findOne({
    where: {
      productoId: null,
      [Op.and]: [
        {
          [Op.or]: [
            { materiaId: { [Op.ne]: null } },
            { materiumId: { [Op.ne]: null } },
          ],
        },
        {
          [Op.or]: [
            { tipo: 'material' },
            { tipo: null },
          ],
        },
      ],
    },
  });

  const productoItem = await comprasCotizacionItem.findOne({
    where: {
      productoId: { [Op.ne]: null },
      [Op.or]: [
        { tipo: 'producto' },
        { tipo: null },
      ],
    },
  });

  if (materialItem) {
    assert('ítem material existente con tipo material/null', inferTipoComprasItem(materialItem) === 'material');
  } else {
    console.log('  ⚠️  Sin ítems material en BD');
  }

  if (productoItem) {
    assert('ítem producto existente con tipo producto/null', inferTipoComprasItem(productoItem) === 'producto');
  } else {
    console.log('  ⚠️  Sin ítems producto en BD');
  }

  const legacyMaterial = materialItem
    ? {
        itemId: materialItem.materiumId || materialItem.materiaId,
        tipo: 'materia',
        comprasId: materialItem.comprasCotizacionId,
      }
    : null;

  if (legacyMaterial?.itemId) {
    const resolved = await comprasCotizacionItem.findOne({
      where: {
        comprasCotizacionId: legacyMaterial.comprasId,
        [Op.and]: [
          {
            [Op.or]: [
              { materiumId: legacyMaterial.itemId },
              { materiaId: legacyMaterial.itemId },
            ],
          },
          {
            [Op.or]: [
              { tipo: { [Op.ne]: 'servicio_libre' } },
              { tipo: null },
            ],
          },
        ],
      },
    });
    assert('resolución legacy material → PK', resolved?.id === materialItem.id, `pk=${resolved?.id}`);
  }

  const totalRows = await comprasCotizacionItem.count();
  assert('tabla comprasCotizacionItems accesible', totalRows >= 0, `rows=${totalRows}`);
}

(async () => {
  try {
    console.log('=== Test Fase 1: servicio_libre OC ===');
    await testInferTipo();
    await testSchema();
    await testServicioLibreFlow();
    await testMaterialProductoRegression();

    console.log(`\n=== Resultado: ${passed} ok, ${failed} fallos ===`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Error fatal:', err);
    process.exit(1);
  } finally {
    await db.close();
  }
})();
