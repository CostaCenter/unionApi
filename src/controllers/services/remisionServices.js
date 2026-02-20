const { remision, cotizacion, client, itemRemision, necesidadProyecto, stock, stockMove, requisicion, producto, kit, db } = require('../../db/db');
const { Op } = require('sequelize');
const sequelize = db;

/**
 * FUNCIÓN PRINCIPAL: Ingresar cantidades listas para remisión
 * 
 * Esta función:
 * 1. Actualiza necesidadProyecto (cantidadEntregada, estado)
 * 2. Crea o actualiza remisión activa
 * 3. Crea o actualiza itemRemision
 * 4. Ingresa el stock en bodega 8 (Listo)
 * 
 * TODO ES TRANSACCIONAL
 */
async function ingresarCantidadListaParaRemision({
  necesidadProyectoId,
  cantidad,
  medida = null,
  notas = null,
  usuarioId = null
}) {
  
  // Validaciones iniciales
  if (!necesidadProyectoId) {
    throw new Error('necesidadProyectoId es requerido');
  }
  
  if (!cantidad || Number(cantidad) <= 0) {
    throw new Error('cantidad debe ser mayor a 0');
  }

  return await sequelize.transaction(async (t) => {
    
    // 1. OBTENER LA NECESIDAD DEL PROYECTO
    const necesidad = await necesidadProyecto.findByPk(necesidadProyectoId, {
      include: [
        { model: requisicion },
        { model: kit },
        { model: producto}
      ],
      transaction: t
      // lock removido - no se puede usar con LEFT JOINs (includes opcionales)
      // La transacción ya protege la integridad de los datos
    });

    if (!necesidad) {
      throw new Error(`necesidadProyecto con ID ${necesidadProyectoId} no encontrado`);
    }

    const requisicionId = necesidad.requisicionId;
    const cantidadComprometida = Number(necesidad.cantidadComprometida || 0);
    const cantidadEntregadaActual = Number(necesidad.cantidadEntregada || 0);
    const cantidadAIngresar = Number(cantidad);
    
    // 2. VALIDAR QUE NO EXCEDA LO COMPROMETIDO
    const nuevoTotalEntregado = cantidadEntregadaActual + cantidadAIngresar;
    
    if (nuevoTotalEntregado > cantidadComprometida) {
      throw new Error(
        `No se puede entregar más de lo comprometido. ` +
        `Comprometido: ${cantidadComprometida}, ` +
        `Ya entregado: ${cantidadEntregadaActual}, ` +
        `Intentas agregar: ${cantidadAIngresar}, ` +
        `Nuevo total: ${nuevoTotalEntregado}`
      );
    }

    // 3. ACTUALIZAR NECESIDAD (cantidadEntregada y estado)
    necesidad.cantidadEntregada = nuevoTotalEntregado;
    
    // Actualizar estado según cantidades
    if (nuevoTotalEntregado === 0) {
      necesidad.estado = 'reservado';
    } else if (nuevoTotalEntregado >= cantidadComprometida) {
      necesidad.estado = 'completo';
    } else {
      necesidad.estado = 'parcial';
    }
    
    await necesidad.save({ transaction: t });

    console.log(`[REMISIÓN] ✅ Necesidad ${necesidadProyectoId} actualizada: ${cantidadEntregadaActual} → ${nuevoTotalEntregado} (${necesidad.estado})`);

    // 4. BUSCAR O CREAR REMISIÓN ACTIVA
    let remisionActiva = await remision.findOne({
      where: {
        requisicionId,
        estado: 'Activa'
      },
      transaction: t
    });

    if (!remisionActiva) {
      // Generar número de remisión
      const folio = necesidad.requisicion?.folio || requisicionId;
      const timestamp = Date.now();
      const numeroRemision = `REM-${folio}-${timestamp}`;

      remisionActiva = await remision.create({
        requisicionId,
        numeroRemision,
        estado: 'Activa',
        observaciones: `Remisión creada automáticamente`,
        usuarioId
      }, { transaction: t });

      console.log(`[REMISIÓN] ✅ Nueva remisión creada: ${numeroRemision}`);
    } else {
      console.log(`[REMISIÓN] ℹ️ Usando remisión activa existente: ${remisionActiva.numeroRemision}`);
    }

    // 5. BUSCAR O CREAR/ACTUALIZAR ITEM DE REMISIÓN
    const productoId = necesidad.productoId || null;
    const kitId = necesidad.kitId || null;

    let itemRemisionExistente = await itemRemision.findOne({
      where: {
        remisionId: remisionActiva.id,
        necesidadProyectoId
      },
      transaction: t
    });

    if (itemRemisionExistente) {
      // ACTUALIZAR: Sumar la nueva cantidad
      const cantidadAnterior = Number(itemRemisionExistente.cantidad || 0);
      const nuevaCantidad = cantidadAnterior + cantidadAIngresar;
      
      itemRemisionExistente.cantidad = nuevaCantidad;
      if (medida) itemRemisionExistente.medida = medida;
      if (notas) {
        const notaConTimestamp = `[${new Date().toISOString()}] +${cantidadAIngresar}: ${notas}`;
        itemRemisionExistente.notas = itemRemisionExistente.notas 
          ? `${itemRemisionExistente.notas}\n${notaConTimestamp}`
          : notaConTimestamp;
      }
      
      await itemRemisionExistente.save({ transaction: t });
      
      console.log(`[REMISIÓN] ✅ Item de remisión actualizado: ${cantidadAnterior} → ${nuevaCantidad}`);
    } else {
      // CREAR NUEVO
      itemRemisionExistente = await itemRemision.create({
        remisionId: remisionActiva.id,
        necesidadProyectoId,
        productoId,
        kitId,
        cantidad: cantidadAIngresar,
        medida: medida || necesidad.medida || null,
        estado: 'Pendiente',
        notas: notas ? `[${new Date().toISOString()}] ${notas}` : null
      }, { transaction: t });
      
      console.log(`[REMISIÓN] ✅ Nuevo item de remisión creado: cantidad ${cantidadAIngresar}`);
    }

    // 6. INGRESAR STOCK EN BODEGA 8 (LISTO)
    const bodegaListoId = 8;
    
    // Buscar o crear stock en bodega 8
    let whereStock = { ubicacionId: bodegaListoId };
    if (productoId) {
      whereStock.productoId = productoId;
      if (medida) whereStock.medida = medida;
    } else if (kitId) {
      whereStock.kitId = kitId;
    }

    let stockListo = await stock.findOne({ where: whereStock, transaction: t });

    if (!stockListo) {
      // Crear nuevo stock
      stockListo = await stock.create({
        cantidad: cantidadAIngresar,
        unidad: necesidad.producto?.unidad || necesidad.kit?.unidad || 'unidad',
        medida: medida || necesidad.medida || null,
        tipo: productoId ? 'PR' : 'KIT',
        ubicacionId: bodegaListoId,
        productoId,
        kitId,
        state: 'Disponible'
      }, { transaction: t });
      
      console.log(`[REMISIÓN] ✅ Stock creado en bodega ${bodegaListoId}: ${cantidadAIngresar}`);
    } else {
      // Actualizar stock existente
      const cantidadAnteriorStock = Number(stockListo.cantidad || 0);
      stockListo.cantidad = cantidadAnteriorStock + cantidadAIngresar;
      await stockListo.save({ transaction: t });
      
      console.log(`[REMISIÓN] ✅ Stock actualizado en bodega ${bodegaListoId}: ${cantidadAnteriorStock} → ${stockListo.cantidad}`);
    }

    // 7. REGISTRAR MOVIMIENTO DE STOCK
    await stockMove.create({
      cantidad: cantidadAIngresar,
      tipoProducto: productoId ? 'PR' : 'KIT',
      tipoMovimiento: 'INGRESO_LISTO',
      referenciaDeDocumento: `LISTO_REM_${remisionActiva.numeroRemision}_NEC_${necesidadProyectoId}`,
      notas: `Ingreso a bodega Listo desde producción. ${notas || ''}`,
      bodegaDestinoId: bodegaListoId,
      bodegaOrigenId: null,
      stockId: stockListo.id,
      productoId,
      kitId
    }, { transaction: t });

    // 8. RETORNAR RESULTADO
    return {
      ok: true,
      necesidadProyecto: {
        id: necesidad.id,
        cantidadComprometida,
        cantidadEntregadaAnterior: cantidadEntregadaActual,
        cantidadEntregadaNueva: nuevoTotalEntregado,
        cantidadIngresada: cantidadAIngresar,
        estado: necesidad.estado
      },
      remision: {
        id: remisionActiva.id,
        numeroRemision: remisionActiva.numeroRemision,
        estado: remisionActiva.estado
      },
      itemRemision: {
        id: itemRemisionExistente.id,
        cantidad: itemRemisionExistente.cantidad
      },
      stock: {
        bodega: bodegaListoId,
        cantidad: stockListo.cantidad
      }
    };
  });
}

/**
 * FUNCIÓN: Remisionar (cambiar estado a Remisionada y hacer salida de inventario)
 * 
 * Esta función:
 * 1. Valida que la remisión exista y esté Activa
 * 2. Valida que haya stock suficiente en bodega 8 para todos los items
 * 3. Hace salida de inventario de bodega 8
 * 4. Actualiza estado de remisión a "Remisionada"
 * 5. Actualiza estado de items a "Remisionado"
 * 
 * TODO ES TRANSACCIONAL
 */
async function remisionarDocumento({ remisionId, usuarioId = null }) {
  
  if (!remisionId) {
    throw new Error('remisionId es requerido');
  }

  return await sequelize.transaction(async (t) => {
    
    // 1. OBTENER LA REMISIÓN
    const rem = await remision.findByPk(remisionId, {
      include: [
        { model: requisicion, attributes: ['id', 'folio'] },
        {
          model: itemRemision,
          include: [
            { model: producto, attributes: ['id', 'item', 'unidad'] },
            { model: kit, attributes: ['id', 'description'] }
          ]
        }
      ],
      transaction: t
      // lock removido - no se puede usar con LEFT JOINs (includes opcionales)
    });

    if (!rem) {
      throw new Error(`Remisión con ID ${remisionId} no encontrada`);
    }

    if (rem.estado !== 'Activa') {
      throw new Error(`La remisión ${rem.numeroRemision} no está Activa (estado actual: ${rem.estado})`);
    }

    if (!rem.itemRemisions || rem.itemRemisions.length === 0) {
      throw new Error(`La remisión ${rem.numeroRemision} no tiene items`);
    }

    const bodegaListoId = 8;
    const itemsRemisionados = [];

    // 2. VALIDAR Y PROCESAR CADA ITEM
    for (const item of rem.itemRemisions) {
      const cantidadRemisionar = Number(item.cantidad || 0);
      const productoId = item.productoId || null;
      const kitId = item.kitId || null;
      const medida = item.medida || null;

      // Buscar stock en bodega 8
      let whereStock = { ubicacionId: bodegaListoId };
      if (productoId) {
        whereStock.productoId = productoId;
        if (medida) whereStock.medida = medida;
      } else if (kitId) {
        whereStock.kitId = kitId;
      }

      const stockDisponible = await stock.findOne({ 
        where: whereStock, 
        transaction: t,
        lock: t.LOCK.UPDATE // OK - no hay includes, solo tabla stock
      });

      if (!stockDisponible) {
        const nombreItem = item.producto?.item || item.kit?.description || `ID: ${productoId || kitId}`;
        throw new Error(
          `No hay stock en bodega ${bodegaListoId} para ${nombreItem}. ` +
          `Necesitas: ${cantidadRemisionar}`
        );
      }

      const cantidadDisponibleStock = Number(stockDisponible.cantidad || 0);

      if (cantidadDisponibleStock < cantidadRemisionar) {
        const nombreItem = item.producto?.item || item.kit?.description || `ID: ${productoId || kitId}`;
        throw new Error(
          `Stock insuficiente en bodega ${bodegaListoId} para ${nombreItem}. ` +
          `Disponible: ${cantidadDisponibleStock}, Necesario: ${cantidadRemisionar}`
        );
      }

      // HACER SALIDA DE INVENTARIO
      stockDisponible.cantidad = cantidadDisponibleStock - cantidadRemisionar;
      if (stockDisponible.cantidad <= 0) {
        stockDisponible.state = 'Agotado';
      }
      await stockDisponible.save({ transaction: t });

      console.log(`[REMISIÓN] ✅ Salida de stock: ${nombreItem}, ${cantidadDisponibleStock} → ${stockDisponible.cantidad}`);

      // REGISTRAR MOVIMIENTO
      await stockMove.create({
        cantidad: cantidadRemisionar,
        tipoProducto: productoId ? 'PR' : 'KIT',
        tipoMovimiento: 'SALIDA_REMISION',
        referenciaDeDocumento: `REMISION_${rem.numeroRemision}_REQ_${rem.requisicionId}`,
        notas: `Salida por remisión ${rem.numeroRemision}`,
        bodegaOrigenId: bodegaListoId,
        bodegaDestinoId: null,
        stockId: stockDisponible.id,
        productoId,
        kitId
      }, { transaction: t });

      // ACTUALIZAR ESTADO DEL ITEM
      item.estado = 'Remisionado';
      await item.save({ transaction: t });

      itemsRemisionados.push({
        itemRemisionId: item.id,
        productoId,
        kitId,
        cantidad: cantidadRemisionar,
        nombre: item.producto?.item || item.kit?.description
      });
    }

    // 3. ACTUALIZAR ESTADO DE LA REMISIÓN
    rem.estado = 'Remisionada';
    rem.fechaRemision = new Date();
    await rem.save({ transaction: t });

    console.log(`[REMISIÓN] ✅✅✅ Remisión ${rem.numeroRemision} REMISIONADA exitosamente`);

    return {
      ok: true,
      remision: {
        id: rem.id,
        numeroRemision: rem.numeroRemision,
        estado: rem.estado,
        fechaRemision: rem.fechaRemision,
        requisicionId: rem.requisicionId,
        folio: rem.requisicion?.folio
      },
      itemsRemisionados,
      totalItems: itemsRemisionados.length
    };
  });
}

/**
 * FUNCIÓN: Obtener todas las remisiones con paginación
 * 
 * @param {Object} options - Opciones de consulta
 * @param {Number} options.page - Número de página (default: 1)
 * @param {Number} options.limit - Items por página (default: 50)
 * @param {String} options.estado - Filtro por estado (opcional: 'Activa', 'Remisionada', 'Cancelada')
 * @param {Number} options.requisicionId - Filtro por requisición (opcional)
 * @returns {Object} - Lista de remisiones con metadata de paginación
 */
async function getAllRemisiones({ page = 1, limit = 50, estado = null, requisicionId = null } = {}) {
  try {
    // Validar página y límite
    const pageNumber = Math.max(1, parseInt(page) || 1);
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit) || 50)); // Máximo 100 por página
    const offset = (pageNumber - 1) * limitNumber;

    // Construir filtros
    const where = {};
    if (estado) {
      where.estado = estado;
    }
    if (requisicionId) {
      where.requisicionId = parseInt(requisicionId);
    }

    // Consultar remisiones con paginación
    const { count, rows } = await remision.findAndCountAll({
      where,
      include: [
        { 
            model: requisicion,
            include: [{
                model: cotizacion,
                include: [{
                    model: client,
                }]
            }]
         },
        {
          model: itemRemision,
          include: [
            { model: producto, attributes: ['id', 'item', 'unidad'] },
            { model: kit, attributes: ['id', 'description'] },
            { model: necesidadProyecto, attributes: ['id', 'cantidadComprometida', 'cantidadEntregada', 'estado'] }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: limitNumber,
      offset: offset
    });

    // Calcular metadata de paginación
    const totalPages = Math.ceil(count / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPrevPage = pageNumber > 1;

    return {
      ok: true,
      remisiones: rows,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
        itemsInCurrentPage: rows.length,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNumber + 1 : null,
        prevPage: hasPrevPage ? pageNumber - 1 : null
      }
    };

  } catch (err) {
    console.error('[REMISIÓN] Error en getAllRemisiones:', err);
    throw err;
  }
}

/**
 * FUNCIÓN: Actualizar datos de remisión
 * 
 * Actualiza los campos: placa, guia, cajas, oc, ov, fechaRemision, observaciones
 * 
 * @param {Number} remisionId - ID de la remisión a actualizar
 * @param {Object} datos - Datos a actualizar
 * @param {String} datos.placa - Placa del vehículo (opcional)
 * @param {String} datos.guia - Número de guía (opcional)
 * @param {Number} datos.cajas - Cantidad de cajas (opcional)
 * @param {String} datos.oc - Orden de compra (opcional)
 * @param {String} datos.ov - Orden de venta (opcional)
 * @param {Date|String} datos.fechaRemision - Fecha de remisión (opcional)
 * @param {String} datos.observaciones - Observaciones generales (opcional)
 * @returns {Object} - Remisión actualizada
 */
async function actualizarDatosRemision(remisionId, datos = {}) {
  try {
    if (!remisionId) {
      throw new Error('remisionId es requerido');
    }

    // Buscar la remisión
    const rem = await remision.findByPk(remisionId);

    if (!rem) {
      throw new Error(`Remisión con ID ${remisionId} no encontrada`);
    }

    // Preparar datos a actualizar
    const datosActualizar = {};

    if (datos.placa !== undefined) {
      datosActualizar.placa = datos.placa;
    }
    if (datos.guia !== undefined) {
      datosActualizar.guia = datos.guia;
    }
    if (datos.cajas !== undefined) {
      datosActualizar.cajas = datos.cajas;
    }
    if (datos.oc !== undefined) {
      datosActualizar.oc = datos.oc;
    }
    if (datos.ov !== undefined) {
      datosActualizar.ov = datos.ov;
    }
    if (datos.fechaRemision !== undefined) {
      // Si es string, convertir a Date
      datosActualizar.fechaRemision = datos.fechaRemision instanceof Date 
        ? datos.fechaRemision 
        : new Date(datos.fechaRemision);
    }
    if (datos.observaciones !== undefined) {
      datosActualizar.observaciones = datos.observaciones;
    }

    // Actualizar solo los campos proporcionados
    await rem.update(datosActualizar);

    console.log(`[REMISIÓN] ✅ Datos actualizados para remisión ${rem.numeroRemision}`);

    // Retornar la remisión actualizada
    return await remision.findByPk(remisionId, {
      include: [
        { 
          model: requisicion,
          include: [{
            model: cotizacion,
            include: [{
              model: client
            }]
          }]
        },
        {
          model: itemRemision,
          include: [
            { model: producto, attributes: ['id', 'item', 'unidad'] },
            { model: kit, attributes: ['id', 'description'] },
            { model: necesidadProyecto, attributes: ['id', 'cantidadComprometida', 'cantidadEntregada', 'estado'] }
          ]
        }
      ]
    });

  } catch (err) {
    console.error('[REMISIÓN] Error en actualizarDatosRemision:', err);
    throw err;
  }
}

module.exports = {
  ingresarCantidadListaParaRemision,
  remisionarDocumento,
  getAllRemisiones,
  actualizarDatosRemision
};
