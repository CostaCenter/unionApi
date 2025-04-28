const express = require('express');
const { addExtension, updateExtension, extensionState } = require('../controllers/lineas');
const router = express.Router();


router.route('/new')
    .post(addExtension)
    .put(updateExtension)

router.route('/state')
    .put(extensionState)

module.exports = router; 
