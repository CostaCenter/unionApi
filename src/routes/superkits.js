const express = require('express');
const { getAll, getSuperKit, newArmado, addItemArmado, searchSuperKitsQuery} = require('../controllers/armados');
const multer = require('multer');
const router = express.Router();
 
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const cloudinary = require('cloudinary').v2;

router.route('/get/s/search')
    .get(searchSuperKitsQuery)
    
router.route('/getAll')
    .get(getAll)

router.route('/get/:superKit')
    .get(getSuperKit)

router.route('/post/new')
    .post(
        upload.single('image'),
        newArmado
    ) 
 
router.route('/post/addKit')
    .post(addItemArmado)


module.exports = router; 
 