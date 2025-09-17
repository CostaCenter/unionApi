const express = require('express');
const { getAllRequisiciones, getRequisicion, getMultipleReq, changeStateOfReq, addProductToReq, addAllItems, addMateriaReq, realRequisicion, getRealProyectosRequisicion, getMateriaByComprar, getProveedoresComunes } = require('../controllers/requisicionController');
const router = express.Router();


router.route('/getAll')
    .get(getAllRequisiciones)

router.route('/get/:reqId')
    .get(getRequisicion)

router.route('/get/post/generateAll/:requisicionId')
    .get(addAllItems)

router.route('/get/real/:reqId')
    .get(realRequisicion)

router.route('/get/req/multipleReal/')
    .post(getRealProyectosRequisicion)

    // COTIZAR
router.route('/get/materiales/materia/')
    .post(getMateriaByComprar)
router.route('/get/cotizar/realTime/MP')
    .post(getProveedoresComunes)

router.route('/post/addItem/req')
    .post(addProductToReq)

router.route('/post/addMateria/req')
    .post(addMateriaReq)
 
router.route('/get/multiReq')
    .post(getMultipleReq)

router.route('/put/estado') // Actualizamos requisición
    .put(changeStateOfReq)
module.exports = router; 
 