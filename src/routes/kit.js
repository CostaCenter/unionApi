const express = require('express');
const { addKit, addItem, getKit, deleteItemOnKit, getAllKit, changeStateToKit, getAllKitCompleted, clonarKit, deleteKit, updateKitt, getKits, searchKitsQuery, updateItemOnKit, searchKitsForCoti, addSegmento, updateSegmento } = require('../controllers/kitController');

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

router.route('/new')
    .post(addKit)
    .put(updateKitt)

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

router.route('/updateState')
    .put(changeStateToKit)



module.exports = router; 