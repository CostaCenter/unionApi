const { stock, comprasCotizacionItem, producto, materia, kit, db } = require('../db/db');
const sequelize = db; // ✅ Sequelize instance para transacciones

const { getStockByBodega, createOrUpdateStockIngreso, createOrUpdateStockSalida, getStockItemDetails, transferirItemConCompromisos } = require('./services/stockServices');

/**
 * Controller: GET /stock/bodega/:ubicacionId
 * Query params: tipo (MP|PR), page, limit
 */
async function getStockBodegaController(req, res) {
  try {
    const { ubicacionId } = req.params;
    const { tipo = null, page = 1, limit = 50 } = req.query;

    if (!ubicacionId) return res.status(400).json({ ok: false, msg: 'ubicacionId es requerido' });

    const result = await getStockByBodega({
      ubicacionId: Number(ubicacionId),
      tipo: tipo ? String(tipo).toUpperCase() : null,
      page: Number(page),
      limit: Number(limit)
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('getStockBodegaController error:', err);
    return res.status(500).json({ ok: false, msg: err.message });
  }
}


async function createStockIngresoController(req, res) {
  try {
    const body = req.body || {};
    const {
      cantidad,
      productoId,
      materiaPrimaId,
      kitId,
      medida,
      unidad,
      bodegaId,
      tipoMovimiento,
      referenciaDeDocumento,
      notas,
      bodegaOrigenId,
      comprasCotizacionItemId
    } = body;

    const comprasCotizacionId = body.comprasCotizacionId || body.compras_id || null;

    // map cliente field materiaPrimaId to materiumId internal name
    const materiumId = materiaPrimaId || body.materiumId || null;

    // ✅ TRANSACCIÓN COMPLETA: Todo o nada
    const result = await sequelize.transaction(async (t) => {
      // 1. Ejecutar ingreso de stock (dentro de transacción)
      const ingresoResult = await createOrUpdateStockIngreso({
        cantidad,
        productoId: productoId || null,
        materiumId: materiumId,
        kitId: kitId || null,
        medida: medida || null,
        unidad: unidad || null,
        bodegaId,
        tipoMovimiento,
        referenciaDeDocumento: referenciaDeDocumento || null,
        notas: notas || null,
        bodegaOrigenId: bodegaOrigenId || null,
        comprasCotizacionId: comprasCotizacionId || null
      }, t); // ✅ Pasar transacción externa
    
      // 2. Actualizar estado del item (dentro de MISMA transacción)
      if(comprasCotizacionItemId){
          const [affectedRows] = await comprasCotizacionItem.update({
              estado: 'entregado',
              entregado: true
          }, {
              where: {
                  id: comprasCotizacionItemId
              },
              transaction: t // ✅ Usar misma transacción
          });

          // Validar que se actualizó correctamente
          if (affectedRows === 0) {
              console.warn(`[INGRESO] ⚠️ No se encontró comprasCotizacionItem con ID ${comprasCotizacionItemId}`);
              // No lanzamos error, solo advertimos
          } else {
              console.log(`[INGRESO] ✅ Item ${comprasCotizacionItemId} marcado como entregado`);
          }
      }

      // 3. Retornar resultado del ingreso
      return ingresoResult;
    });

    // Si llegamos aquí, todo fue exitoso (commit automático)
    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    // Si hubo error, todo se revierte (rollback automático)
    console.error('createStockIngresoController error:', err);
    return res.status(400).json({ ok: false, msg: err.message });
  }
}

async function createStockSalidaController(req, res) {
  try {
    const body = req.body || {};
    const {
      cantidad,
      productoId,
      materiaPrimaId,
      kitId,
      medida,
      unidad,
      bodegaId,
      tipoMovimiento,
      referenciaDeDocumento,
      notas,
      bodegaDestinoId,
      comprasCotizacionItemId
    } = body;

    const comprasCotizacionId = body.comprasCotizacionId || body.compras_id || null;
    const materiumId = materiaPrimaId || body.materiumId || null;

    // ✅ TRANSACCIÓN COMPLETA: Todo o nada
    const result = await sequelize.transaction(async (t) => {
      // 1. Ejecutar salida de stock (dentro de transacción)
      const salidaResult = await createOrUpdateStockSalida({
        cantidad,
        productoId: productoId || null,
        materiumId: materiumId,
        kitId: kitId || null,
        medida: medida || null,
        unidad: unidad || null,
        bodegaId,
        tipoMovimiento,
        referenciaDeDocumento: referenciaDeDocumento || null,
        notas: notas || null,
        bodegaDestinoId: bodegaDestinoId || null,
        comprasCotizacionId: comprasCotizacionId || null
      }, t); // ✅ Pasar transacción externa

      // 2. Actualizar estado del item si aplica (dentro de MISMA transacción)
      if(comprasCotizacionItemId){
          const [affectedRows] = await comprasCotizacionItem.update({
              estado: 'consumido',
              entregado: true
          }, {
              where: {
                  id: comprasCotizacionItemId
              },
              transaction: t // ✅ Usar misma transacción
          });

          if (affectedRows === 0) {
              console.warn(`[SALIDA] ⚠️ No se encontró comprasCotizacionItem con ID ${comprasCotizacionItemId}`);
          } else {
              console.log(`[SALIDA] ✅ Item ${comprasCotizacionItemId} marcado como consumido`);
          }
      }

      // 3. Retornar resultado de la salida
      return salidaResult;
    });

    // Si llegamos aquí, todo fue exitoso (commit automático)
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    // Si hubo error, todo se revierte (rollback automático)
    console.error('createStockSalidaController error:', err);
    return res.status(400).json({ ok: false, msg: err.message });
  }
}


async function getStockItemController(req, res) {
    try {
      const { productoId, materiaPrimaId, kitId, ubicacionId, medida, limit } = req.query;
      if (!ubicacionId) return res.status(400).json({ ok: false, msg: 'ubicacionId es requerido' });
      if (!productoId && !materiaPrimaId && !kitId) return res.status(400).json({ ok: false, msg: 'productoId o materiaPrimaId o kitId es requerido' });
  
      const result = await getStockItemDetails({
        productoId: productoId ? Number(productoId) : null,
        materiumId: materiaPrimaId ? Number(materiaPrimaId) : null,
        kitId: kitId ? Number(kitId) : null,
        ubicacionId: Number(ubicacionId),
        medida: medida || null,
        limit: limit ? Number(limit) : 100
      });
  
      return res.status(200).json({ ok: true, ...result });
    } catch (err) {
      console.error('getStockItemController error:', err);
      return res.status(500).json({ ok: false, msg: err.message });
    }
  }


async function transferirItemConCompromisosController(req, res) {
  try {
    const { comprasCotizacionItemId } = req.body;

    if (!comprasCotizacionItemId) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'comprasCotizacionItemId es requerido' 
      });
    }

    const usuarioId = req.user ? req.user.id : null;

    const result = await transferirItemConCompromisos({
      comprasCotizacionItemId: Number(comprasCotizacionItemId),
      usuarioId
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('transferirItemConCompromisosController error:', err);
    return res.status(400).json({ 
      ok: false, 
      msg: err.message,
      error: err.toString()
    });
  }
}

module.exports = {
  getStockBodegaController,
  createStockIngresoController,
  createStockSalidaController,
  getStockItemController,
  transferirItemConCompromisosController
};



 