const express = require('express');
const router = express.Router();

const userRoutes = require('./user'); // USUARIOS DEL SOFTWARE
const proveedorRoutes = require('./proveedor'); // PROVEEDOR
const lineasRoutes = require('./lineas'); // Metódos de busquedas
const categoriasRoutes = require('./categorias'); // Metódos de busquedas
const extensionRoutes = require('./extension'); // Extensiones: Colores

const materiaRoutes = require('./materia'); // Materia prima
const priceRoutes = require('./price'); // Materia prima

const kitRoutes = require('./kit'); // Materia prima
const clientRoutes = require('./client'); // Clientes
const cotizacionRoutes = require('./cotizacion'); // Cotización
const requisicionroutes = require('./requisicion'); // Requisiciones

const superKitsRoutes = require('./superkits');
const permission = require('./permission');

router.use('/users', userRoutes);
router.use('/proveedores', proveedorRoutes);
router.use('/lineas', lineasRoutes);
router.use('/categorias', categoriasRoutes);
router.use('/extension', extensionRoutes);

router.use('/materia', materiaRoutes);
router.use('/mt/price', priceRoutes);
 
router.use('/kit', kitRoutes);
router.use('/client', clientRoutes);
router.use('/cotizacion', cotizacionRoutes);
router.use('/requisicion', requisicionroutes);
router.use('/superkit', superKitsRoutes);
router.use('/permission', permission)
 

 

module.exports = router; 