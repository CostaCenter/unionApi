const express = require('express');
const { addMateria, updateMateria, getAllMateria, getItem, buscarPorQuery } = require('../controllers/materiaControllers');

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


module.exports = router; 