const express = require('express');
const { newBodega, registrarMovimientos, nuevoCompromiso, addMtToBodega, addPTToBodega, getInvetarioMateriaPrima, getBodegas, getBodegaItems, getMovimientosBodega, searchMPForInventario, getAllInventarioId, getMovimientosMateriaBodega, getMovimientosItemProyectos, getCotizacionConCompromisos, getOneCotizacionConCompromisos, searchPTForInventario, getAllInventarioIdProducto, getMovimientosProductosBodega, getItemOverviewByBodegaController, listarItemsController, getItemsConMenosStockController, getItemsConMasMovimientoController, getItemsConCompromisoNegativoController, sacaKitBodegaEnProceso } = require('../controllers/almacen');
const { getAllCotizacionsComprasAlmacen, getOrdenDeCompraAlmacen } = require('../controllers/requisicionController');
const { registrarMovimientoAlmacen } = require('../controllers/services/inventarioServices');
const router = express.Router();


router.route('/post/bodega/new')
    .post(newBodega)

router.route('/post/get/bodegasData')
    .post(getBodegas); // Obtener contados de multiples bodegas

router.route('/get/bodegas/items/:bodegaId') // Obtenemos item de una bodega especifica
    .get(getBodegaItems);

router.route('/get/bodega/materia/one/:itemId/:ubicacionId') // Obtenemos una materia especifica
    .get(getAllInventarioId);

router.route('/get/bodega/producto/one/:itemId/:ubicacionId')
    .get(getAllInventarioIdProducto)

router.route('/get/bodega/materia/data/:itemId/:ubicacionId') // Datos
    .get(getMovimientosMateriaBodega);

router.route('/get/bodega/materia/data/cotizacion/:itemId/:cotizacionId')
    .get(getMovimientosItemProyectos)


router.route('/get/bodega/producto/data/:itemId/:ubicacionId') // Datos
    .get(getMovimientosProductosBodega);

router.route('/get/bodegas/movimientos/:bodegaId') // Obtenemos movimientos de una bodega especifica.
    .get(getMovimientosBodega); 

router.route('/get/bodegas/items/query/search')
    .get(searchMPForInventario)
 
router.route('/get/bodegas/items/query/pt/search')
    .get(searchPTForInventario)
 
router.route('/get/materiaPrima/data/:mpId')
    .get(getInvetarioMateriaPrima)

router.route('/post/bodega/addHowMany') // Registrar movimiento materia prima y producto terminado
    .post(registrarMovimientos)

router.route('/post/bodega/moviemitos/add')
    .post(registrarMovimientos)

router.route('/post/bodega/materiaPrima/add') // INGRESAR TODA LA MP AL INVENTARIO
    .get(addMtToBodega)
 
router.route('/post/bodega/producto/add') // INGRESAR TODO EL PT AL INVENTARIO
    .get(addPTToBodega)

router.route('/get/aprobar/generar/:cotizacionId')
    .get(nuevoCompromiso)


// Ordenes de compra para recibir
router.route('/get/ordenesCompra/all/')
    .get(getAllCotizacionsComprasAlmacen)

router.route('/get/ordenesCompra/one/:ordenId')
    .get(getOrdenDeCompraAlmacen)


router.route('/get/almacen/proyectos/todo')
    .get(getCotizacionConCompromisos)

router.route('/get/almacen/proyecto/one/:cotizacionId')
    .get(getOneCotizacionConCompromisos)

// VER ITEM EN BODEGA
router.route('/get/plus/item/') 
    .get(getItemOverviewByBodegaController)
     
router.route('/remove/kit/materiaBodega/')
    .get(sacaKitBodegaEnProceso)
    
// VER ITEMS EN BODEGA
router.route('/get/plus/bodegas')
    .get(listarItemsController);

router.route('/ask/get/lessInventary')
    .get(getItemsConMenosStockController)

router.route('/ask/get/moreMovimients')
    .get(getItemsConMasMovimientoController)

router.route('/ask/get/moreNegative')
    .get(getItemsConCompromisoNegativoController)


module.exports = router; 
  