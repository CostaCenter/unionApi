const express = require('express');
const { newClient } = require('../controllers/client');

const router = express.Router();

router.route('/new')
    .post(newClient);


module.exports = router; 