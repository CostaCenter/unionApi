const { stock, producto, materia, kit, db } = require('../../db/db');
const { Op } = require('sequelize');

const sequelize = db;

/**
 * Obtener stock agrupado por bodega con paginación.
 * Reglas:
 * - Si es producto terminado ('PR') y unidad = 'mt2' -> agrupar por productoId + medida
 * - Para el resto: agrupar por el identificador correspondiente (productoId, materiumId, kitId)
 *
 * @param {Object} opts
 * @param {number} opts.ubicacionId - id de la bodega (requerido)
 * @param {string} [opts.tipo] - 'MP' | 'PR' | null para ambos
 * @param {number} [opts.page=1]
 * @param {number} [opts.limit=50]
 */
async function getStockByBodega({ ubicacionId, tipo = null, page = 1, limit = 50 } = {}) {
  if (!ubicacionId) {
    throw new Error('ubicacionId es requerido');
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const lim = Math.max(1, Math.min(1000, Number(limit) || 50));
  const offset = (pageNum - 1) * lim;

  // SQL: agrupamos por productoId + medida cuando unidad = 'mt2'
  const replacements = { ubicacionId, limit: lim, offset };

  // Construimos consulta que soporta:
  // - Productos con unidad mt2 agrupados por productoId + medida
  // - Productos con otras unidades agrupados por productoId (medida = NULL)
  // - Materia prima agrupada por materiumId
  // - Kits agrupadas por kitId

  // Selección principal: COALESCE para identificar tipo de item
  const sql = `
    SELECT
      COALESCE(s."productoId", s."materiumId", s."kitId") AS "itemId",
      s."productoId" AS "productoId",
      s."materiumId" AS "materiumId",
      s."kitId" AS "kitId",
      -- Medida sólo se usa para agrupar mt2 de producto; para otros queda NULL
      (CASE WHEN s."unidad" = 'mt2' AND s."productoId" IS NOT NULL THEN s."medida" ELSE NULL END) AS medida,
      s."unidad" AS unidad,
      SUM(s."cantidad")::numeric AS cantidad,
      MAX(s."updatedAt") AS "updatedAt",
      MAX(s."limit") AS "limit",
      COUNT(*)::int AS registros
    FROM "stocks" s
    WHERE s."ubicacionId" = :ubicacionId
      AND COALESCE(s."cantidad", 0) > 0
      ${tipo ? `AND s."tipo" = ${sequelize.escape(tipo)}` : ''}
    GROUP BY COALESCE(s."productoId", s."materiumId", s."kitId"), s."productoId", s."materiumId", s."kitId", medida, s."unidad"
    ORDER BY "productoId" NULLS LAST, "materiumId" NULLS LAST, "kitId" NULLS LAST
    LIMIT :limit OFFSET :offset
  `;

  const rows = await sequelize.query(sql, {
    type: sequelize.QueryTypes.SELECT,
    replacements
  });

  // Enriquecer con nombres (producto/materia/kit) de forma eficiente
  const productoIds = [...new Set(rows.filter(r => r.productoId).map(r => r.productoId))];
  const materiaIds = [...new Set(rows.filter(r => r.materiumId).map(r => r.materiumId))];
  const kitIds = [...new Set(rows.filter(r => r.kitId).map(r => r.kitId))];

  const productosMap = {};
  if (productoIds.length) {
    const productos = await producto.findAll({ where: { id: { [Op.in]: productoIds } }, attributes: ['id', 'item'], raw: true });
    productos.forEach(p => { productosMap[p.id] = p.item; });
  }

  const materiasMap = {};
  if (materiaIds.length) {
    const materias = await materia.findAll({ where: { id: { [Op.in]: materiaIds } }, attributes: ['id', 'description'], raw: true });
    materias.forEach(m => { materiasMap[m.id] = m.description; });
  }

  const kitsMap = {};
  if (kitIds.length) {
    const kits = await kit.findAll({ where: { id: { [Op.in]: kitIds } }, attributes: ['id', 'name'], raw: true });
    kits.forEach(k => { kitsMap[k.id] = k.name; });
  }

  // Formatear resultado
  const resultado = rows.map(r => {
    let nombre = null;
    let tipoItem = null;
    if (r.productoId) {
      nombre = productosMap[r.productoId] || null;
      tipoItem = 'PR';
    } else if (r.materiumId) {
      nombre = materiasMap[r.materiumId] || null;
      tipoItem = 'MP';
    } else if (r.kitId) {
      nombre = kitsMap[r.kitId] || null;
      tipoItem = 'KIT';
    }

    return {
      itemId: r.itemId,
      productoId: r.productoId,
      materiumId: r.materiumId,
      kitId: r.kitId,
      nombre,
      medida: r.medida || null,
      unidad: r.unidad,
      isMt2: String(r.unidad || '').toLowerCase() === 'mt2',
      cantidad: Number(r.cantidad || 0),
      updatedAt: r.updatedAt || r.updatedat || null,
      limit: r.limit !== undefined ? r.limit : null,
      registros: r.registros,
      tipo: tipoItem
    };
  });

  // Contar total (sin paginar) para paginación: consulta ligera
  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM (
      SELECT 1
      FROM "stocks" s
      WHERE s."ubicacionId" = :ubicacionId
        AND COALESCE(s."cantidad", 0) > 0
        ${tipo ? `AND s."tipo" = ${sequelize.escape(tipo)}` : ''}
      GROUP BY COALESCE(s."productoId", s."materiumId", s."kitId"), (CASE WHEN s."unidad" = 'mt2' AND s."productoId" IS NOT NULL THEN s."medida" ELSE NULL END), s."unidad"
    ) t
  `;

  const countRes = await sequelize.query(countSql, { type: sequelize.QueryTypes.SELECT, replacements });
  const total = countRes && countRes[0] ? Number(countRes[0].total || 0) : 0;

  return {
    page: pageNum,
    limit: lim,
    total,
    pages: Math.ceil(total / lim),
    data: resultado
  };
}



/**
 * Crear o actualizar stock por ingreso y registrar movimiento (stockMove).
 * @param {Object} opts
 * @param {number} opts.cantidad - cantidad a ingresar (>0)
 * @param {number} [opts.productoId]
 * @param {number} [opts.materiumId]
 * @param {number} [opts.kitId]
 * @param {string} [opts.medida]
 * @param {string} [opts.unidad]
 * @param {number} opts.bodegaId - ubicacion destino
 * @param {string} opts.tipoMovimiento - 'OC'|'OP'|'MANUAL'|'TRANSFERENCIA'
 * @param {string} [opts.referenciaDeDocumento]
 * @param {string} [opts.notas]
 * @param {number} [opts.bodegaOrigenId]
 * @param {Transaction} [externalTransaction] - Transacción externa opcional (para uso dentro de otra transacción)
 */
async function createOrUpdateStockIngreso(opts = {}, externalTransaction = null) {
  const {
    cantidad,
    productoId = null,
    materiumId = null,
    kitId = null,
    medida = null,
    unidad = null,
    bodegaId,
    tipoMovimiento,
    referenciaDeDocumento = null,
    notas = null,
    bodegaOrigenId = null
  } = opts || {};

  if (!cantidad || Number(cantidad) <= 0) {
    throw new Error('cantidad debe ser mayor a 0');
  }
  if (!bodegaId) throw new Error('bodegaId es requerido');
  if (!tipoMovimiento) throw new Error('tipoMovimiento es requerido');

  const executeInTransaction = async (t) => {
    // Buscar registro existente según reglas:
    // - productos terminados: match productId + medida + ubicacionId
    // - materia: materiumId + ubicacionId
    // - kit: kitId + ubicacionId

    let where = { ubicacionId: bodegaId };
    if (productoId) {
      where.productoId = productoId;
      // medida grouping for productos termino: if medida provided, include it
      if (medida) where.medida = medida;
    } else if (materiumId) {
      where.materiumId = materiumId;
    } else if (kitId) {
      where.kitId = kitId;
    } else {
      throw new Error('productoId, materiumId o kitId es requerido');
    }

    // intentar encontrar stock existente
    let existing = await stock.findOne({ where, transaction: t });

    let stockRecord;
    if (!existing) {
      // crear nuevo stock
      const newStockData = {
        cantidad: Number(cantidad),
        unidad: unidad || null,
        medida: medida || null,
        tipo: productoId ? 'PR' : (materiumId ? 'MP' : 'KIT'),
        ubicacionId: bodegaId,
        productoId: productoId || null,
        materiumId: materiumId || null,
        kitId: kitId || null,
        state: 'Disponible'
      };
      stockRecord = await stock.create(newStockData, { transaction: t });
    } else {
      // actualizar existente sumando cantidad
      existing.cantidad = Number(existing.cantidad || 0) + Number(cantidad);
      if (unidad) existing.unidad = unidad;
      if (medida) existing.medida = medida;
      await existing.save({ transaction: t });
      stockRecord = existing;
    }

    // crear stockMove
    const stockMoveModel = sequelize.models.stockMove;
    const moveData = {
      cantidad: Number(cantidad),
      tipoProducto: productoId ? 'PR' : (materiumId ? 'MP' : 'KIT'),
      tipoMovimiento: tipoMovimiento,
      referenciaDeDocumento: referenciaDeDocumento || null,
      notas: notas || null,
      comprasCotizacionId: opts.comprasCotizacionId || null,
      bodegaDestinoId: bodegaId,
      bodegaOrigenId: bodegaOrigenId || null,
      stockId: stockRecord.id,
      productoId: productoId || null,
      materiumId: materiumId || null,
      kitId: kitId || null
    };

    const createdMove = await stockMoveModel.create(moveData, { transaction: t });

    return { stock: stockRecord.get({ plain: true }), stockMove: createdMove.get({ plain: true }) };
  };

  // Si hay transacción externa, usarla; sino crear una nueva
  if (externalTransaction) {
    return await executeInTransaction(externalTransaction);
  } else {
    return await sequelize.transaction(executeInTransaction);
  }
}

/**
 * Restar cantidad de stock (salida) y registrar movimiento (stockMove).
 * Reglas:
 * - Busca el registro por productoId+medida+bodegaId (si producto) o materiumId+bodegaId o kitId+bodegaId.
 * - Valida que exista stock suficiente.
 * - Resta la cantidad; si queda 0, deja state='Agotado' (o 'Disponible' si >0).
 * @param {Transaction} [externalTransaction] - Transacción externa opcional
 */
async function createOrUpdateStockSalida(opts = {}, externalTransaction = null) {
  const {
    cantidad,
    productoId = null,
    materiumId = null,
    kitId = null,
    medida = null,
    unidad = null,
    bodegaId,
    tipoMovimiento,
    referenciaDeDocumento = null,
    notas = null,
    bodegaDestinoId = null
  } = opts || {};

  if (!cantidad || Number(cantidad) <= 0) {
    throw new Error('cantidad debe ser mayor a 0');
  }
  if (!bodegaId) throw new Error('bodegaId es requerido');
  if (!tipoMovimiento) throw new Error('tipoMovimiento es requerido');

  const executeInTransaction = async (t) => {
    let where = { ubicacionId: bodegaId };
    if (productoId) {
      where.productoId = productoId;
      if (medida) where.medida = medida;
    } else if (materiumId) {
      where.materiumId = materiumId;
    } else if (kitId) {
      where.kitId = kitId;
    } else {
      throw new Error('productoId, materiumId o kitId es requerido');
    }

    const existing = await stock.findOne({ where, transaction: t, lock: t.LOCK.UPDATE });
    if (!existing) {
      throw new Error('No hay registro de stock en la bodega solicitada para ese item.');
    }

    const disponible = Number(existing.cantidad || 0);
    if (disponible < Number(cantidad)) {
      throw new Error(`Stock insuficiente. Disponible: ${disponible}, requerido: ${cantidad}`);
    }

    const nuevo = +(disponible - Number(cantidad));
    existing.cantidad = nuevo <= 0 ? 0 : nuevo;
    existing.unidad = unidad || existing.unidad;
    existing.state = nuevo <= 0 ? 'Agotado' : 'Disponible';
    await existing.save({ transaction: t });

    const stockMoveModel = sequelize.models.stockMove;
    const moveData = {
      cantidad: Number(cantidad),
      tipoProducto: productoId ? 'PR' : (materiumId ? 'MP' : 'KIT'),
      tipoMovimiento: tipoMovimiento,
      referenciaDeDocumento: referenciaDeDocumento || null,
      notas: notas || null,
      comprasCotizacionId: opts.comprasCotizacionId || null,
      bodegaOrigenId: bodegaId,
      bodegaDestinoId: bodegaDestinoId || null,
      stockId: existing.id,
      productoId: productoId || null,
      materiumId: materiumId || null,
      kitId: kitId || null
    };

    const createdMove = await stockMoveModel.create(moveData, { transaction: t });

    return { stock: existing.get({ plain: true }), stockMove: createdMove.get({ plain: true }) };
  };

  // Si hay transacción externa, usarla; sino crear una nueva
  if (externalTransaction) {
    return await executeInTransaction(externalTransaction);
  } else {
    return await sequelize.transaction(executeInTransaction);
  }
}

async function getStockItemDetails({ productoId = null, materiumId = null, kitId = null, ubicacionId = null, medida = null, limit = 100 } = {}) {
    if (!ubicacionId) throw new Error('ubicacionId es requerido');
    if (!productoId && !materiumId && !kitId) throw new Error('productoId o materiaId o kitId es requerido');
  
    // Buscar stock(s) que coincidan (productos con medida -> incluir medida)
    const where = { ubicacionId };
    if (productoId) {
      where.productoId = productoId;
      if (medida) where.medida = medida;
    } else if (materiumId) {
      where.materiumId = materiumId;
    } else if (kitId) {
      where.kitId = kitId;
    }
  
    const stocks = await stock.findAll({ where, order: [['updatedAt', 'DESC']], limit: 100, raw: true });
  
    // Obtener movimientos relacionados (stockMove) por cualquiera de los identificadores
    const stockMoveModel = sequelize.models.stockMove;
    const moveWhere = {};
    if (productoId) moveWhere.productoId = productoId;
    if (materiumId) moveWhere.materiumId = materiumId;
    if (kitId) moveWhere.kitId = kitId;
    // limitar por bodega (origen o destino)
    moveWhere[Op.or] = [
      { bodegaOrigenId: ubicacionId },
      { bodegaDestinoId: ubicacionId }
    ];
  
    const movimientos = await stockMoveModel.findAll({
      where: moveWhere,
      order: [['createdAt', 'DESC']],
      limit: Number(limit || 100),
      raw: true
    });
  
    // Obtener metadata del producto/materia/kit
    let meta = null;
  if (productoId) {
    const p = await producto.findByPk(productoId, { raw: true });
    meta = p || null;
  } else if (materiumId) {
    const m = await materia.findByPk(materiumId, { raw: true });
    meta = m || null;
  } else if (kitId) {
    const k = await kit.findByPk(kitId, { raw: true });
    meta = k || null;
  }
  
    return {
      stocks,
      movimientos,
      meta
    };
  }
// export adicional
/**
 * TRANSFERENCIA DE BODEGA CON ACTUALIZACIÓN DE COMPROMISOS
 * ========================================================
 * Transfiere un item específico de comprasCotizacionItem de una bodega a otra,
 * distribuyendo cantidades según sus asignaciones en itemToProject,
 * actualizando stock físico y compromisos por proyecto.
 * 
 * FLUJO:
 * 1. Validar que existe el comprasCotizacionItem
 * 2. Obtener sus itemToProject (asignaciones por requisición/proyecto)
 * 3. Para cada asignación:
 *    - Descontar stock de bodega origen
 *    - Sumar stock en bodega destino
 *    - Registrar movimiento en stockMove
 *    - Actualizar cotizacion_compromiso correspondiente
 * 4. Si todo va bien, marcar el item como "entregado"
 * 
 * REGLAS:
 * - MP: Bodega 1 → Bodega 4 (en proceso)
 * - PT: Bodega 2 → Bodega 5 (en proceso)
 * - PT con mt2: buscar compromiso por productoId + cotizacionId + medida
 * - Otros: buscar por materiumId/productoId + cotizacionId
 * 
 * @param {Object} opts
 * @param {number} opts.comprasCotizacionItemId - ID del item de la orden de compra
 * @param {number} [opts.usuarioId] - ID del usuario que ejecuta la acción
 * @returns {Promise<Object>} Resultado de la operación con detalle de movimientos
 */
async function transferirItemConCompromisos({ comprasCotizacionItemId, usuarioId = null } = {}) {
  if (!comprasCotizacionItemId) {
    throw new Error('comprasCotizacionItemId es requerido');
  }

  const { 
    comprasCotizacionItem, 
    itemToProject, 
    cotizacion_compromiso,
    materia,
    producto,
    ubicacion 
  } = sequelize.models;

  return await sequelize.transaction(async (t) => {
    // 1. OBTENER EL ITEM DE LA ORDEN DE COMPRA CON SUS DETALLES
    const item = await comprasCotizacionItem.findByPk(comprasCotizacionItemId, {
      include: [
        { model: materia, attributes: ['id', 'description', 'unidad', 'medida'] },
        { model: producto, attributes: ['id', 'item', 'unidad', 'medida'] }
      ],
      transaction: t
    });

    if (!item) {
      throw new Error(`comprasCotizacionItem con ID ${comprasCotizacionItemId} no encontrado`);
    }

    // Determinar si es materia prima o producto terminado
    const esMateriaPrima = !!item.materiaId || !!item.materiumId;
    const itemData = esMateriaPrima ? item.materium : item.producto;
    
    if (!itemData) {
      throw new Error('El item no tiene materia prima ni producto asociado');
    }

    const productoId = esMateriaPrima ? null : item.productoId;
    const materiumId = esMateriaPrima ? (item.materiumId || item.materiaId) : null;
    const unidad = itemData.unidad || '';
    const medida = item.medida || itemData.medida || null; // La medida puede venir del item o del producto/materia

    // Definir bodegas según tipo
    const bodegaOrigenId = esMateriaPrima ? 1 : 2;  // MP: Bodega 1, PT: Bodega 2
    const bodegaDestinoId = esMateriaPrima ? 4 : 5;  // MP: Bodega 4 (en proceso), PT: Bodega 5 (en proceso)

    console.log(`[TRANSFERENCIA] Iniciando transferencia de ${esMateriaPrima ? 'Materia Prima' : 'Producto Terminado'}`, {
      itemId: item.id,
      comprasCotizacionId: item.comprasCotizacionId,
      materiumId,
      productoId,
      unidad,
      medida,
      cantidadTotal: item.cantidad,
      bodegaOrigen: bodegaOrigenId,
      bodegaDestino: bodegaDestinoId
    });

    // 2. OBTENER LAS ASIGNACIONES POR PROYECTO (itemToProject)
    const asignaciones = await itemToProject.findAll({
      where: { comprasCotizacionItemId: item.id },
      transaction: t
    });

    if (!asignaciones || asignaciones.length === 0) {
      throw new Error(`El item ${item.id} no tiene asignaciones a proyectos (itemToProject vacío)`);
    }

    console.log(`[TRANSFERENCIA] Encontradas ${asignaciones.length} asignaciones a proyectos`);

    // 3. VALIDAR QUE LA SUMA DE ASIGNACIONES = CANTIDAD DEL ITEM
    const sumaAsignaciones = asignaciones.reduce((sum, a) => sum + parseFloat(a.cantidad || 0), 0);
    const cantidadItem = parseFloat(item.cantidad || 0);
    
    if (Math.abs(sumaAsignaciones - cantidadItem) > 0.01) {
      console.warn(`[TRANSFERENCIA] ⚠️ La suma de asignaciones (${sumaAsignaciones}) no coincide con la cantidad del item (${cantidadItem})`);
      // No bloqueamos, pero lo advertimos
    }

    // 4. PROCESAR CADA ASIGNACIÓN
    const movimientos = [];
    const compromisosActualizados = [];

    for (const asignacion of asignaciones) {
      const cantidadAsignada = parseFloat(asignacion.cantidad || 0);
      const requisicionId = asignacion.requisicionId;

      if (cantidadAsignada <= 0) {
        console.warn(`[TRANSFERENCIA] Asignación ${asignacion.id} tiene cantidad <= 0, se omite`);
        continue;
      }

      // Obtener la cotizacionId desde la requisición
      const { requisicion } = sequelize.models;
      const reqData = await requisicion.findByPk(requisicionId, {
        attributes: ['id', 'cotizacionId'],
        transaction: t
      });

      if (!reqData || !reqData.cotizacionId) {
        console.warn(`[TRANSFERENCIA] ⚠️ Requisición ${requisicionId} no tiene cotizacionId, se omite actualización de compromiso`);
        continue;
      }

      const cotizacionId = reqData.cotizacionId;

      console.log(`[TRANSFERENCIA] Procesando asignación para requisición ${requisicionId}, proyecto ${cotizacionId}, cantidad: ${cantidadAsignada}`);

      // A. DESCONTAR DE BODEGA ORIGEN
      try {
        await createOrUpdateStockSalida({
          cantidad: cantidadAsignada,
          productoId,
          materiumId,
          kitId: null,
          medida: unidad === 'mt2' && productoId ? medida : null, // Solo para productos con mt2
          unidad,
          bodegaId: bodegaOrigenId,
          tipoMovimiento: 'TRANSFERENCIA_SALIDA',
          referenciaDeDocumento: `TRANSFER_OC_${item.comprasCotizacionId}_ITEM_${item.id}_REQ_${requisicionId}`,
          notas: `Transferencia a bodega ${bodegaDestinoId} para requisición ${requisicionId}`,
          bodegaDestinoId: bodegaDestinoId,
          comprasCotizacionId: item.comprasCotizacionId
        }, t); // Pasar la transacción
      } catch (err) {
        console.error(`[TRANSFERENCIA] ❌ Error al descontar de bodega origen (${bodegaOrigenId}):`, err.message);
        throw new Error(`No se pudo descontar de bodega ${bodegaOrigenId}: ${err.message}. Verifica que haya stock suficiente.`);
      }

      // B. SUMAR EN BODEGA DESTINO
      const resultadoIngreso = await createOrUpdateStockIngreso({
        cantidad: cantidadAsignada,
        productoId,
        materiumId,
        kitId: null,
        medida: unidad === 'mt2' && productoId ? medida : null,
        unidad,
        bodegaId: bodegaDestinoId,
        tipoMovimiento: 'TRANSFERENCIA_INGRESO',
        referenciaDeDocumento: `TRANSFER_OC_${item.comprasCotizacionId}_ITEM_${item.id}_REQ_${requisicionId}`,
        notas: `Transferencia desde bodega ${bodegaOrigenId} para requisición ${requisicionId}`,
        bodegaOrigenId: bodegaOrigenId,
        comprasCotizacionId: item.comprasCotizacionId
      }, t); // Pasar la transacción

      movimientos.push({
        requisicionId,
        cotizacionId,
        cantidad: cantidadAsignada,
        stockMoveId: resultadoIngreso.stockMove.id
      });

      // C. ACTUALIZAR COMPROMISO (cotizacion_compromiso)
      try {
        // Construir criterio de búsqueda según tipo y unidad
        let whereCompromiso = { cotizacionId };
        
        if (productoId) {
          whereCompromiso.productoId = productoId;
          // Si es producto con unidad mt2, también filtrar por medida
          if (unidad === 'mt2' && medida) {
            whereCompromiso.medida = medida;
          }
        } else if (materiumId) {
          whereCompromiso.materiumId = materiumId;
          // También buscar por materiaId si existe (campo legacy)
          // whereCompromiso.materiaId = materiumId; // Si aplica
        }

        console.log(`[TRANSFERENCIA] Buscando compromiso con criterios:`, whereCompromiso);

        const compromiso = await cotizacion_compromiso.findOne({
          where: whereCompromiso,
          transaction: t
        });

        if (compromiso) {
          const cantidadAnterior = parseFloat(compromiso.cantidadEntregada || 0);
          const cantidadComprometida = parseFloat(compromiso.cantidadComprometida || 0);
          const nuevoTotal = cantidadAnterior + cantidadAsignada;

          // Calcular nuevo estado
          let nuevoEstado = 'reservado';
          if (nuevoTotal >= cantidadComprometida) {
            nuevoEstado = 'completo';
          } else if (nuevoTotal > 0) {
            nuevoEstado = 'parcial';
          }

          await compromiso.update({
            cantidadEntregada: nuevoTotal,
            estado: nuevoEstado
          }, { transaction: t });

          console.log(`[TRANSFERENCIA] ✅ Compromiso actualizado:`, {
            cotizacionId,
            productoId,
            materiumId,
            medida,
            cantidadAnterior,
            cantidadAgregada: cantidadAsignada,
            nuevoTotal,
            estado: nuevoEstado
          });

          compromisosActualizados.push({
            compromisoId: compromiso.id,
            cotizacionId,
            cantidadAgregada: cantidadAsignada,
            cantidadTotal: nuevoTotal,
            estado: nuevoEstado
          });
        } else {
          console.warn(`[TRANSFERENCIA] ⚠️ No se encontró compromiso para:`, whereCompromiso);
          // No bloqueamos la operación, solo advertimos
        }
      } catch (errCompromiso) {
        console.error(`[TRANSFERENCIA] ❌ Error al actualizar compromiso:`, errCompromiso.message);
        // No bloqueamos la transferencia física, pero lo registramos
      }
    }

    // 5. MARCAR EL ITEM COMO ENVIADO A PRODUCCIÓN
    await item.update({ 
      entregado: true,
      estado: 'Produccion'
    }, { transaction: t });

    console.log(`[TRANSFERENCIA] ✅ Transferencia completada exitosamente para item ${item.id} - Estado: Produccion`);

    return {
      ok: true,
      itemId: item.id,
      comprasCotizacionId: item.comprasCotizacionId,
      tipo: esMateriaPrima ? 'Materia Prima' : 'Producto Terminado',
      cantidadTotal: cantidadItem,
      bodegaOrigen: bodegaOrigenId,
      bodegaDestino: bodegaDestinoId,
      asignacionesProcesadas: asignaciones.length,
      movimientos,
      compromisosActualizados,
      mensaje: `Se transfirieron ${cantidadItem} ${unidad} desde bodega ${bodegaOrigenId} a bodega ${bodegaDestinoId} distribuidos en ${asignaciones.length} proyecto(s)`
    };
  });
}

module.exports = {
  getStockByBodega,
  createOrUpdateStockIngreso,
  createOrUpdateStockSalida,
  getStockItemDetails,
  transferirItemConCompromisos
};