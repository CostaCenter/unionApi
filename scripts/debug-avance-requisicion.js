/**
 * Uso: node scripts/debug-avance-requisicion.js 782
 * Reproduce getRequisicionDetallada + pasos de avance sin levantar el server.
 */
require('dotenv').config();
const requisicionId = process.argv[2] || '782';

const {
  getRequisicionDetallada,
  addMateriaRequisicion,
  addProductoRequisicion,
  getNecesidadProjecto,
} = require('../src/controllers/services/requsicionService');
const { createCompromiso } = require('../src/controllers/services/inventarioServices');
const { db } = require('../src/db/db');

async function main() {
  console.log('RequisicionId:', requisicionId);

  let data;
  try {
    data = await getRequisicionDetallada(requisicionId);
  } catch (err) {
    console.error('FALLÓ getRequisicionDetallada:', err);
    process.exit(1);
  }

  if (!data) {
    console.error('getRequisicionDetallada devolvió null');
    process.exit(1);
  }

  console.log('cotizacionId:', data.requisicion.cotizacionId);
  console.log('cantidades MP:', data.cantidades.length);
  console.log('productos:', data.resumenProductos.length);
  console.log('kits:', data.resumenKits.length);
  if (data.cantidades.length) console.log('Muestra MP:', JSON.stringify(data.cantidades.slice(0, 3), null, 2));
  if (data.resumenKits.length) console.log('Muestra kits:', JSON.stringify(data.resumenKits.slice(0, 3), null, 2));

  const t = await db.transaction();
  try {
    for (const val of data.cantidades) {
      console.log('MP paso:', val.id, val.nombre, 'cant', val.cantidad);
      await addMateriaRequisicion(requisicionId, val.id, val.cantidad, val.medida, t);
      await createCompromiso(val.id, val.cantidad, data.requisicion.cotizacionId, null, val.medida, t);
    }
    for (const val of data.resumenProductos) {
      console.log('PT paso:', val.id, val.cantidad);
      await addProductoRequisicion(requisicionId, val.id, val.cantidad, val.medida, t);
      await createCompromiso(null, val.cantidad, data.requisicion.cotizacionId, val.id, val.medida, t);
    }
    const ok = await getNecesidadProjecto(requisicionId, t);
    if (!ok) throw new Error('getNecesidadProjecto returned null');
    await t.rollback();
    console.log('OK (transacción revertida a propósito, solo diagnóstico)');
  } catch (err) {
    await t.rollback();
    console.error('FALLÓ avance (mismo error que el 500):');
    console.error(err);
    if (err.parent) console.error('SQL:', err.parent.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
