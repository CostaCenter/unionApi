const express = require('express');
const { 
  createAreaProductionController,
  createItemAreaProductionController,
  updateItemAreaProductionController,
  incrementarItemAreaProductionController,
  getItemsProduccionByRequisicionController
} = require('../controllers/production');

const router = express.Router();


// Crear área de producción
router.route('/post/area/')
  .post(createAreaProductionController);

// Crear item de área de producción (asignar item a un área)
router.route('/post/item-area')
  .post(createItemAreaProductionController);

// Actualizar cantidades procesadas de un item (REEMPLAZA el valor)
router.route('/put/item-area/:id')
  .put(updateItemAreaProductionController);

// Incrementar cantidades procesadas de un item (SUMA al valor existente)
router.route('/put/item-area/:id/incrementar')
  .put(incrementarItemAreaProductionController);

// Obtener items de producción por requisición
router.route('/get/requisicion/:requisicionId')
  .get(getItemsProduccionByRequisicionController);


module.exports = router;
