const express = require('express');
const { addKit, addItem, getKit, deleteItemOnKit, getAllKit, changeStateToKit, getAllKitCompleted, clonarKit, deleteKit, updateKitt, getKits, searchKitsQuery, updateItemOnKit, searchKitsForCoti, addSegmento, updateSegmento, getProduccion, getKitPorFecha, getKitsFiltrados, deleteSegmento, givePriceToKit, needNewKit, addMessageToRequerimiento, giveKitToRequerimiento } = require('../controllers/kitController');

const router = express.Router();

router.route('/get/cotizar/search/')
    .get(searchKitsForCoti)
    
router.route('/get/s/search/')
    .get(searchKitsQuery)
router.route('/getAllComplete')
    .get(getAllKitCompleted)

router.route('/getAll/general')
    .get(getKits)

router.route('/getAll') 
    .get(getAllKit);

router.route('/get/:kitId')
    .get(getKit);

router.route('/get/administration/kits')
    .get(getProduccion)


router.route('/get/graph/groups/:inicio/:fin')
    .get(getKitPorFecha)
router.route('/get/filter/search')
    .get(getKitsFiltrados)


router.route('/new')
    .post(addKit)
    .put(updateKitt)

router.route('/kits/getPrices')
    .get(givePriceToKit)

router.route('/add/segmento')
    .post(addSegmento)
    .put(updateSegmento)
    
router.route('/remove/item')
    .delete(deleteItemOnKit)

router.route('/add/item')
    .post(addItem)
    .put(updateItemOnKit)

router.route('/clone/:kitId/:userId')
    .get(clonarKit)

router.route('/delete/:kitId/:userId')
    .delete(deleteKit)

router.route('/segmento/delete/segmento/:segmentoId')
    .delete(deleteSegmento)

router.route('/updateState')
    .put(changeStateToKit)


// REQUERIMIENTOS DE KITS
router.route('/requerimientos/post/add')
    .post(needNewKit)

router.route('/requerimientos/post/add/message')
    .post(addMessageToRequerimiento)

router.route('/requerimiento/put/give/kit')
    .put(giveKitToRequerimiento)
module.exports = router; 