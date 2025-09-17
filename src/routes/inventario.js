const express = require('express');
const { newBodega, registrarMovimientos, nuevoCompromiso, addMtToBodega, addPTToBodega, getInvetarioMateriaPrima, getBodegas, getBodegaItems, getMovimientosBodega, searchMPForInventario, getAllInventarioId, getMovimientosMateriaBodega, getMovimientosItemProyectos } = require('../controllers/almacen');
const router = express.Router();


router.route('/post/bodega/new')
    .post(newBodega)

router.route('/post/get/bodegasData')
    .post(getBodegas); // Obtener contados de multiples bodegas

router.route('/get/bodegas/items/:bodegaId') // Obtenemos item de una bodega especifica
    .get(getBodegaItems);

router.route('/get/bodega/materia/one/:itemId/:ubicacionId') // Obtenemos una materia especifica
    .get(getAllInventarioId);

router.route('/get/bodega/materia/data/:itemId/:ubicacionId') // Datos
    .get(getMovimientosMateriaBodega);

router.route('/get/bodega/materia/data/cotizacion/:itemId/:cotizacionId')
    .get(getMovimientosItemProyectos)

router.route('/get/bodegas/movimientos/:bodegaId') // Obtenemos movimientos de una bodega especifica.
    .get(getMovimientosBodega); 

router.route('/get/bodegas/items/query/search')
    .get(searchMPForInventario)
 
router.route('/get/materiaPrima/data/:mpId')
    .get(getInvetarioMateriaPrima)

router.route('/post/bodega/addHowMany') // Registrar movimiento materia prima y producto terminado
    .post(registrarMovimientos)

router.route('/post/bodega/materiaPrima/add')
    .get(addMtToBodega)

router.route('/post/bodega/producto/add')
    .get(addPTToBodega)

router.route('/get/aprobar/generar/:cotizacionId')
    .get(nuevoCompromiso)

module.exports = router;  
