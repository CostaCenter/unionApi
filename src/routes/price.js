const express = require('express');
const { addMateria, updateMateria, getAllMateria, getItem, addPriceMateriaPrima, updatePricesMP, updateToInactivePCMP } = require('../controllers/materiaControllers');
const { addPriceProducto, updateProducto, updatePricesProductos } = require('../controllers/finalProduct');

const router = express.Router();


router.route('/give')
    .post(addPriceMateriaPrima)
    .put(updateMateria)

router.route('/remove')
    .put(updateToInactivePCMP)

// FUNCIÓN PARA ACTUALIZAR TODOS LOS PRECIOS DEL SISTEMA MP | ¡¡¡ PELIGRO !!!
// router.route('/mp/updateAll')
//     .get(updatePricesMP)
// PRODUCTO TERMINADO
router.route('/pt/give')
    .post(addPriceProducto)
    .put(updateProducto) 

// FUNCIÓN PARA ACTUALIZAR TODOS LOS PRECIOS DEL SISTEMA PT | ¡¡¡ PELIGRO !!!
// router.route('/pt/updateAll')
//     .get(updatePricesProductos)

 
module.exports = router;  