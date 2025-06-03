const express = require('express');
const { addPermission, givePermissionToUser } = require('../controllers/permission');

const router = express.Router();

router.route('/user/post/new')
    .post(addPermission)

router.route('/user/post/divePermission')
    .post(givePermissionToUser)
module.exports = router;  
