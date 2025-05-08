const express = require('express');
const { newCotizacion, addItemToCotizacion, deleteKitOnCotizacion, updateItemToCotizacion, getCotizacion, getAllCotizaciones, searchClientQuery, acceptCotizacion } = require('../controllers/cotizacion');

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

router.route('/remove/item')
    .delete(deleteKitOnCotizacion)

// Aceptar cotización
router.route('/accept/:cotiId')
    .get(acceptCotizacion)
module.exports = router; 