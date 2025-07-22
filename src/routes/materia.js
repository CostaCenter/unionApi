const express = require('express');
const { addMateria, updateMateria, getAllMateria, getItem, buscarPorQuery, clonarMateriaPrima, deleteMP } = require('../controllers/materiaControllers');
const { getAllProducto, addProductoTerminado, updateProducto, getItemProducto, buscarPorQueryProducto, deleteProducto, clonarProducto, getProduccionPorFecha, getProductosFiltrados, getProduccion } = require('../controllers/finalProduct');
const { newService, updateService, getServices } = require('../controllers/serviciosCotizacion');

const router = express.Router();

router.route('/searching')
    .get(buscarPorQuery)

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