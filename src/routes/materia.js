const express = require('express');
const { addMateria, updateMateria, getAllMateria, getItem, buscarPorQuery } = require('../controllers/materiaControllers');
const { getAllProducto, addProductoTerminado, updateProducto, getItemProducto, buscarPorQueryProducto, deleteProducto, clonarProducto } = require('../controllers/finalProduct');

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

module.exports = router; 