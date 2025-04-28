const express = require('express');
const { addKit, addItem, getKit, deleteItemOnKit, getAllKit, changeStateToKit, getAllKitCompleted } = require('../controllers/kitController');

const router = express.Router();

router.route('/getAllComplete')
    .get(getAllKitCompleted)
    
router.route('/getAll')
    .get(getAllKit);

router.route('/get/:kitId')
    .get(getKit);

router.route('/new')
    .post(addKit);

router.route('/remove/item')
    .delete(deleteItemOnKit)

router.route('/add/item')
    .post(addItem); 

router.route('/updateState')
    .put(changeStateToKit)



module.exports = router; 