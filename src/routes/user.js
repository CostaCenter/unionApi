const express = require('express');
const { signUp, signIn, getLogged, isAuthenticated, validateEmail } = require('../controllers/user');
const router = express.Router();

 
// router.route('/sign/validate')
//     .get(isAuthenticated)

router.route('/validate')
    .post(validateEmail)
    
router.route('/logged') 
    .get(isAuthenticated, getLogged)


router.route('/new')
    .post(signUp)
 
router.route('/sign')
    .post(signIn) 
module.exports = router;