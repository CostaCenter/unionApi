const express = require('express');
const { addLinea, updateLinea, lineaState, getAllFiltros } = require('../controllers/lineas');
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

module.exports = router; 
