const express = require('express');
const { addProveedor, updateProveedor, changeStateProveedor, getAllProveedores, searchProveeresQuery, getProvider } = require('../controllers/proveedorController');
const router = express.Router();


// router.route('/sign/validate')
//     .get(isAuthenticated)

router.route('/get/query')
    .get(searchProveeresQuery)

router.route('/getOne/:providerId')
    .get(getProvider)
    
router.route('/get')
    .get(getAllProveedores)
    
router.route('/new')
    .post(addProveedor)
    .put(updateProveedor)

router.route('/state')
    .put(changeStateProveedor)

module.exports = router; 
