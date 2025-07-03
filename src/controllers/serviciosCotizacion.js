const express = require('express');
const { service, serviceCotizacion, db, literal } = require('../db/db');
const { Op } = require('sequelize');
const { searchPrice, addPriceMt, updatePriceState, searchProductPrice, updateProductPriceState, addPricePT,  } = require('./services/priceServices');

// Obtenemos  todos los servicios
const getServices = async (req, res) => {
    try{
        // Comenzamos la función
        const getAllServices = await service.findAll()

        if(!getAllServices) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        // Enviamos
        res.status(200).json(getAllServices);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}
// Controladores para Producto terminado
const newService = async (req, res) => {
    try{
        // Recibimos datos por body
        const { name, description } = req.body;

        // Validamos los datos que llegan por body
        if(!name || !description) return res.status(400).json({msg: 'No hemos recibimos los parámetros'});
        // Caso contrario, avanzamos a crear el servicio
        const newServiceFunction = await service.create({
            name,
            description
        });

        if(!newServiceFunction) return res.status(502).json({msg: 'No hemos logrado crear esto'});
        // Caso contrario, evnviamos respuesta
        res.status(201).json({msg: 'Servicio creado con éxito'});

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
} 

const updateService = async (req, res) => {
    try{
        // Recibimos datos por body
        const { serviceId, name, description } = req.body;
        // Validamos que los parámetros entren correctamente
        if(!serviceId) return res.status(400).json({msg: 'Los parámetros no son correctos'});
        // Caso contrario, avanzamos
        const updateThat = await service.create({
            name,
            description
        }, {
            where: {
                id: serviceId
            }
        });

        if(!updateThat) return res.status(502).json({msg: 'No hemos logrado actualizar esto.'});
        // Caso contrario, avanzamos
        res.status(201).json({msg: 'Actualizado con éxito.'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la pricipal.'})
    }
}

 
module.exports = { 
    getServices,
    newService, // Agregar producto terminado
    updateService, // Avanzamos
}