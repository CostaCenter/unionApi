const express = require('express');
const { addMateria, updateMateria, getAllMateria, getItem, addPriceMateriaPrima } = require('../controllers/materiaControllers');

const router = express.Router();


router.route('/give')
    .post(addPriceMateriaPrima)
    .put(updateMateria)


module.exports = router; 