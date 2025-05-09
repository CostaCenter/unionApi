const express = require('express');
const { getAllRequisiciones, getRequisicion } = require('../controllers/requisicionController');
const router = express.Router();


router.route('/getAll')
    .get(getAllRequisiciones)

router.route('/get/:reqId')
    .get(getRequisicion)
module.exports = router; 
 