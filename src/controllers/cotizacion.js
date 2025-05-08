const express = require('express');
const { client, kit, materia, cotizacion, kitCotizacion } = require('../db/db');
const { Op } = require('sequelize');
const { createCotizacion, addItemToCotizacionServices } = require('./services/cotizacionServices');
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
                    attributes: ['cantidad', 'precio'] // o los campos que tengas en KitCotizacion
                }
            }, {
                model: client
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
            include:[{
                model: kit,
                include:[{
                    model: materia,
                    attributes: { exclude: ['createdAt', 'updatedAt']}
                }],
                through: {
                    attributes: ['cantidad', 'precio'] // o los campos que tengas en KitCotizacion
                }
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
}  