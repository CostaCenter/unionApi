const express = require('express');
const { getAllRequisiciones } = require('../controllers/requisicionController');
const router = express.Router();


router.route('/getAll')
    .get(getAllRequisiciones)

module.exports = router; 
 