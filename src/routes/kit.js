const express = require('express');
const { addKit, addItem, getKit, deleteItemOnKit, getAllKit, changeStateToKit, getAllKitCompleted, clonarKit, deleteKit, updateKitt, getKits } = require('../controllers/kitController');

const router = express.Router();

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

router.route('/remove/item')
    .delete(deleteItemOnKit)

router.route('/add/item')
    .post(addItem); 

router.route('/clone/:kitId')
    .get(clonarKit)

router.route('/delete/:kitId')
    .delete(deleteKit)

router.route('/updateState')
    .put(changeStateToKit)



module.exports = router; 