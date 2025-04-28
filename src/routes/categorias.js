const express = require('express');
const { addCategoria, updateCategoria, categoriaState } = require('../controllers/lineas');
const router = express.Router();


router.route('/new')
    .post(addCategoria)
    .put(updateCategoria)

router.route('/state')
    .put(categoriaState)

module.exports = router; 
