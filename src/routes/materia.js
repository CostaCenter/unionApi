const express = require('express');
const { addMateria, updateMateria, getAllMateria, getItem, buscarPorQuery } = require('../controllers/materiaControllers');
const { getAllProducto, addProductoTerminado, updateProducto, getItemProducto } = require('../controllers/finalProduct');

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

module.exports = router; 