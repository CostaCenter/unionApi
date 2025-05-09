const express = require('express');
const { materia, cotizacion,  proveedor, extension, price, kit, itemKit, linea, categoria, requisicion, db} = require('../db/db');
const { searchPrice, addPriceMt, updatePriceState,  } = require('./services/priceServices');
const { searchKit, createKitServices, addItemToKit, deleteDeleteItemOnKit, changeState } = require('./services/kitServices');

// Obtener todas las requisiciones
const getAllRequisiciones = async (req, res) => {
    try{
        // Recibimos todas las requsiciones
        const searchReq = await requisicion.findAll({
            include: [{
                model: cotizacion,
                include:[{
                    model: kit,
                    include: [{
                        model: materia,
                    }],
                    through: {
                        attributes: ['cantidad', 'precio'] // o los campos que tengas en KitCotizacion
                    }
                }],
                
            }]   
        }).catch(err => {
            console.log(err);
            return null;
        });

        if(!searchReq || !searchReq.length) return res.status(404).json({msg: 'Sin resultados.'});
        // Caso contrario
        res.status(200).json(searchReq)
    }catch(err){
        console.log(err)
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'})
    }
}


const getRequisicion = async (req, res) => {
    try{
        // Recibimos requisición por params
        const { reqId } = req.params;
        // Validamos
        if(!reqId) return res.status(501).json({msg: 'Parámetro no es valido.'});
        // Caso contrario avanzamos
        // Consultamos
        const searchReq = await requisicion.findByPk(reqId, {
            include: [{
                model: cotizacion,
                include:[{
                    model: kit,
                    include: [{
                        model: materia,
                    }],
                    through: {
                        attributes: ['cantidad', 'precio'] // o los campos que tengas en KitCotizacion
                    }
                }],
                
            }]   
        }).catch(err => {
            console.log(err);
            return null;
        });

        // Validamos respuesta
        if(!searchReq) return res.status(404).json({msg: 'No hemos encontrado esta requisición'});
        // Caso contrario, la enviamos


        const kits = searchReq.cotizacion.kits

        const totalMateriaPrima  = {};

        kits.forEach(kit => {
            const cantidadKit = kit.kitCotizacion.cantidad;

            kit.materia.forEach(mt => {
                const key = `${mt.id}`
                const cantidadTotal = Number(mt.itemKit.medida) * Number(cantidadKit);
                
                if (!totalMateriaPrima[key]) {
                    totalMateriaPrima[key] = {
                        id: mt.id,
                        nombre: mt.description,
                        medidaOriginal: mt.medida,
                        unidad: mt.unidad,
                        cantidad: 0 
                    };
                }

                totalMateriaPrima[key].cantidad += cantidadTotal;
            })

        })

        Object.values(totalMateriaPrima);

        res.status(200).json({
            requisicion: searchReq,
            cantidades: Object.values(totalMateriaPrima)
        });  


    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}


module.exports = { 
    getAllRequisiciones, // Obtener todas las requsiciones
    getRequisicion, // Obtener una requisición
}