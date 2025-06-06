const express = require('express');
const { client, kit, materia, cotizacion, armado, armadoCotizacion, kitCotizacion, user } = require('../db/db');
const { Op } = require('sequelize');
const { createCotizacion, addItemToCotizacionServices, addSuperKitToCotizacionServices } = require('./services/cotizacionServices');
const { createRequisicion } = require('./services/requsicionService');
const dayjs = require('dayjs');

// Buscar cliente para cotizacion
const searchClientQuery = async(req, res) => {
    try {
        const { query } = req.query; // Obtiene el parámetro de búsqueda desde la URL

        if (!query) {
            return res.status(400).json({ message: "Debes proporcionar un término de búsqueda." });
        }

        const clientes = await client.findAll({
            where: {
                [Op.or]: [
                    { nombre: { [Op.iLike]: `%${query}%` } }, // Búsqueda flexible (ignora mayúsculas/minúsculas)
                    { nit: { [Op.iLike]: `%${query}%` } } // Buscar en otro campo
                ]
            },
            attributes: { exclude: ['createdAt', 'updatedAt'] },
            limit: 10, // Máximo 10 resultados para eficiencia
        }).catch((err => {
            console.log(err);
            return null;
        }));

        if(!clientes) return res.status(404).json({msg: 'No encontrado'})

        res.status(200).json(clientes);
    } catch (error) {
        console.error("Error al buscar productos:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
}
// Obtener Cotizaciones
const getAllCotizaciones = async(req, res) => {
    try{
        const searchCotizaciones = await cotizacion.findAll({
            include: [{
                model: kit,
                include:[{
                    model: materia,
                    attributes: { exclude: ['createdAt', 'updatedAt']}
                }],
                through: {
                    attributes: ['id', 'cantidad', 'precio', 'descuento'] // o los campos que tengas en KitCotizacion
                }
            }, {
                model: client
            }, {
                model: armado
            }], 
            order:[['createdAt', 'DESC']]
        }).catch(err => {
            console.log(err);
            return null
        });
        // Validamos contenido.
        if(!searchCotizaciones) return res.status(404).json({msg: 'No hay cotizaciones'});
        // Caso contrario
        res.status(200).json(searchCotizaciones);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un erro en la principal.'});
    }
}
// Obtener cotización.
const getCotizacion = async(req, res) => {
    try{
        // Recibimos datos por params
        const { cotiId } = req.params;
        // Validamos que el parametro entre
        if(!cotiId) return res.status(501).json({msg: 'El parámetro no es valido'});
    
        // Caso contrario, consultados
        const searchCoti = await cotizacion.findByPk(cotiId, {
            attributes: { exclude: ['updatedAt']},
            include:[{model: client},{
                model: kit,
                include:[{
                    model: materia
                }],
                through: {
                    attributes: ['id', 'cantidad', 'precio', 'descuento'] // o los campos que tengas en KitCotizacion
                }
            }, {
                model: armado,
            }]
        }).catch(err => {
            console.log(err);
            return null;
        })

        if(!searchCoti) return res.status(404).json({msg: 'No hemos encontrado esto'});
        // Caso contrario, enviamos respuesta
        res.status(200).json(searchCoti);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Crear cotización
const newCotizacion = async (req, res) => {
    try{
        
        const { clientId, name, description, time, fechaAprobada, price, descuento, iva, } = req.body;
        
        // Validamos 
        if(!clientId || !name || !description || !time) return res.status(501).json({msg: 'Los parámetros no son validos.'});
         
        // Procedemos a crear cotización
        const add = await createCotizacion(clientId, name, description, time, fechaAprobada, price, descuento, iva)
        .catch(err => {
            console.log(err);
            return null;
        });

        if(!add) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        // Caso contrario, devolvemos cotización
        res.status(201).json(add);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Agregamos items o kit a la cotización
const addItemToCotizacion = async(req, res) => {
    try{
        // Recibimos datos por body.
        const { cotizacionId, kitId, cantidad, precio, descuento } = req.body;
        // Validamos que los datos entren correctamente
        if(!cotizacionId || !kitId || !cantidad || !precio ) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos...

        const sendItem = await addItemToCotizacionServices(cotizacionId, kitId, cantidad, precio, descuento)
        .catch(err => {
            console.log(err);
            return null;
        });
        if(sendItem == 200) return res.status(200).json({msg: 'Ya existe este kit dentro de la cotización.'}); 
        if(!sendItem || sendItem == 502) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        // Caso contrario, enviamos la creación
        res.status(201).json(sendItem);



    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Dar descuento a item en cotización
const giveDescuento = async(req, res) => {
    try{
        // Recibimos datos por body
        const { kitCotizacionId, descuento } = req.body;
        // Validamos que los datos entres
        if(!kitCotizacionId || !descuento) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos
        // Consultamos que exista este itemCotizacion
        const getKitCotizacion = await kitCotizacion.findByPk(kitCotizacionId);
        // Validamos la respuesta
        if(!getKitCotizacion) return res.status(404).json({msg: 'No hemos encontrado este item en la cotización'});
        // Caso contrario, avannzamos
        // Creamos petición para actualizar
        const updateKitCotizacion = await kitCotizacion.update({
            descuento
        }, {
            where: {
                id: kitCotizacionId
            }
        });
        // Validamos la respuesta
        if(!updateKitCotizacion) return res.status(502).json({msg: 'No hemos logrado actualizar esto.'});
        // Caso contrario, enviamos respuesta 200. ¡Actualizado!
        res.status(200).json({msg: 'Descuento añadido.'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Dar descuento a superKit en cotización
const giveDescuentoSuperKitItem = async(req, res) => {
    try{
        // Recibimos datos por body
        const { superKitId, descuento } = req.body;
        // Validamos que los datos entres
        if(!superKitId || !descuento) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos
        // Consultamos que exista este itemCotizacion
        const getKitCotizacion = await armadoCotizacion.findByPk(superKitId);
        // Validamos la respuesta
        if(!getKitCotizacion) return res.status(404).json({msg: 'No hemos encontrado este item en la cotización'});
        // Caso contrario, avannzamos
        // Creamos petición para actualizar
        const updateKitCotizacion = await armadoCotizacion.update({
            descuento
        }, {
            where: {
                id: superKitId
            }
        });
        // Validamos la respuesta
        if(!updateKitCotizacion) return res.status(502).json({msg: 'No hemos logrado actualizar esto.'});
        // Caso contrario, enviamos respuesta 200. ¡Actualizado!
        res.status(200).json({msg: 'Descuento añadido.'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// agregar superKit a la cotizacion
const addSuperKit = async(req, res) => {
    try{
        // Recibimos datos por body 
        const { cotizacionId, superKitId, cantidad, precio, descuento } = req.body; // Destructuramos
    
        // Validamos la entrada de parámetros
        if(!cotizacionId || !superKitId || !cantidad || !precio) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        
        // Enviamos petición asincrónica - Consultando una función services. Del Archivo cotizacionServices.js
        // Pasamos la cotización, el superKit, la cantidad, el precio y un descuento si tiene.
        const sendItem = await addSuperKitToCotizacionServices(cotizacionId, superKitId, cantidad, precio, descuento)
        .catch(err => {
            console.log(err);
            return null;
        });
        if(sendItem == 200) return res.status(200).json({msg: 'Ya existe este superKit dentro de la cotización.'}); 
        if(!sendItem || sendItem == 502) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        // Caso contrario, enviamos la creación
        res.status(201).json(sendItem);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Actualizar item de una cotización
const updateItemToCotizacion = async(req, res) => {
    try{
        // Recibimos datos por body
        const { cotizacionId, kitId, cantidad, precio, descuento } = req.body;
        // Validamos la entrada de los datos
        if(!cotizacionId || !kitId) return res.status(501).json({msg: 'Los parámetros no son validos.'});

        const update = await kitCotizacion.update({
            cantidad,
            precio,
            descuento: descuento,
        }, {
            where: {
                kitId,
                cotizacionId,
            }
        });

        if(!update) return res.status(502).json({msg: 'No hemos logrado actualizar esto.'});
        // Caso contrario
        res.status(200).json({msg: 'Actualizado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Eliminar item de una cotización
const deleteKitOnCotizacion = async (req, res) => {
    try{
        // Recibimos datos por body
        const { cotizacionId, kitId } = req.body;
        if(!cotizacionId || !kitId) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos...

        const searchKit = await kit.findByPk(kitId).catch(err => null);
        const searchCotizacion = await cotizacion.findByPk(cotizacionId).catch(err => null)
        if(!searchKit || !searchCotizacion) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        
        // Caso contrario, eliminamos.

        const deletee = await searchKit.removeCotizacion(searchCotizacion).catch(err => null);
        if(!deletee) return res.status(502).json({msg: 'No hemos logrado eliminar esto'});

        res.status(200).json({msg: 'Eliminado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Eliminar item de una cotización
const deleteSuperKitOnCotizacion = async (req, res) => {
    try{
        // Recibimos datos por body
        const { cotizacionId, superKidId } = req.body;
        if(!cotizacionId || !superKidId) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos...

        const searchKit = await armado.findByPk(superKidId).catch(err => null);
        const searchCotizacion = await cotizacion.findByPk(cotizacionId).catch(err => null)
        if(!searchKit || !searchCotizacion) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        
        // Caso contrario, eliminamos.

        const deletee = await searchKit.removeCotizacion(searchCotizacion).catch(err => null);
        if(!deletee) return res.status(502).json({msg: 'No hemos logrado eliminar esto'});

        res.status(200).json({msg: 'Eliminado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Aprobadar cotizaciónn
const acceptCotizacion = async (req, res) => {
    try{
        // Recibimos la cotización por params
        const { cotiId } = req.params;
        // Validamos
        if(!cotiId) return res.status(501).json({msg: 'El parámetro no es valido.'});
        // Caso contrario, avanzamos

        const searchCoti = await cotizacion.findByPk(cotiId).catch(err => null);
        // Validamos
        if(!searchCoti) return res.status(404).json({msg: 'No hemos encontrado esta cotización'});
        
        // Caso contrario, avanzamos
        const updateCoti = await cotizacion.update({
            state: 'aprobada'
        }, {
            where: {
                id: cotiId
            }
        })
        .then(async (res) => {
            // Obtenemos la hora actual
            const fechaActual = dayjs().format('YYYY-MM-DD');
            const fechaMaxima = dayjs().add(3, 'day').format('YYYY-MM-DD');
            // Creamos la requisición
            const newRequsicion = await createRequisicion(searchCoti.name, fechaActual, fechaMaxima, cotiId);

            return newRequsicion;
        })
        .catch(err => {
            console.log(err);
            return null;
        });
        console.log(updateCoti);
        if(updateCoti == 501) return res.status(501).json({msg: 'Parametros no son validos.'});
        if(updateCoti == 502) return res.status(502).json({msg: 'No hemos logrado generar requsición'})
        res.status(201).json({msg: 'Requisición enviada'})

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}


module.exports = { 
    getCotizacion, // Obtenemos una cotización por su Id
    newCotizacion, // Crear una nueva cotización
    addItemToCotizacion, // Agregar item a la cotización
    updateItemToCotizacion, // Actualizar items y precios dentro de una cotización.
    deleteKitOnCotizacion, // Eliminar Kit de una cotización
    getAllCotizaciones, // Obtener todas las cotizaciones
    searchClientQuery, // QUERY
    acceptCotizacion, // Aceptar cotización
    addSuperKit, // Nuevo superKit en Cotización.
    deleteSuperKitOnCotizacion, // Eliminar superKit Item
    giveDescuento, // Dar descuento a kitCotizacion
    giveDescuentoSuperKitItem, // Dar descuento a item SuperKit
}  