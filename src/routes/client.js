const express = require('express');
const { newClient, getAllClient, updateClientFunction } = require('../controllers/client');

const router = express.Router();

router.route('/new')
    .post(newClient)
    .put(updateClientFunction);

router.route('/getAll')
    .get(getAllClient)


module.exports = router; 