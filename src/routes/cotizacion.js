const express = require('express');
const { newCotizacion, addItemToCotizacion, deleteKitOnCotizacion, updateItemToCotizacion, getCotizacion, getAllCotizaciones, searchClientQuery, acceptCotizacion, addSuperKit, deleteSuperKitOnCotizacion, giveDescuento, giveDescuentoSuperKitItem, addAreaToCotizacion, editAreaToCotizacion, deleteAreaToCotizacion, addProducto, clonarArea, addRegisterToCotizacion, deleteProductOnCotizacion, deleteCotizacion, giveDescuentoProducto, newVersionAboutCotizacion, beOfficialVersion, updateCotizacion, addService, deleteServiceOnCotizacion, giveDescuentoService, getAllCondiciones, newCondiction, addPlanToCondicion, giveCondiciones, getAllCotizacionPorAprobar, acceptCotizacionToRequisicion, generarPdf, comeBackCotizacionToComercial, FinishCotizacion, getAllCotizacionForProduccion, ListoCotizacionState } = require('../controllers/cotizacion');
const multer = require('multer');

 
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const cloudinary = require('cloudinary').v2;

const router = express.Router();

// ADMINISTRACIÓN
router.route('/admin/getAll')
    .get(getAllCotizacionPorAprobar)
router.route('/admin/produccion/getAll')
    .get(getAllCotizacionForProduccion)

router.route('/admin/accept/:cotiId')
    .put(acceptCotizacionToRequisicion)
router.route('/admin/comeBack/:cotiId')
    .put(comeBackCotizacionToComercial)
router.route('/admin/gotoproduction/:cotiId')
    .put(FinishCotizacion)

router.route('/admin/listo/cotizacion/:cotiId')
    .put(ListoCotizacionState)


    
router.route('/generatePdf')
    .post(generarPdf)
    
router.route('/search')
    .get(searchClientQuery)

router.route('/getAll/:userId')
    .get(getAllCotizaciones)   

router.route('/get/:cotiId')
    .get(getCotizacion)
router.route('/new')
    .post(newCotizacion)
    .put(updateCotizacion)

router.route('/condiciones/give')
    .put(giveCondiciones)

router.route('/version/new')
    .post(newVersionAboutCotizacion)
router.route('/version/updateToOficial')
    .put(beOfficialVersion)

router.route('/remove/cotizacion')
    .delete(deleteCotizacion) 

// CONDICIONES
router.route('/condiciones/get/all')
    .get(getAllCondiciones)
router.route('/condiciones/post/new')
    .post(newCondiction)
router.route('/condiciones/post/subNew')
    .post(addPlanToCondicion)
// -----------
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


router.route('/add/service/item')
    .post(addService)
router.route('/remove/service')
    .delete(deleteServiceOnCotizacion)

router.route('/service/descuento')
    .put(giveDescuentoService) 


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