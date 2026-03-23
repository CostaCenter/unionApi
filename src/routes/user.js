const express = require('express');
const {
    signUp,
    signIn,
    getLogged,
    isAuthenticated,
    validateEmail,
    getUsers,
    updateUser,
    changeUserState,
    deleteUser,
    changePassword,
} = require('../controllers/user');
const router = express.Router();


router.route('/validate')
    .post(validateEmail)

router.route('/logged')
    .get(isAuthenticated, getLogged)

router.route('/new')
    .post(isAuthenticated, signUp)

router.route('/sign')
    .post(signIn)

// ── Gestión de usuarios (requieren autenticación) ──────────────────────────
router.route('/getAll')
    .get(isAuthenticated, getUsers)

router.route('/update/:id')
    .put(isAuthenticated, updateUser)

router.route('/state/:id')
    .put(isAuthenticated, changeUserState)

router.route('/delete/:id')
    .delete(isAuthenticated, deleteUser)

router.route('/password/:id')
    .put(isAuthenticated, changePassword)

module.exports = router;