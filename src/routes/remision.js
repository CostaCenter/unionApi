const express = require('express');
const {
  ingresarCantidadListoController,
  remisionarController,
  getRemisionesByRequisicionController,
  getRemisionByIdController,
  getAllRemisionesController,
  actualizarDatosRemisionController
} = require('../controllers/remision');

const router = express.Router();

// Ingresar cantidades listas para remisión
router.route('/post/ingresar-listo')
  .post(ingresarCantidadListoController);

// Remisionar (cambiar estado y hacer salida de inventario)
router.route('/put/remisionar/:remisionId')
  .put(remisionarController);

// Actualizar datos de remisión (placa, guia, cajas, oc, ov, fechaRemision)
router.route('/put/actualizar/:remisionId')
  .put(actualizarDatosRemisionController);

// Obtener TODAS las remisiones con paginación
router.route('/get/all')
  .get(getAllRemisionesController);

// Obtener remisiones de una requisición
router.route('/get/requisicion/:requisicionId')
  .get(getRemisionesByRequisicionController);

// Obtener detalle de una remisión
router.route('/get/:remisionId')
  .get(getRemisionByIdController);

module.exports = router;
