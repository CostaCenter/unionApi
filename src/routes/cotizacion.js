const express = require('express');
const { newCotizacion, addItemToCotizacion, deleteKitOnCotizacion, updateItemToCotizacion, getCotizacion, getAllCotizaciones, searchClientQuery, acceptCotizacion, addSuperKit, deleteSuperKitOnCotizacion, giveDescuento, giveDescuentoSuperKitItem } = require('../controllers/cotizacion');

const router = express.Router();

router.route('/search')
    .get(searchClientQuery)

router.route('/getAll/')
    .get(getAllCotizaciones) 
router.route('/get/:cotiId')
    .get(getCotizacion)
router.route('/new')
    .post(newCotizacion);

router.route('/add/item')
    .post(addItemToCotizacion)
    .put(updateItemToCotizacion)

router.route('/add/superKit/item')
    .post(addSuperKit)

router.route('/remove/item')
    .delete(deleteKitOnCotizacion)

router.route('/remove/superKit')
    .delete(deleteSuperKitOnCotizacion)

// Aceptar cotización
router.route('/accept/:cotiId')
    .get(acceptCotizacion)

router.route('/kit/descuento')
    .put(giveDescuento)
      
router.route('/superKit/descuento')
    .put(giveDescuentoSuperKitItem)
module.exports = router; 