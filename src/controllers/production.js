const { stock, areaProduction, itemAreaProduction, necesidadProyecto, comprasCotizacionItem, producto, materia, kit, requisicion, db } = require('../db/db');
const sequelize = db; // ✅ Sequelize instance para transacciones


async function createAreaProductionController(req, res) {
  try {
    const body = req.body || {};
    const {name, description   } = body;
    if (!name || !description) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'Parámetros inválidos' 
      });
    }
    
    const newAreaProduction = await areaProduction.create({
      name,
      description
    });

    return res.status(200).json({
      ok: true,
      msg: 'Area de producción creada correctamente',
      areaProduction: newAreaProduction
    }); 

    } catch (err) {
        console.error('createAreaProductionController error:', err);
        return res.status(400).json({ 
        ok: false, 
        msg: err.message,
    });
  }
}

/**
 * Crear ItemAreaProduction
 * POST /api/produccion/post/item-area
 * 
 * Body: {
 *   requisicionId: number,
 *   necesidadProyectoId: number (opcional),
 *   areaProductionId: number (2=Corte, 3=Tubería),
 *   kitId: number (opcional),
 *   productoId: number (opcional),
 *   cantidad: number,
 *   medida: string (opcional)
 * }
 */
async function createItemAreaProductionController(req, res) {
  try {
    const body = req.body || {};
    const {
      requisicionId,
      necesidadProyectoId,
      areaProductionId,
      kitId,
      productoId,
      cantidad,
      medida
    } = body;

    // Validaciones
    if (!requisicionId) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'requisicionId es requerido' 
      });
    }

    if (!areaProductionId) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'areaProductionId es requerido (2=Corte, 3=Tubería)' 
      });
    }

    if (!kitId && !productoId) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'Debe proporcionar kitId o productoId' 
      });
    }

    if (!cantidad || Number(cantidad) <= 0) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'cantidad debe ser mayor a 0' 
      });
    }

    // Validar que la requisición existe
    const req_exists = await requisicion.findByPk(requisicionId);
    if (!req_exists) {
      return res.status(404).json({ 
        ok: false, 
        msg: `Requisición ${requisicionId} no encontrada` 
      });
    }

    // Validar que el área existe
    const area_exists = await areaProduction.findByPk(areaProductionId);
    if (!area_exists) {
      return res.status(404).json({ 
        ok: false, 
        msg: `Área de producción ${areaProductionId} no encontrada` 
      });
    }

    // Crear el item de área de producción
    // ✅ La cantidad procesada arranca en 0
    const newItemArea = await itemAreaProduction.create({
      requisicionId,
      necesidadProyectoId: necesidadProyectoId || null,
      areaProductionId,
      kitId: kitId || null,
      productoId: productoId || null,
      cantidad: Number(cantidad),
      cantidadProcesada: 0, // ✅ Arranca en 0
      medida: medida || null,
      estado: 'pendiente', // ✅ Estado inicial
      notas: null,
      fechaInicio: null,
      fechaFin: null
    });

    console.log(`[PRODUCCIÓN] ✅ Item creado en área ${area_exists.name} para requisición ${requisicionId}`);

    return res.status(201).json({
      ok: true,
      msg: `Item agregado al área ${area_exists.name}`,
      itemAreaProduction: newItemArea
    });

  } catch (err) {
    console.error('createItemAreaProductionController error:', err);
    return res.status(400).json({ 
      ok: false, 
      msg: err.message,
      error: err.toString()
    });
  }
}

/**
 * Actualizar cantidades procesadas de un ItemAreaProduction
 * PUT /api/produccion/put/item-area/:id
 * 
 * ⚠️ IMPORTANTE: Esta función REEMPLAZA el valor de cantidadProcesada
 * 
 * Body: {
 *   cantidadProcesada: number,
 *   estado: string (opcional: 'pendiente' | 'en_proceso' | 'completado' | 'pausado'),
 *   notas: string (opcional)
 * }
 */
async function updateItemAreaProductionController(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const {
      cantidadProcesada,
      estado,
      notas
    } = body;

    if (!id) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'ID es requerido' 
      });
    }

    // Buscar el item
    const itemArea = await itemAreaProduction.findByPk(id, {
      include: [
        { model: areaProduction, attributes: ['id', 'name'] },
        { model: requisicion, attributes: ['id', 'folio'] }
      ]
    });

    if (!itemArea) {
      return res.status(404).json({ 
        ok: false, 
        msg: `ItemAreaProduction ${id} no encontrado` 
      });
    }

    // Actualizar campos
    if (cantidadProcesada !== undefined) {
      const cantidadNum = Number(cantidadProcesada);
      
      // Validar que no exceda la cantidad total
      if (cantidadNum > itemArea.cantidad) {
        return res.status(400).json({ 
          ok: false, 
          msg: `La cantidad procesada (${cantidadNum}) no puede ser mayor que la cantidad total (${itemArea.cantidad})` 
        });
      }

      // ⚠️ REEMPLAZA el valor
      itemArea.cantidadProcesada = cantidadNum;

      // ✅ Auto-actualizar estado según cantidad
      if (cantidadNum === 0) {
        itemArea.estado = 'pendiente';
      } else if (cantidadNum >= itemArea.cantidad) {
        itemArea.estado = 'completado';
        // Marcar fecha de finalización si no está marcada
        if (!itemArea.fechaFin) {
          itemArea.fechaFin = new Date();
        }
      } else {
        itemArea.estado = 'en_proceso';
        // Marcar fecha de inicio si no está marcada
        if (!itemArea.fechaInicio) {
          itemArea.fechaInicio = new Date();
        }
      }
    }

    // Permitir override manual del estado
    if (estado && ['pendiente', 'en_proceso', 'completado', 'pausado'].includes(estado)) {
      itemArea.estado = estado;

      // Actualizar fechas según estado
      if (estado === 'en_proceso' && !itemArea.fechaInicio) {
        itemArea.fechaInicio = new Date();
      }
      if (estado === 'completado' && !itemArea.fechaFin) {
        itemArea.fechaFin = new Date();
      }
    }

    if (notas !== undefined) {
      itemArea.notas = notas;
    }

    await itemArea.save();

    console.log(`[PRODUCCIÓN] ✅ Item ${id} actualizado (REEMPLAZADO) - Área: ${itemArea.areaProduction?.name}, Procesado: ${itemArea.cantidadProcesada}/${itemArea.cantidad}, Estado: ${itemArea.estado}`);

    return res.status(200).json({
      ok: true,
      msg: 'Item actualizado correctamente',
      itemAreaProduction: itemArea
    });

  } catch (err) {
    console.error('updateItemAreaProductionController error:', err);
    return res.status(400).json({ 
      ok: false, 
      msg: err.message,
      error: err.toString()
    });
  }
}

/**
 * Incrementar cantidades procesadas de un ItemAreaProduction
 * PUT /api/produccion/put/item-area/:id/incrementar
 * 
 * ⚠️ IMPORTANTE: Esta función SUMA a la cantidad ya procesada
 * 
 * Body: {
 *   cantidadProcesada: number (cantidad a SUMAR),
 *   notas: string (opcional)
 * }
 */
async function incrementarItemAreaProductionController(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const {
      cantidadProcesada,
      notas
    } = body;

    if (!id) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'ID es requerido' 
      });
    }

    if (!cantidadProcesada || Number(cantidadProcesada) <= 0) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'cantidadProcesada debe ser mayor a 0' 
      });
    }

    // Buscar el item
    const itemArea = await itemAreaProduction.findByPk(id, {
      include: [
        { model: areaProduction},
        { model: requisicion,}
      ]
    });

    if (!itemArea) {
      return res.status(404).json({ 
        ok: false, 
        msg: `ItemAreaProduction ${id} no encontrado` 
      });
    }

    const cantidadActual = Number(itemArea.cantidadProcesada || 0);
    const cantidadASumar = Number(cantidadProcesada);
    const nuevoTotal = cantidadActual + cantidadASumar;

    // Validar que no exceda la cantidad total
    if (nuevoTotal > itemArea.cantidad) {
      return res.status(400).json({ 
        ok: false, 
        msg: `La suma (${cantidadActual} + ${cantidadASumar} = ${nuevoTotal}) excede la cantidad total (${itemArea.cantidad})`,
        detalles: {
          cantidadActual,
          cantidadASumar,
          nuevoTotal,
          cantidadTotal: itemArea.cantidad,
          disponibleParaProcesar: itemArea.cantidad - cantidadActual
        }
      });
    }

    // ✅ SUMA a la cantidad existente
    itemArea.cantidadProcesada = nuevoTotal;

    // ✅ Auto-actualizar estado según cantidad
    if (nuevoTotal === 0) {
      itemArea.estado = 'pendiente';
    } else if (nuevoTotal >= itemArea.cantidad) {
      itemArea.estado = 'completado';
      // Marcar fecha de finalización si no está marcada
      if (!itemArea.fechaFin) {
        itemArea.fechaFin = new Date();
      }
    } else {
      itemArea.estado = 'en_proceso';
      // Marcar fecha de inicio si no está marcada
      if (!itemArea.fechaInicio) {
        itemArea.fechaInicio = new Date();
      }
    }

    // Agregar nota del incremento
    if (notas) {
      const notaIncremento = `[${new Date().toISOString()}] +${cantidadASumar}: ${notas}`;
      itemArea.notas = itemArea.notas 
        ? `${itemArea.notas}\n${notaIncremento}` 
        : notaIncremento;
    }

    await itemArea.save();

    console.log(`[PRODUCCIÓN] ✅ Item ${id} incrementado (+${cantidadASumar}) - Área: ${itemArea.areaProduction?.name}, Procesado: ${cantidadActual} → ${nuevoTotal}/${itemArea.cantidad}, Estado: ${itemArea.estado}`);

    return res.status(200).json({
      ok: true,
      msg: `Incrementado: +${cantidadASumar} (${cantidadActual} → ${nuevoTotal})`,
      itemAreaProduction: itemArea,
      detalles: {
        cantidadAnterior: cantidadActual,
        cantidadSumada: cantidadASumar,
        cantidadNueva: nuevoTotal,
        cantidadTotal: itemArea.cantidad,
        porcentajeCompletado: ((nuevoTotal / itemArea.cantidad) * 100).toFixed(2) + '%'
      }
    });

  } catch (err) {
    console.error('incrementarItemAreaProductionController error:', err);
    return res.status(400).json({ 
      ok: false, 
      msg: err.message,
      error: err.toString()
    });
  }
}

/**
 * Obtener items de producción por requisición
 * GET /api/produccion/get/requisicion/:requisicionId
 */
async function getItemsProduccionByRequisicionController(req, res) {
  try {
    const { requisicionId } = req.params;

    if (!requisicionId) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'requisicionId es requerido' 
      });
    }

    const items = await itemAreaProduction.findAll({
      where: { requisicionId },
      include: [
        { model: areaProduction, attributes: ['id', 'name', 'description'] },
        { model: kit, attributes: ['id', 'description'] },
        { model: producto, attributes: ['id', 'item'] },
        { model: necesidadProyecto, attributes: ['id', 'cantidadComprometida', 'cantidadEntregada', 'estado'] }
      ],
      order: [
        ['areaProductionId', 'ASC'],
        ['createdAt', 'ASC']
      ]
    });

    // Agrupar por área
    const porArea = items.reduce((acc, item) => {
      const areaNombre = item.areaProduction?.name || 'Sin área';
      if (!acc[areaNombre]) {
        acc[areaNombre] = [];
      }
      acc[areaNombre].push(item);
      return acc;
    }, {});

    return res.status(200).json({
      ok: true,
      requisicionId: Number(requisicionId),
      totalItems: items.length,
      porArea,
      items
    });

  } catch (err) {
    console.error('getItemsProduccionByRequisicionController error:', err);
    return res.status(400).json({ 
      ok: false, 
      msg: err.message
    });
  }
}

module.exports = {
  createAreaProductionController,
  createItemAreaProductionController,
  updateItemAreaProductionController,
  incrementarItemAreaProductionController,
  getItemsProduccionByRequisicionController
};