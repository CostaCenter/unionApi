/**
 * Uso: node scripts/lookup-requisiciones.js 776 777
 */
require('dotenv').config();
const { Op } = require('sequelize');
const { requisicion, cotizacion, client, remision, db } = require('../src/db/db');

async function main() {
  const ids = process.argv.slice(2).map(Number).filter(Boolean);
  if (!ids.length) ids.push(776, 777);

  for (const id of ids) {
    const r = await requisicion.findByPk(id, {
      include: [{ model: cotizacion, include: [client] }],
    });
    console.log('--- requisicion', id, '---');
    if (!r) {
      console.log('NOT FOUND');
      continue;
    }
    const j = r.toJSON();
    console.log({
      id: j.id,
      nombre: j.nombre,
      estado: j.estado,
      cotizacionId: j.cotizacionId,
      fecha: j.fecha,
      createdAt: j.createdAt,
    });
    if (j.cotizacion) {
      console.log('cotizacion:', {
        id: j.cotizacion.id,
        name: j.cotizacion.name,
        state: j.cotizacion.state,
        numeroVisible: Number(j.cotizacion.id) + 21719,
      });
      console.log('cliente:', j.cotizacion.client?.nombre || j.cotizacion.client?.name);
    } else {
      console.log('cotizacion: MISSING (FK roto o borrada)');
    }
    const rems = await remision.findAll({
      where: { requisicionId: id },
      attributes: ['id', 'numeroRemision', 'estado', 'createdAt'],
    });
    console.log(
      'remisiones:',
      rems.length,
      rems.map((x) => x.toJSON())
    );
  }

  const minId = Math.min(...ids) - 10;
  const maxId = Math.max(...ids) + 10;
  const nearby = await requisicion.findAll({
    where: { id: { [Op.between]: [minId, maxId] } },
    attributes: ['id', 'nombre', 'estado', 'cotizacionId'],
    order: [['id', 'ASC']],
  });
  console.log(`\nRequisiciones ${minId}-${maxId}:`);
  nearby.forEach((n) => console.log(n.toJSON()));

  const estados = await requisicion.findAll({
    attributes: ['estado'],
    group: ['estado'],
    raw: true,
  });
  console.log('\nEstados distintos en requisicion:', estados.map((e) => e.estado));

  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
