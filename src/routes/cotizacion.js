const express = require('express');
const { newCotizacion, addItemToCotizacion, deleteKitOnCotizacion, updateItemToCotizacion, getCotizacion, getAllCotizaciones, searchClientQuery, acceptCotizacion, addSuperKit, deleteSuperKitOnCotizacion, giveDescuento, giveDescuentoSuperKitItem, addAreaToCotizacion, editAreaToCotizacion, deleteAreaToCotizacion, addProducto, clonarArea, addRegisterToCotizacion, deleteProductOnCotizacion, deleteCotizacion, giveDescuentoProducto, newVersionAboutCotizacion, beOfficialVersion } = require('../controllers/cotizacion');
const multer = require('multer');

 
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const cloudinary = require('cloudinary').v2;

const router = express.Router();

router.route('/search')
    .get(searchClientQuery)

router.route('/getAll/:userId')
    .get(getAllCotizaciones)   

router.route('/get/:cotiId')
    .get(getCotizacion)
router.route('/new')
    .post(newCotizacion);

router.route('/version/new')
    .post(newVersionAboutCotizacion)
router.route('/version/updateToOficial')
    .put(beOfficialVersion)

router.route('/remove/cotizacion')
    .delete(deleteCotizacion) 

// Agregar nota  
router.route('/post/register/new')
    .post(
        upload.single('image'),
        addRegisterToCotizacion
    )
router.route('/add/item')
    .post(addItemToCotizacion)
    .put(updateItemToCotizacion)

router.route('/add/superKit/item') 
    .post(addSuperKit)

router.route('/remove/item')
    .delete(deleteKitOnCotizacion)

router.route('/remove/superKit')
    .delete(deleteSuperKitOnCotizacion)

router.route('/remove/producto')
    .delete(deleteProductOnCotizacion)

// Aceptar cotización
router.route('/accept/:cotiId')
    .get(acceptCotizacion)

router.route('/kit/descuento')
    .put(giveDescuento)
      
router.route('/superKit/descuento') 
    .put(giveDescuentoSuperKitItem)


// PRODUCTO
router.route('/add/producto/item')
    .post(addProducto)

router.route('/producto/descuento')
    .put(giveDescuentoProducto)
 
// router.route('/remove/item')
//     .delete(deleteKitOnCotizacion)


// Agregar área
router.route('/area/add')
    .post(addAreaToCotizacion)
    .put(editAreaToCotizacion)

// Eliminar
router.route('/area/remove')
    .delete(deleteAreaToCotizacion)

router.route('/area/clonar')
    .post(clonarArea)

module.exports = router; 