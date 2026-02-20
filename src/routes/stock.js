const express = require('express');
const { getStockBodegaController, createStockIngresoController, createStockSalidaController, getStockItemController, transferirItemConCompromisosController } = require('../controllers/stock');

const router = express.Router();

// ESTE ES EL ENRUTADOR DE STOCK


// GET stock por bodega (paginado)
// Ej: GET /stock/bodega/4?tipo=PR&page=1&limit=50
router.route('/bodega/:ubicacionId') 
    .get(getStockBodegaController);

// POST ingreso de stock
// Body: { cantidad, productoId|materiaPrimaId, kitId, medida, unidad, bodegaId, tipoMovimiento, referenciaDeDocumento, notas, bodegaOrigenId }
router.route('/ingreso')
    .post(createStockIngresoController);

// POST salida de stock
// Body: { cantidad, productoId|materiaPrimaId, kitId, medida, unidad, bodegaId, tipoMovimiento, referenciaDeDocumento, notas, bodegaDestinoId }
router.route('/salida')
    .post(createStockSalidaController);

// GET item específico en bodega con movimientos
// Ej: GET /stock/item?productoId=123&ubicacionId=5&medida=9.00&limit=50
router.route('/item')
    .get(getStockItemController);

// POST transferir item de orden de compra (de bodega origen a en-proceso)
// Body: { comprasCotizacionItemId: number }
// - MP: Bodega 1 → Bodega 4
// - PT: Bodega 2 → Bodega 5
// - Actualiza compromisos por proyecto según itemToProject
router.route('/transferir-item')
    .post(transferirItemConCompromisosController);

module.exports = router;
