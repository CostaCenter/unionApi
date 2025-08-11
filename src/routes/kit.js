const express = require('express');
const { addKit, addItem, getKit, deleteItemOnKit, getAllKit, changeStateToKit, getAllKitCompleted, clonarKit, deleteKit, updateKitt, getKits, searchKitsQuery, updateItemOnKit, searchKitsForCoti, addSegmento, updateSegmento, getProduccion, getKitPorFecha, getKitsFiltrados, deleteSegmento, givePriceToKit, needNewKit, addMessageToRequerimiento, giveKitToRequerimiento, getAllRequerimientos, getRequerimiento, readRequerimiento } = require('../controllers/kitController');
const multer = require('multer');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const cloudinary = require('cloudinary').v2;

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
 
router.route('/requerimientos/get/all')
    .get(getAllRequerimientos)

router.route('/requerimiento/get/one/:reqId')
    .get(getRequerimiento)

router.route('/requerimiento/put/read')
    .put(readRequerimiento)
    
router.route('/requerimientos/post/add/message')
    .post(
        upload.array('images'),
        addMessageToRequerimiento)

router.route('/requerimiento/put/give/kit')
    .put(giveKitToRequerimiento)
module.exports = router; 