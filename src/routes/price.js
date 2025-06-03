const express = require('express');
const { addMateria, updateMateria, getAllMateria, getItem, addPriceMateriaPrima } = require('../controllers/materiaControllers');
const { addPriceProducto, updateProducto } = require('../controllers/finalProduct');

const router = express.Router();


router.route('/give')
    .post(addPriceMateriaPrima)
    .put(updateMateria)

// PRODUCTO TERMINADO
router.route('/pt/give')
    .post(addPriceProducto)
    .put(updateProducto) 

 
module.exports = router;  