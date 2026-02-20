const { ingresarCantidadListaParaRemision, remisionarDocumento, getAllRemisiones, actualizarDatosRemision } = require('./services/remisionServices');
const { remision, cotizacion, client, itemRemision, necesidadProyecto, requisicion, producto, kit, extension, user  } = require('../db/db');

/**
 * POST /api/remision/post/ingresar-listo
 * Ingresar cantidades listas para remisión
 * 
 * Body: {
 *   necesidadProyectoId: number,
 *   cantidad: number,
 *   medida: string (opcional),
 *   notas: string (opcional)
 * }
 */
async function ingresarCantidadListoController(req, res) {
  try {
    const body = req.body || {};
    const {
      necesidadProyectoId,
      cantidad,
      medida,
      notas
    } = body;

    const usuarioId = req.user ? req.user.id : null;

    const resultado = await ingresarCantidadListaParaRemision({
      necesidadProyectoId,
      cantidad,
      medida,
      notas,
      usuarioId
    });

    return res.status(201).json(resultado);

  } catch (err) {
    console.error('[REMISIÓN] Error en ingresarCantidadListoController:', err);
    return res.status(400).json({
      ok: false,
      msg: err.message,
      error: err.toString()
    });
  }
}

/**
 * PUT /api/remision/put/remisionar/:remisionId
 * Remisionar documento (cambiar a estado Remisionada y hacer salida de inventario)
 */
async function remisionarController(req, res) {
  try {
    const { remisionId } = req.params;
    const usuarioId = req.user ? req.user.id : null;

    if (!remisionId) {
      return res.status(400).json({
        ok: false,
        msg: 'remisionId es requerido'
      });
    }

    const resultado = await remisionarDocumento({
      remisionId: Number(remisionId),
      usuarioId
    });

    return res.status(200).json(resultado);

  } catch (err) {
    console.error('[REMISIÓN] Error en remisionarController:', err);
    return res.status(400).json({
      ok: false,
      msg: err.message,
      error: err.toString()
    });
  }
}

/**
 * GET /api/remision/get/requisicion/:requisicionId
 * Obtener remisiones de una requisición
 */
async function getRemisionesByRequisicionController(req, res) {
  try {
    const { requisicionId } = req.params;

    if (!requisicionId) {
      return res.status(400).json({
        ok: false,
        msg: 'requisicionId es requerido'
      });
    }

    const remisiones = await remision.findAll({
      where: { requisicionId: Number(requisicionId) },
      include: [
        { model: requisicion, attributes: ['id', 'folio'] },
        {
          model: itemRemision,
          include: [
            { model: producto, attributes: ['id', 'item'] },
            { model: kit, attributes: ['id', 'description'] },
            { model: necesidadProyecto, attributes: ['id', 'cantidadComprometida', 'cantidadEntregada', 'estado'] }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      ok: true,
      requisicionId: Number(requisicionId),
      totalRemisiones: remisiones.length,
      remisiones
    });

  } catch (err) {
    console.error('[REMISIÓN] Error en getRemisionesByRequisicionController:', err);
    return res.status(400).json({
      ok: false,
      msg: err.message
    });
  }
}

/**
 * GET /api/remision/get/:remisionId
 * Obtener detalle de una remisión específica
 */
async function getRemisionByIdController(req, res) {
  try {
    const { remisionId } = req.params;

    if (!remisionId) {
      return res.status(400).json({
        ok: false,
        msg: 'remisionId es requerido'
      });
    }

    const rem = await remision.findByPk(remisionId, {
      include: [
        { model: requisicion,
            include: [{
                model: cotizacion,
                include: [{
                    model: client,
                }, {
                    model: user,    // usuario que creo la cotizacion
                }]
            }]
        },
        {
          model: itemRemision,
          include: [
            { model: producto, attributes: ['id', 'item', 'unidad'] },
            { model: kit, include:[{ model: extension }]  },
            { model: necesidadProyecto, attributes: ['id', 'cantidadComprometida', 'cantidadEntregada', 'estado'] }
          ]
        }
      ]
    });

    if (!rem) {
      return res.status(404).json({
        ok: false,
        msg: `Remisión con ID ${remisionId} no encontrada`
      });
    }

    return res.status(200).json(rem);

  } catch (err) {
    console.error('[REMISIÓN] Error en getRemisionByIdController:', err);
    return res.status(400).json({
      ok: false,
      msg: err.message
    });
  }
}

/**
 * GET /api/remision/get/all
 * Obtener todas las remisiones con paginación
 * 
 * Query params:
 * - page: Número de página (default: 1)
 * - limit: Items por página (default: 50, max: 100)
 * - estado: Filtro por estado (opcional: 'Activa', 'Remisionada', 'Cancelada')
 * - requisicionId: Filtro por requisición (opcional)
 */
async function getAllRemisionesController(req, res) {
  try {
    const { page, limit, estado, requisicionId } = req.query;

    const resultado = await getAllRemisiones({
      page,
      limit,
      estado,
      requisicionId
    });

    return res.status(200).json(resultado);

  } catch (err) {
    console.error('[REMISIÓN] Error en getAllRemisionesController:', err);
    return res.status(400).json({
      ok: false,
      msg: err.message
    });
  }
}

/**
 * PUT /api/remision/put/actualizar/:remisionId
 * Actualizar datos de remisión (placa, guia, cajas, oc, ov, fechaRemision, observaciones)
 * 
 * Body: {
 *   placa: string (opcional),
 *   guia: string (opcional),
 *   cajas: number (opcional),
 *   oc: string (opcional),
 *   ov: string (opcional),
 *   fechaRemision: date/string (opcional),
 *   observaciones: string (opcional)
 * }
 */
async function actualizarDatosRemisionController(req, res) {
  try {
    const { remisionId } = req.params;
    const body = req.body || {};

    if (!remisionId) {
      return res.status(400).json({
        ok: false,
        msg: 'remisionId es requerido'
      });
    }

    const remisionActualizada = await actualizarDatosRemision(Number(remisionId), body);

    return res.status(200).json({
      ok: true,
      remision: remisionActualizada
    });

  } catch (err) {
    console.error('[REMISIÓN] Error en actualizarDatosRemisionController:', err);
    return res.status(400).json({
      ok: false,
      msg: err.message
    });
  }
}

module.exports = {
  ingresarCantidadListoController,
  remisionarController,
  getRemisionesByRequisicionController,
  getRemisionByIdController,
  getAllRemisionesController,
  actualizarDatosRemisionController
};
