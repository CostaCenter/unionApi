const express = require('express');
const { ubicacion, inventario, movimientoInventario,  } = require('../db/db');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { validateEmailService } = require('./services/userServices');

// CONTROLADORES DEL INVENTARIO
const getAllInventario = async (req, res) =>{
    try{
        // Creamos consulta.
        const searchAll = await inventario.findAll({
            include: [{
                model: ubicacion
            }]
        }).catch(err => {
            console.log(err);
            return null;
        });

        if(!searchAll) return res.status(404).json({msg: 'No hay inventario'});
        // caso contrario. Enviamos respuesta.
        res.status(200).json({msg: 'Ha ocurrido un error en la principal.'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'})
    }
}

// Obtener inventario item especifico
const getAllInventarioId = async(req, res) => {
    try{
        // Recibimos el item ID y la ubicación. // Bodega, Proceso, Terminado...
        const { itemId, ubicacion } = req.params;
        if(!itemId || !ubicacion) return res.status(501).json({msg: 'No hemos encontrado esto.'});
        
        // Caso contrario, consultamos esto...
        const searchInventario = await inventario.findOne({
            where: {
                itemId,
                ubicacionId: ubicacion,
            },
            include:[{
                model: ubicacion
            }, 
            { model: movimientoInventario, as: 'origen' },
            { model: movimientoInventario, as: 'destino' }]
        }).catch(err => {
            console.log(err);
            return null;
        });

        if(!searchInventario) return res.status(404).json({msg: 'No hemos encontrado esto aquí'});
        // Caso contrario, avanzamos
        res.status(200).json(searchInventario);
        
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
} 