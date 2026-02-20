const { ubicacion, materia, producto, inventario, movimientoInventario, inventarioItemFisico, cotizacion_compromiso, comprasCotizacionItem, itemToProject, requisicion, db } = require('../../db/db');
const { Op, QueryTypes } = require('sequelize');

const sequelize = db;

/**
 * Detecta si una unidad de medida requiere transferencia de piezas completas
 * @param {string} unidad - Unidad de medida (mt2, mt, kg, unidad, etc.)
 * @returns {boolean} - true si requiere piezas completas
 */
function requierePiezasCompletas(unidad) {
  if (!unidad) return false;
  const unidadLower = String(unidad).toLowerCase().trim();
  return unidadLower === 'mt2' || unidadLower === 'mt';
}

/**
 * Obtiene la información de una materia prima o producto para determinar su unidad
 * @param {number} materiumId - ID de materia prima (opcional)
 * @param {number} productoId - ID de producto (opcional)
 * @returns {Promise<{id: number, unidad: string, tipo: 'MP'|'PR'}>}
 */
async function obtenerUnidadItem(materiumId, productoId) {
  if (materiumId) {
    const mp = await materia.findByPk(materiumId, {
      attributes: ['id', 'unidad'],
      raw: true
    });
    if (!mp) throw new Error(`Materia prima con id ${materiumId} no encontrada.`);
    return { id: mp.id, unidad: mp.unidad || null, tipo: 'MP' };
  }
  
  if (productoId) {
    const pr = await producto.findByPk(productoId, {
      attributes: ['id', 'unidad'],
      raw: true
    });
    if (!pr) throw new Error(`Producto con id ${productoId} no encontrada.`);
    return { id: pr.id, unidad: pr.unidad || null, tipo: 'PR' };
  }
  
  throw new Error('Debe especificar materiumId o productoId.');
}

/**
 * Transfiere piezas completas desde bodega origen a bodega destino
 * Para unidades mt2 y mt: transfiere piezas completas
 * Para otras unidades: transfiere cantidad exacta
 * 
 * @param {Object} params
 * @param {number} params.materiumId - ID de materia prima (opcional)
 * @param {number} params.productoId - ID de producto (opcional)
 * @param {number} params.cantidadSolicitada - Cantidad solicitada
 * @param {number} params.ubicacionOrigenId - Bodega origen (1 para MP, 2 para PT)
 * @param {number} params.ubicacionDestinoId - Bodega destino (4 para MP, 5 para PT)
 * @param {string} params.refDoc - Referencia del documento
 * @param {number} params.comprasCotizacionId - ID de orden de compra (OBLIGATORIO)
 * @param {number} params.cotizacionId - ID de cotización (opcional, puede venir de orden de compra)
 * @param {number} params.usuarioId - ID de usuario (opcional)
 * @param {string} params.ordenarPor - 'DESC' piezas grandes primero, 'ASC' pequeñas primero
 * @returns {Promise<Object>} - Resultado de la transferencia
 */
async function trasladarPiezasCompletasVersion({
  materiumId = null,
  productoId = null,
  cantidadSolicitada,
  ubicacionOrigenId,
  ubicacionDestinoId,
  refDoc,
  comprasCotizacionId, // OBLIGATORIO
  cotizacionId = null,
  usuarioId = null,
  ordenarPor = 'DESC'
}) {
  // Validaciones básicas
  if (!materiumId && !productoId) {
    throw new Error('Debe especificar materiumId o productoId.');
  }
  if (!ubicacionOrigenId || !ubicacionDestinoId) {
    throw new Error('Requiere ubicacionOrigenId y ubicacionDestinoId.');
  }
  if (!comprasCotizacionId) {
    throw new Error('comprasCotizacionId es obligatorio para transferencias versionadas.');
  }
  
  const cantidad = parseFloat(cantidadSolicitada);
  if (isNaN(cantidad) || cantidad <= 0) {
    throw new Error('La cantidad a trasladar debe ser mayor que 0.');
  }

  // Obtener información del item para determinar unidad
  const itemInfo = await obtenerUnidadItem(materiumId, productoId);
  const necesitaPiezasCompletas = requierePiezasCompletas(itemInfo.unidad);

  const EPS = 0.0001;
  const campoFiltro = productoId ? 'productoId' : 'materiumId';
  const idFiltro = productoId ? productoId : materiumId;
  const tipoProducto = productoId ? 'PR' : 'MP';

  console.log(`[TRASLADAR_PIEZAS_VERSION] Iniciando transferencia:`, {
    materiumId,
    productoId,
    cantidadSolicitada: cantidad,
    ubicacionOrigenId,
    ubicacionDestinoId,
    comprasCotizacionId,
    campoFiltro,
    idFiltro
  });

  return await sequelize.transaction(async (t) => {
    // 1) Obtener items disponibles en origen y bloquearlos
    console.log(`[TRASLADAR_PIEZAS_VERSION] Buscando items disponibles en origen:`, {
      campoFiltro,
      idFiltro,
      ubicacionOrigenId
    });

    const itemsDisponibles = await inventarioItemFisico.findAll({
      where: {
        [campoFiltro]: idFiltro,
        ubicacionId: ubicacionOrigenId,
        cantidadDisponible: { [Op.gt]: 0 }
      },
      order: [['cantidadDisponible', ordenarPor]],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    console.log(`[TRASLADAR_PIEZAS_VERSION] Items encontrados:`, {
      cantidad: itemsDisponibles.length,
      items: itemsDisponibles.map(it => ({
        id: it.id,
        cantidadDisponible: it.cantidadDisponible,
        comprasCotizacionId: it.comprasCotizacionId
      }))
    });

    if (!itemsDisponibles || itemsDisponibles.length === 0) {
      const errorMsg = `No hay ítems disponibles en la ubicación de origen. Item ID: ${idFiltro}, Ubicación: ${ubicacionOrigenId}`;
      console.error(`[TRASLADAR_PIEZAS_VERSION] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // 2) Verificar stock total
    const stockTotal = itemsDisponibles.reduce((s, it) => s + parseFloat(it.cantidadDisponible), 0);
    console.log(`[TRASLADAR_PIEZAS_VERSION] Stock disponible:`, {
      stockTotal,
      cantidadSolicitada: cantidad,
      diferencia: stockTotal - cantidad
    });

    if (stockTotal + EPS < cantidad) {
      const errorMsg = `Stock insuficiente. Necesario: ${cantidad}. Disponible: ${stockTotal}. Item ID: ${idFiltro}, Ubicación: ${ubicacionOrigenId}`;
      console.error(`[TRASLADAR_PIEZAS_VERSION] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // 3) Lógica de selección según tipo de unidad
    let restante = cantidad;
    const detalles = [];

    if (necesitaPiezasCompletas) {
      // Para mt2 y mt: Transferir piezas completas
      // ✅ AGRUPAR: Procesar todos los items y crear movimientos agrupados con el total
      const itemsProcesados = [];
      const itemsFisicosOrigenIds = [];
      
      for (const pieza of itemsDisponibles) {
        if (restante <= EPS) break;
        
        const stockActual = parseFloat(pieza.cantidadDisponible);
        if (stockActual <= EPS) continue;

        const aTransferir = stockActual; // Siempre pieza completa
        const origenId = pieza.id;

        // Actualizar pieza origen (se consume completamente)
        await pieza.update({
          cantidadDisponible: 0,
          estado: 'Agotada',
          esRemanente: false
        }, { transaction: t });

        // Crear nuevo item en destino (pieza completa trasladada)
        const nuevoItem = await inventarioItemFisico.create({
          [campoFiltro]: idFiltro,
          ubicacionId: ubicacionDestinoId,
          cantidadDisponible: aTransferir,
          longitudInicial: pieza.longitudInicial !== undefined ? pieza.longitudInicial : aTransferir,
          estado: 'Disponible',
          esRemanente: false,
          parent_item_fisico_id: origenId || null,
          comprasCotizacionId: comprasCotizacionId || null
        }, { transaction: t });

        itemsProcesados.push({
          origenId,
          nuevoItemId: nuevoItem.id,
          cantidadTransferida: aTransferir,
          piezaCompleta: true
        });
        
        itemsFisicosOrigenIds.push(origenId);
        restante = +(restante - aTransferir);
      }

      // ✅ Crear movimientos AGRUPADOS con el total (no uno por pieza)
      if (itemsProcesados.length > 0) {
        const cantidadTotalTransferida = itemsProcesados.reduce((sum, item) => sum + parseFloat(item.cantidadTransferida), 0);
        const primerItemDestino = itemsProcesados[0].nuevoItemId;

        // UN SOLO movimiento SALIDA con el total
        const movSalida = await movimientoInventario.create({
          materiumId: materiumId || null,
          productoId: productoId || null,
          cotizacionId: cotizacionId,
          comprasCotizacionId: comprasCotizacionId,
          cantidad: cantidadTotalTransferida, // ✅ Total agrupado
          tipoProducto,
          tipoMovimiento: 'SALIDA',
          referenciaDeDocumento: refDoc,
          ubicacionOrigenId,
          ubicacionDestinoId,
          itemFisicoId: itemsFisicosOrigenIds[0] || null, // Primer item origen como referencia
          usuarioId,
          notas: `Salida agrupada de ${itemsProcesados.length} item(s) físico(s) - Total: ${cantidadTotalTransferida}`
        }, { transaction: t });

        // UN SOLO movimiento ENTRADA con el total
        const movEntrada = await movimientoInventario.create({
          materiumId: materiumId || null,
          productoId: productoId || null,
          cotizacionId: cotizacionId,
          comprasCotizacionId: comprasCotizacionId,
          cantidad: cantidadTotalTransferida, // ✅ Total agrupado
          tipoProducto,
          tipoMovimiento: 'ENTRADA',
          referenciaDeDocumento: refDoc,
          ubicacionOrigenId,
          ubicacionDestinoId,
          itemFisicoId: primerItemDestino,
          usuarioId,
          notas: `Entrada agrupada de ${itemsProcesados.length} item(s) físico(s) - Total: ${cantidadTotalTransferida}`
        }, { transaction: t });

        // UN SOLO movimiento TRANSFERENCIA con el total
        const movTransferencia = await movimientoInventario.create({
          materiumId: materiumId || null,
          productoId: productoId || null,
          cotizacionId: cotizacionId,
          comprasCotizacionId: comprasCotizacionId,
          cantidad: cantidadTotalTransferida, // ✅ Total agrupado
          tipoProducto,
          tipoMovimiento: 'TRANSFERENCIA',
          referenciaDeDocumento: refDoc,
          ubicacionOrigenId,
          ubicacionDestinoId,
          itemFisicoId: primerItemDestino,
          usuarioId,
          notas: `Transferencia agrupada: ${itemsProcesados.length} item(s) físico(s) - Total: ${cantidadTotalTransferida}`
        }, { transaction: t });

        // Actualizar detalles con IDs de movimientos agrupados
        detalles.push(...itemsProcesados.map(item => ({
          ...item,
          movSalidaId: movSalida.id,
          movEntradaId: movEntrada.id
        })));
      }
    } else {
      // Para kg, unidades, etc.: Transferir cantidad exacta (comportamiento normal)
      // ✅ AGRUPAR: Procesar todos los items y crear movimientos agrupados con el total
      const itemsProcesados = [];
      const itemsFisicosOrigenIds = [];
      
      for (const pieza of itemsDisponibles) {
        if (restante <= EPS) break;
        
        const origenId = pieza.id;
        const stockActual = parseFloat(pieza.cantidadDisponible);
        if (stockActual <= EPS) continue;

        const aConsumir = Math.min(restante, stockActual);
        const nuevoStockOrigen = +(stockActual - aConsumir);

        // Actualizar pieza origen
        let nuevoEstadoOrigen = 'Cortada';
        let esRemanenteOrigen = true;
        if (nuevoStockOrigen <= EPS) {
          nuevoEstadoOrigen = 'Agotada';
          esRemanenteOrigen = false;
        }

        await pieza.update({
          cantidadDisponible: nuevoStockOrigen,
          estado: nuevoEstadoOrigen,
          esRemanente: esRemanenteOrigen
        }, { transaction: t });

        // Crear nuevo item en destino
        const nuevoItem = await inventarioItemFisico.create({
          [campoFiltro]: idFiltro,
          ubicacionId: ubicacionDestinoId,
          cantidadDisponible: aConsumir,
          longitudInicial: pieza.longitudInicial !== undefined ? pieza.longitudInicial : aConsumir,
          estado: 'Disponible',
          esRemanente: false,
          parent_item_fisico_id: origenId || null,
          comprasCotizacionId: comprasCotizacionId || null
        }, { transaction: t });

        itemsProcesados.push({
          origenId,
          nuevoItemId: nuevoItem.id,
          cantidadTransferida: aConsumir,
          nuevoStockOrigen,
          piezaCompleta: false
        });
        
        itemsFisicosOrigenIds.push(origenId);
        restante = +(restante - aConsumir);
      }

      // ✅ Crear movimientos AGRUPADOS con el total (no uno por pieza)
      if (itemsProcesados.length > 0) {
        const cantidadTotalTransferida = itemsProcesados.reduce((sum, item) => sum + parseFloat(item.cantidadTransferida), 0);
        const primerItemDestino = itemsProcesados[0].nuevoItemId;

        // UN SOLO movimiento SALIDA con el total
        const movSalida = await movimientoInventario.create({
          materiumId: materiumId || null,
          productoId: productoId || null,
          cotizacionId: cotizacionId,
          comprasCotizacionId: comprasCotizacionId,
          cantidad: cantidadTotalTransferida, // ✅ Total agrupado
          tipoProducto,
          tipoMovimiento: 'SALIDA',
          referenciaDeDocumento: refDoc,
          ubicacionOrigenId,
          ubicacionDestinoId,
          itemFisicoId: itemsFisicosOrigenIds[0] || null, // Primer item origen como referencia
          usuarioId,
          notas: `Salida agrupada de ${itemsProcesados.length} item(s) físico(s) - Total: ${cantidadTotalTransferida}`
        }, { transaction: t });

        // UN SOLO movimiento ENTRADA con el total
        const movEntrada = await movimientoInventario.create({
          materiumId: materiumId || null,
          productoId: productoId || null,
          cotizacionId: cotizacionId,
          comprasCotizacionId: comprasCotizacionId,
          cantidad: cantidadTotalTransferida, // ✅ Total agrupado
          tipoProducto,
          tipoMovimiento: 'ENTRADA',
          referenciaDeDocumento: refDoc,
          ubicacionOrigenId,
          ubicacionDestinoId,
          itemFisicoId: primerItemDestino,
          usuarioId,
          notas: `Entrada agrupada de ${itemsProcesados.length} item(s) físico(s) - Total: ${cantidadTotalTransferida}`
        }, { transaction: t });

        // UN SOLO movimiento TRANSFERENCIA con el total
        const movTransferencia = await movimientoInventario.create({
          materiumId: materiumId || null,
          productoId: productoId || null,
          cotizacionId: cotizacionId,
          comprasCotizacionId: comprasCotizacionId,
          cantidad: cantidadTotalTransferida, // ✅ Total agrupado
          tipoProducto,
          tipoMovimiento: 'TRANSFERENCIA',
          referenciaDeDocumento: refDoc,
          ubicacionOrigenId,
          ubicacionDestinoId,
          itemFisicoId: primerItemDestino,
          usuarioId,
          notas: `Transferencia agrupada: ${itemsProcesados.length} item(s) físico(s) - Total: ${cantidadTotalTransferida}`
        }, { transaction: t });

        // Actualizar detalles con IDs de movimientos agrupados
        detalles.push(...itemsProcesados.map(item => ({
          ...item,
          movSalidaId: movSalida.id,
          movEntradaId: movEntrada.id
        })));
      }
    }

    // Validación final
    const totalTransferido = detalles.reduce((s, d) => s + parseFloat(d.cantidadTransferida), 0);
    console.log(`[TRASLADAR_PIEZAS_VERSION] Validación final:`, {
      totalTransferido,
      cantidadSolicitada: cantidad,
      diferencia: Math.abs(totalTransferido - cantidad),
      necesitaPiezasCompletas
    });

    if (Math.abs(totalTransferido - cantidad) > EPS && !necesitaPiezasCompletas) {
      // Para piezas completas, puede haber exceso (es normal)
      // Para cantidad exacta, debe coincidir
      const errorMsg = `Error en transferencia. Transferido: ${totalTransferido}, Solicitado: ${cantidad}`;
      console.error(`[TRASLADAR_PIEZAS_VERSION] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    if (detalles.length === 0) {
      const errorMsg = `Error crítico: No se procesó ningún item físico. Cantidad solicitada: ${cantidad}`;
      console.error(`[TRASLADAR_PIEZAS_VERSION] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // 🔄 ACTUALIZAR COMPROMISOS POR PROYECTO (cantidadEntregada)
    // Obtener el item de la orden de compra con sus reparticiones a proyectos
    const itemCotizacion = await comprasCotizacionItem.findOne({
      where: {
        comprasCotizacionId: comprasCotizacionId,
        [campoFiltro]: idFiltro
      },
      include: [{
        model: itemToProject,
        include: [{
          model: requisicion,
          attributes: ['id', 'cotizacionId']
        }]
      }],
      transaction: t
    });

    if (itemCotizacion && itemCotizacion.itemToProjects && itemCotizacion.itemToProjects.length > 0) {
      console.log(`[TRANSFERENCIA] Actualizando compromisos para ${itemCotizacion.itemToProjects.length} proyecto(s)`);
      
      // Calcular la cantidad total asignada a todos los proyectos
      const cantidadTotalProyectos = itemCotizacion.itemToProjects.reduce(
        (sum, itp) => sum + parseFloat(itp.cantidad || 0), 
        0
      );

      // Repartir la cantidad transferida proporcionalmente según la repartición original
      for (const itp of itemCotizacion.itemToProjects) {
        if (!itp.requisicion || !itp.requisicion.cotizacionId) {
          console.warn(`[TRANSFERENCIA] ItemToProject ID ${itp.id} no tiene requisición o cotizacionId, se omite`);
          continue;
        }

        const cantidadProyecto = parseFloat(itp.cantidad || 0);
        if (cantidadProyecto <= 0) continue;

        // Calcular cantidad proporcional: (cantidad del proyecto / total) * cantidad transferida
        const cantidadProporcional = cantidadTotalProyectos > 0
          ? (cantidadProyecto / cantidadTotalProyectos) * totalTransferido
          : totalTransferido / itemCotizacion.itemToProjects.length; // Si no hay total, dividir equitativamente

        const proyectoCotizacionId = itp.requisicion.cotizacionId;

        console.log(`[TRANSFERENCIA] Actualizando compromiso para proyecto ${proyectoCotizacionId}:`, {
          cantidadProyecto,
          cantidadTotalProyectos,
          cantidadProporcional: cantidadProporcional.toFixed(4),
          totalTransferido
        });

        // Actualizar el compromiso directamente dentro de la transacción
        try {
          const campoCompromiso = productoId ? 'productoId' : 'materiumId';
          const idCompromiso = productoId ? productoId : materiumId;
          
          console.log(`[TRANSFERENCIA] Buscando compromiso:`, {
            campoCompromiso,
            idCompromiso,
            proyectoCotizacionId
          });

          // Buscar el compromiso existente
          const compromiso = await cotizacion_compromiso.findOne({
            where: {
              [campoCompromiso]: idCompromiso,
              cotizacionId: proyectoCotizacionId
            },
            transaction: t
          });

          if (compromiso) {
            // Actualizar cantidadEntregada y estado
            const cantidadEnEntregada = parseFloat(compromiso.cantidadEntregada || 0);
            const cantidadEnCompromiso = parseFloat(compromiso.cantidadComprometida || 0);
            const totalEntrega = cantidadEnEntregada + cantidadProporcional;
            const estadoData = totalEntrega >= cantidadEnCompromiso ? 'completo' : 'parcial';

            await compromiso.update({
              cantidadEntregada: totalEntrega,
              estado: estadoData
            }, { transaction: t });

            console.log(`[TRANSFERENCIA] ✅ Compromiso actualizado para proyecto ${proyectoCotizacionId}:`, {
              cantidadAnterior: cantidadEnEntregada,
              cantidadAgregada: cantidadProporcional.toFixed(4),
              cantidadTotal: totalEntrega.toFixed(4),
              estado: estadoData
            });
          } else {
            console.warn(`[TRANSFERENCIA] ⚠️ No se encontró compromiso para proyecto ${proyectoCotizacionId}, item ${idCompromiso}. Se omite actualización.`);
          }
        } catch (error) {
          console.error(`[TRANSFERENCIA] ⚠️ Error al actualizar compromiso para proyecto ${proyectoCotizacionId}:`, error.message);
          // No lanzamos error para no romper la transacción, solo logueamos
          // El compromiso puede no existir aún, lo cual es válido
        }
      }
    } else {
      console.log(`[TRANSFERENCIA] No se encontraron reparticiones a proyectos para este item. Compromisos no se actualizarán.`);
    }

    return {
      success: true,
      tipoProducto,
      idProductoOMateria: idFiltro,
      unidad: itemInfo.unidad,
      requierePiezasCompletas: necesitaPiezasCompletas,
      ubicacionOrigenId,
      ubicacionDestinoId,
      cantidadSolicitada: cantidad,
      cantidadTransferida: totalTransferido,
      comprasCotizacionId,
      cotizacionId,
      detalles
    };
  }); // fin transaction
}

module.exports = {
  trasladarPiezasCompletasVersion,
  requierePiezasCompletas,
  obtenerUnidadItem
};
