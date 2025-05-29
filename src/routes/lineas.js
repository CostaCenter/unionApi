const express = require('express');
const { addLinea, updateLinea, lineaState, getAllFiltros, givePercentage, getAllLineasWithPercentage } = require('../controllers/lineas');
const router = express.Router();


// router.route('/sign/validate')
//     .get(isAuthenticated)

router.route('/getAll')
    .get(getAllFiltros)
    
router.route('/new')
    .post(addLinea)
    .put(updateLinea)

router.route('/state')
    .put(lineaState)

router.route('/post/percentage')
    .post(givePercentage)

router.route('/get/porcentajes')
    .get(getAllLineasWithPercentage)

module.exports = router; 
