const { ubicacion, inventario, movimientoInventario, cotizacion_compromiso, } = require('../../db/db');

// Obtener datos de bodegas
async function getBodegaData(bodega){
  // Buscamos la bodega
  const getBodega = await ubicacion.findByPk(bodega);
  if(!getBodega) return null;

  // Caso contrario avanzamos
  const countAllData = await inventario.count({
    where: {
      ubicacionId: getBodega.id
    }
  })

  const bodegaResult = {
    nombre: getBodega.nombre,
    idBodega: getBodega.id,
    cantidad: countAllData
  }

  console.log(bodegaResult)
  return bodegaResult

}
// función para agregar materia prima primera vez
async function registrarMovimientoMPONE(materiaId) {
    // 1. Crear el movimiento
    const movimiento = await movimientoInventario.create({
        materiumId: materiaId,
        productoId:null,
        cantidad:0,
        tipoProducto: 'Materia Prima',
        tipoMovimiento: 'ENTRADA',
        referenciaDeDocumento: 'Ingreso',
        ubicacionOrigenId:1, 
        ubicacionDestinoId:1
    }); 
 
    // 2. Actualizar inventario según tipo
        await ajustarStock(materiaId, 1, 0);

    return movimiento;
}
// función para agregar producto terminado primera vez.
async function registrarMovimientoPTONE(productoId) {
    // 1. Crear el movimiento
    const movimiento = await movimientoInventario.create({
        materiumId: null,
        productoId:productoId,
        cantidad:0,
        tipoProducto: 'producto',
        tipoMovimiento: 'ENTRADA',
        referenciaDeDocumento: 'Ingreso',
        ubicacionOrigenId:2, 
        ubicacionDestinoId:2
    }); 
 
    // 2. Actualizar inventario según tipo
        await ajustarStockProducto(productoId, 2, 0);

    return movimiento;
}

async function registrarMovimiento({ materiaId, productoId, cantidad, tipoProducto, tipo, ubicacionOrigenId, ubicacionDestinoId, refDoc, cotizacionId }) {
    // 1. Crear el movimiento
    const movimiento = await movimientoInventario.create({
        materiumId: materiaId,
        productoId,
        cotizacionId,
        cantidad,
        tipoProducto,
        tipoMovimiento: tipo,
        referenciaDeDocumento: refDoc,
        ubicacionOrigenId, 
        ubicacionDestinoId
    }); 
 
    // 2. Actualizar inventario según tipo
    if(tipoProducto == 'Materia Prima'){
        if (tipo === 'ENTRADA') {
            await ajustarStock(materiaId, ubicacionDestinoId, cantidad);
        } 
        else if (tipo === 'SALIDA') {
            await ajustarStock(materiaId, ubicacionOrigenId, -cantidad);
        } 
        else if (tipo === 'TRANSFERENCIA') {
            if(ubicacionOrigenId == 4){
              await ajustarStock(materiaId, ubicacionOrigenId, -cantidad, cotizacionId);
              await ajustarStock(materiaId, ubicacionDestinoId, cantidad);
            }else{
              await ajustarStock(materiaId, ubicacionOrigenId, -cantidad);
              ajustarStock(materiaId, ubicacionDestinoId, cantidad, cotizacionId);
            }
        }
    }else if(tipoProducto == 'Producto'){


        if (tipo === 'ENTRADA') {
            await ajustarStockProducto(productoId, ubicacionDestinoId, cantidad);
        } 
        else if (tipo === 'SALIDA') {
            await ajustarStockProducto(productoId, ubicacionOrigenId, -cantidad);
        } 
        else if (tipo === 'TRANSFERENCIA') {
          if(ubicacionOrigenId == 4){
            await ajustarStockProducto(productoId, ubicacionOrigenId, -cantidad, cotizacionId);
            await ajustarStockProducto(productoId, ubicacionDestinoId, cantidad);
          }else{
            await ajustarStockProducto(productoId, ubicacionOrigenId, -cantidad);
            ajustarStockProducto(productoId, ubicacionDestinoId, cantidad, cotizacionId);
          }
        }
    } 
 
    return movimiento; 
}



 
async function ajustarStockProducto(productoId, ubicacionId, cantidad, cotizacionId) {
    let inventary = await inventario.findOne({ where: { productoId: productoId, ubicacionId } });
    if (!inventary) {
        inventary = await inventario.create({ productoId: productoId, ubicacionId, cantidad: 0, cantidadComprometida: 0 });
    }
    inventary.cantidad = parseFloat(inventary.cantidad) + parseFloat(cantidad);
    
    await inventary.save();

    if(cotizacionId){
      inventary.cantidadComprometida = parseFloat(inventary.cantidadComprometida) + parseFloat(cantidad);
      // await updateCompromiso(materiaId, cantidad, cotizacionId)
    } 
}



async function ajustarStock(materiaId, ubicacionId, cantidad, cotizacionId) {
    let inventary = await inventario.findOne({ where: { materiumId: materiaId, ubicacionId } });
    if (!inventary) {
        inventary = await inventario.create({ materiumId: materiaId, materiaId, ubicacionId, cantidad: 0, cantidadComprometida: 0 });
    }
    inventary.cantidad = parseFloat(inventary.cantidad) + parseFloat(cantidad);

    if(cotizacionId){
      inventary.cantidadComprometida = parseFloat(inventary.cantidadComprometida) + parseFloat(cantidad);
      await updateCompromiso(materiaId, cantidad, cotizacionId)
    }
    await inventary.save();
}
 

async function comprometerStock(materiaId, ubicacionId, cantidad) {
  let inv = await inventario.findOne({ where: { materiumId: materiaId, ubicacionId } });
  if (!inv) {
    inv = await inventario.create({ materiaId, ubicacionId, cantidad: 0, cantidadComprometida: 0 });
  }
  inv.cantidadComprometida = parseFloat(cantidad);
  await inv.save();
  return inv;
}


async function liberarCompromiso(materiaId, ubicacionId, cantidad) {
  let inv = await inventario.findOne({ where: { materiumId: materiaId, ubicacionId } });
  if (inv) {
    inv.cantidadComprometida = Math.max(0, parseFloat(inv.cantidadComprometida) - parseFloat(cantidad));
    await inv.save();
  }
  return inv; 
}

async function createCompromiso(materiaId, cantidadComprometida, cotizacionId){
  // Procedemos a crear el compromiso
  let createCompromiso = await cotizacion_compromiso.create({
    cantidadComprometida,
    cantidadEntrega: 0,
    estado: 'reservado',
    materiaId,
    materiumId: materiaId,
    cotizacionId,
    ubicacionId: 3
  })

  return createCompromiso;
}

// Actualizar compromiso
async function updateCompromiso(materiaId, entrega, cotizacionId){
  // Consultamos compromiso
  const consulta = await cotizacion_compromiso.findOne({
    where: {
      materiumId: materiaId,
      cotizacionId
    }
  });
  // Si no hay, enviamos null
  if(!consulta) return null;
  // Avanzamos...
  console.log('LLEGA ACA')
  let cantidadEnCompromiso = consulta.cantidadComprometida;
  let cantidadEnEntregada = consulta.cantidadEntregada;
  let totalEntrega = Number(cantidadEnEntregada) + parseFloat(entrega);
  let estadoData = totalEntrega >= cantidadEnCompromiso ? 'completo' : 'parcial';
  // Procedemos a crear el compromiso
  let actualizarCompromiso = await cotizacion_compromiso.update({
    cantidadEntregada: totalEntrega,
    estado: estadoData,
  }, {
    where: {
      materiumId:materiaId,
      cotizacionId
    }
  })

  return actualizarCompromiso;
}


module.exports = {
    getBodegaData, // Contamos elementos de una bodega
    registrarMovimiento, // Registrar movimientos y anexa materia prima
    registrarMovimientoMPONE, // Registrar materia prima en estado básico.
    registrarMovimientoPTONE, // Registrar producto comercializable en estado básico
    comprometerStock, // Comprometer stock de materia prima CUANDO la cotización se aprueba.
    createCompromiso, // Cremos un compromiso por cada uno de los elementos.
    updateCompromiso, // Actualizamos el compromiso que se entrega
}