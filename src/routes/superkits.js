const express = require('express');
const { getAll, getSuperKit, newArmado, addItemArmado} = require('../controllers/armados');
const router = express.Router();
 

router.route('/getAll')
    .get(getAll)

router.route('/get/:superKit')
    .get(getSuperKit)

router.route('/post/new')
    .post(newArmado) 

router.route('/post/addKit')
    .post(addItemArmado)


module.exports = router; 
 