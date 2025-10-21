const express = require('express');
const { getAllRequisiciones, getRequisicion, getMultipleReq, changeStateOfReq, addProductToReq, addAllItems, addMateriaReq, realRequisicion, getRealProyectosRequisicion, getMateriaByComprar, getProveedoresComunes, newCotizacionProvider, addItemToCotizacionProvider, addSomeMuchCotizacionsProvider, getAllCotizacionsCompras, getCotizacionCompras, changeToCompras, changeToComprasToComprado, getAllOrdenesCompras, getOrdenDeCompra, changeItemCotizacionCompras, getProductosByComprar, getProveedoresComunesPT, addItemToCotizacionController, getProveedoresStats, addItemsToCotizacion, deleteItemOnCotizacion, getProveedoresStatsProductos, getDataProject, updateItemCompra, addItemToOrdenDeCompraProvider } = require('../controllers/requisicionController');
const router = express.Router();


router.route('/getAll')
    .get(getAllRequisiciones)

router.route('/get/:reqId')
    .get(getRequisicion)

router.route('/get/post/generateAll/:requisicionId')
    .get(addAllItems)

router.route('/get/real/:reqId')
    .get(realRequisicion)

router.route('/get/req/multipleReal/')
    .post(getRealProyectosRequisicion)

    // COTIZAR
router.route('/get/materiales/materia/')
    .post(getMateriaByComprar)

router.route('/get/materiales/producto/')
    .post(getProductosByComprar)

router.route('/put/updateCantidad/comprasCotizacionItem')
    .put(updateItemCompra);

router.route('/get/cotizar/realTime/MP')
    .post(getProveedoresComunes)

router.route('/get/cotizar/realTime/PT')
    .post(getProveedoresComunesPT)
    
router.route('/post/addItem/req')
    .post(addProductToReq)

router.route('/post/addMateria/req')
    .post(addMateriaReq)
 
router.route('/get/multiReq')
    .post(getMultipleReq)

router.route('/put/estado') // Actualizamos requisición
    .put(changeStateOfReq)


// COMPRAS Y COTIZACIONES
router.route('/post/generar/cotizacion/one')
    .post(newCotizacionProvider)

router.route('/post/generar/cotizacion/addItem')
    .post(addItemToCotizacionProvider)

router.route('/post/generar/add/cotizacion/addItem')
    .post(addItemsToCotizacion)

router.route('/post/searchProviders/analisis')
    .post(getProveedoresStats)

router.route('/post/searchProviders/analisis/productos')
    .post(getProveedoresStatsProductos)

router.route('/post/generar/cotizacion/somemuch')
    .post(addSomeMuchCotizacionsProvider)

// Anexamos un item desde afuera.
router.route('/post/addItem/cotizacion/add')
    .post(addItemToCotizacionController)

// Eliminar un item
router.route('/remove/cotizacionItemCompras/:comprasCotizacionItemId')
    .get(deleteItemOnCotizacion)

// Obtenemos cotizaciones de proyectos
router.route('/post/get/cotizaciones/')
    .post(getAllCotizacionsCompras)
getCotizacionCompras

// AGREGAMOS ITEM A COTIZACION CON SU REPARTICIÓN
router.route('/post/add/comprasCotizacion/item/add')
    .post(addItemToOrdenDeCompraProvider)
    
// Obtenemos una cotizacion por params
router.route('/get/get/cotizacion/:comprasCotizacionId')
    .get(getCotizacionCompras)

router.route('/get/update/cotizacion/:comprasCotizacionId')
    .get(changeToCompras);

router.route('/get/update/cotizacion/comprado/:comprasCotizacionId')
    .get(changeToComprasToComprado);
 
router.route('/get/get/admin/ordenesDeCompra')
    .get(getAllOrdenesCompras) // Obtenemos las ordenes de compra.
 
router.route('/get/get/admin/ordenDeCompra/:ordenId')
    .get(getOrdenDeCompra)

router.route('/get/get/almacen/itemCotizacion/:itemId')
    .get(changeItemCotizacionCompras)

router.route('/get/project/get/project/:projectId')
    .get(getDataProject)



module.exports = router; 
 