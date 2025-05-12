const express = require('express');
const { getAllRequisiciones, getRequisicion, getMultipleReq } = require('../controllers/requisicionController');
const router = express.Router();


router.route('/getAll')
    .get(getAllRequisiciones)

router.route('/get/:reqId')
    .get(getRequisicion)

router.route('/get/multiReq')
    .post(getMultipleReq)
module.exports = router; 
 