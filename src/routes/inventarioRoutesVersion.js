const express = require('express');
const { 
  registrarMovimientosVersion,
  verificarRequierePiezasCompletas,
  endpointPrueba
} = require('../controllers/almacenVersion');

const router = express.Router();

/**
 * RUTAS VERSIONADAS - Transferencia de piezas completas
 * 
 * Estas rutas implementan la nueva lógica:
 * - Transferencia de piezas completas para mt2 y mt
 * - Sin compromiso en bodega origen
 * - Relacionado con orden de compra (comprasCotizacionId obligatorio)
 * - Pool compartido en bodega 4/5
 */

// Registrar movimiento versionado (transferencia)
router.route('/post/bodega/movimientos-version')
  .post(registrarMovimientosVersion);

// Verificar si un item requiere piezas completas
router.route('/get/verificar/piezas-completas')
  .get(verificarRequierePiezasCompletas);

// Endpoint de prueba - Muestra información útil
router.route('/get/prueba')
  .get(endpointPrueba);

module.exports = router;
