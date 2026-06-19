const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const {
  cotizacion,
  client,
  areaCotizacion,
  kitCotizacion,
  productoCotizacion,
  serviceCotizacion,
  armadoCotizacion,
  db,
} = require('./src/db/db');

const ESTADOS_VENTA_GANADA = ['aprobada', 'Aprobada', 'anticipo'];

const COLUMNAS_CSV = [
  'Nombre cliente',
  'NIT',
  'Sector',
  'Valor ultima compra',
  'Fecha ultima compra',
  'Valor penultima compra',
  'Fecha penultima compra',
  'Valor antepenultima compra',
  'Fecha antepenultima compra',
  'Valor total ultimas 3 compras',
];

function obtenerMontoFacturado(coti) {
  const price = parseFloat(coti.price);
  if (!Number.isNaN(price) && price > 0) return price;

  let total = 0;

  for (const area of coti.areaCotizacions || []) {
    for (const item of area.kitCotizacions || []) {
      total += parseFloat(item.precio) || 0;
    }
    for (const item of area.productoCotizacions || []) {
      total += parseFloat(item.precio) || 0;
    }
    for (const item of area.serviciosCotizados || []) {
      total += parseFloat(item.precio) || 0;
    }
    for (const item of area.armadoCotizacions || []) {
      total += parseFloat(item.precio) || 0;
    }
  }

  return total;
}

function obtenerFechaCompra(coti) {
  const fecha = coti.fechaAprobada || coti.time || coti.createdAt;
  return fecha ? new Date(fecha) : null;
}

function formatearFecha(fecha) {
  if (!fecha) return '';
  return dayjs(fecha).format('YYYY-MM-DD');
}

function escaparCsv(valor) {
  const str = String(valor ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function filaCsv(valores) {
  return valores.map(escaparCsv).join(',');
}

function obtenerUltimasCompras(cotizaciones) {
  return [...cotizaciones]
    .sort((a, b) => {
      const fechaA = obtenerFechaCompra(a);
      const fechaB = obtenerFechaCompra(b);

      if (!fechaA && !fechaB) return 0;
      if (!fechaA) return 1;
      if (!fechaB) return -1;

      return fechaB - fechaA;
    })
    .slice(0, 3)
    .map((coti) => ({
      valor: obtenerMontoFacturado(coti),
      fecha: formatearFecha(obtenerFechaCompra(coti)),
    }));
}

function construirFilaCliente(cliente) {
  const compras = obtenerUltimasCompras(cliente.cotizacions || []);
  const slots = [0, 1, 2].map((indice) => compras[indice] || { valor: 0, fecha: '' });
  const totalUltimas3 = slots.reduce((suma, compra) => suma + compra.valor, 0);

  return filaCsv([
    cliente.nombre || '',
    cliente.nit || '',
    '',
    slots[0].valor || 0,
    slots[0].fecha,
    slots[1].valor || 0,
    slots[1].fecha,
    slots[2].valor || 0,
    slots[2].fecha,
    totalUltimas3,
  ]);
}

async function generarAnalisisClientes() {
  try {
    await db.authenticate();

    const clientes = await client.findAll({
      attributes: ['id', 'nombre', 'nit'],
      include: [
        {
          model: cotizacion,
          where: {
            state: { [Op.in]: ESTADOS_VENTA_GANADA },
          },
          required: false,
          attributes: ['id', 'price', 'fechaAprobada', 'time', 'createdAt'],
          include: [
            {
              model: areaCotizacion,
              attributes: ['id'],
              required: false,
              include: [
                { model: kitCotizacion, attributes: ['precio'], required: false },
                { model: productoCotizacion, attributes: ['precio'], required: false },
                {
                  model: serviceCotizacion,
                  as: 'serviciosCotizados',
                  attributes: ['precio'],
                  required: false,
                },
                { model: armadoCotizacion, attributes: ['precio'], required: false },
              ],
            },
          ],
        },
      ],
      order: [['nombre', 'ASC']],
    });

    const filas = [
      filaCsv(COLUMNAS_CSV),
      ...clientes.map(construirFilaCliente),
    ];

    const rutaCsv = path.join(__dirname, 'clientes_analisis.csv');
    fs.writeFileSync(rutaCsv, `${filas.join('\n')}\n`, 'utf8');

    console.log(`Archivo generado: ${rutaCsv}`);
    console.log(`Clientes procesados: ${clientes.length}`);

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('Error al ejecutar el análisis:', error);
    await db.close();
    process.exit(1);
  }
}

generarAnalisisClientes();
