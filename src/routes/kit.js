const express = require('express');
const { 
    addKit, addItem, getKit, deleteItemOnKit, getAllKit, changeStateToKit, 
    getAllKitCompleted, clonarKit, deleteKit, updateKitt, getKits, searchKitsQuery, 
    updateItemOnKit, searchKitsForCoti, addSegmento, updateSegmento, getProduccion, 
    getKitPorFecha, getKitsFiltrados, deleteSegmento, givePriceToKit, needNewKit, 
    addMessageToRequerimiento, giveKitToRequerimiento, getAllRequerimientos, 
    getRequerimiento, readRequerimiento, clonarKitCotizacion, getKitsFiltradosProduccion, 
    updateItemKitCalibre, getAllKitV2 
} = require('../controllers/kitController');
const multer = require('multer');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ==================== GET - Obtener Kits ====================
router.route('/get/:kitId').get(getKit);
router.route('/getAll').get(getAllKit);
router.route('/getAll/general').get(getKits);
router.route('/getAll/general/v2').get(getAllKitV2);
router.route('/getAllComplete').get(getAllKitCompleted);
router.route('/get/administration/kits').get(getProduccion);

// ==================== GET - Búsquedas y Filtros ====================
router.route('/get/s/search/').get(searchKitsQuery);
router.route('/get/cotizar/search/').get(searchKitsForCoti);
router.route('/get/filter/search').get(getKitsFiltrados);
router.route('/get/filter/querys/kits').get(getKitsFiltradosProduccion);
router.route('/get/graph/groups/:inicio/:fin').get(getKitPorFecha);

// ==================== GET - Precios y Clonación ====================
router.route('/kits/getPrices').get(givePriceToKit);
router.route('/clone/:kitId/:userId').get(clonarKit);
router.route('/clone/simulation/:kitId/:userId').get(clonarKitCotizacion);

// ==================== POST - Crear ====================
router.route('/new').post(addKit);
router.route('/add/item').post(addItem);
router.route('/add/segmento').post(addSegmento);

// ==================== PUT - Actualizar ====================
router.route('/new').put(updateKitt);
router.route('/add/item').put(updateItemOnKit);
router.route('/add/segmento').put(updateSegmento);
router.route('/update/item/calibre').put(updateItemKitCalibre);
router.route('/updateState').put(changeStateToKit);

// ==================== DELETE ====================
router.route('/delete/:kitId/:userId').delete(deleteKit);
router.route('/remove/item').delete(deleteItemOnKit);
router.route('/segmento/delete/segmento/:segmentoId').delete(deleteSegmento);

// ==================== REQUERIMIENTOS DE KITS ====================
router.route('/requerimientos/get/all').get(getAllRequerimientos);
router.route('/requerimiento/get/one/:reqId').get(getRequerimiento);
router.route('/requerimientos/post/add').post(needNewKit);
router.route('/requerimiento/put/read').put(readRequerimiento);
router.route('/requerimiento/put/give/kit').put(giveKitToRequerimiento);
router.route('/requerimientos/post/add/message')
    .post(upload.array('images'), addMessageToRequerimiento);

module.exports = router; 