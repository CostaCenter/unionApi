const express = require('express');
const { addMateria, updateMateria, getAllMateria, getItem, buscarPorQuery, clonarMateriaPrima, deleteMP, getMateriaComportamiento, getAllPriceMateriaProvider } = require('../controllers/materiaControllers');
const { getAllProducto, addProductoTerminado, updateProducto, getItemProducto, buscarPorQueryProducto, deleteProducto, clonarProducto, getProduccionPorFecha, getProductosFiltrados, getProduccion, getAllPriceProductoTerminadoProvider } = require('../controllers/finalProduct');
const { newService, updateService, getServices } = require('../controllers/serviciosCotizacion');

const router = express.Router();

router.route('/searching')
    .get(buscarPorQuery)

router.route('/get/graph/data/:materiaId')
    .get(getMateriaComportamiento)
router.route('/get/prices/all/:materiaId/:proveedorId')
    .get(getAllPriceMateriaProvider)

router.route('/search')
    .get(getAllMateria)

router.route('/get/:itemId')
    .get(getItem) 
        
router.route('/new')
    .post(addMateria)
    .put(updateMateria)

router.route('/materia/clone')
    .post(clonarMateriaPrima)

router.route('/materia/remove')
    .delete(deleteMP)
    
// PRODUCTO
router.route('/producto/search')
    .get(getAllProducto) 

router.route('/get/productoPrice/all/:productoId/:proveedorId')
    .get(getAllPriceProductoTerminadoProvider)

router.route('/producto/get/:itemId')
    .get(getItemProducto)

router.route('/producto/new')
    .post(addProductoTerminado)
    .put(updateProducto)

router.route('/producto/remove')
    .delete(deleteProducto)

router.route('/producto/clonar/:productoId/:userId')
    .get(clonarProducto)

router.route('/producto/searching')
    .get(buscarPorQueryProducto)


router.route('/producto/get/graph/groups/:inicio/:fin')
    .get(getProduccionPorFecha)
router.route('/producto/get/filter/search')
    .get(getProductosFiltrados)

// SERVICIOS
router.route('/services/search')
    .get(getServices) 

router.route('/service/new')
    .post(newService)
    .put(updateService)

router.route('/producto/remove')
    .delete(deleteProducto)

module.exports = router; 