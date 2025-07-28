const express = require('express');
const { getAllRequisiciones, getRequisicion, getMultipleReq, changeStateOfReq } = require('../controllers/requisicionController');
const router = express.Router();


router.route('/getAll')
    .get(getAllRequisiciones)

router.route('/get/:reqId')
    .get(getRequisicion)

router.route('/get/multiReq')
    .post(getMultipleReq)

router.route('/put/estado') // Actualizamos requisición
    .put(changeStateOfReq)
module.exports = router; 
 