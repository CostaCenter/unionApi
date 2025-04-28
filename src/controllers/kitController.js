const express = require('express');
const { materia, proveedor, extension, price, kit, itemKit, linea, categoria } = require('../db/db');
const { Op } = require('sequelize');
const { searchPrice, addPriceMt, updatePriceState,  } = require('./services/priceServices');
const { searchKit, createKitServices, addItemToKit, deleteDeleteItemOnKit, changeState } = require('./services/kitServices');

// Obtener todos los kikts Terminados
const getAllKitCompleted = async(req, res) => {
    try{
        // Buscamos todos los elementos dentro de la base de datos
        const searchAll = await kit.findAll({
            where: {
                state: 'completa'
            },
            include:[{
                model: materia,
                attributes: { exclude: ['createdAt', 'updatedAt'] },
                include:[{
                    model: price,
                    where: {
                        state: 'active'
                    }, 
                    attributes: { exclude: ['createdAt', 'updatedAt'] },

                }]
            },{
                model: categoria
            },
            {
                model: linea
            },{
                model: extension
            }] 
        }).catch(err => {
            console.log(err)
            return null
        });

        if(!searchAll) return res.status(404).json({msg: 'No hemos encontrado esto'});

        // caso contrario, enviamos resultados
        res.status(200).json(searchAll)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'})
    }
}

// Obtener todos los kikts
const getAllKit = async(req, res) => {
    try{
        // Buscamos todos los elementos dentro de la base de datos
        const searchAll = await kit.findAll({
            include:[{
                model:materia,
                attributes:['id', 'item', 'description', 'medida', 'unidad'],
                include:[{
                    model: price,
                    where: {
                        state: 'active'
                    },
                    attributes: ['id', 'valor', 'iva', 'descuentos', 'state']
                }]
            },{ 
                model: categoria
            },
            {
                model: linea
            },{
                model: extension
            }] ,
            order:[['createdAt', 'DESC']]
        }).catch(err => {
            console.log(err)
            return null
        });

        if(!searchAll) return res.status(404).json({msg: 'No hemos encontrado esto'});

        // caso contrario, enviamos resultados
        res.status(200).json(searchAll)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'})
    }
}
// Obtenemos un Kit con precios
const getKit = async(req, res) => {
    try{
        // Recibimos body
        const { kitId } = req.params;
        if(!kitId) return res.status(404).json({msg: 'Parámetro no es valido.'});
        
        // Caso contrario, avanzamos
        const searchKit = await kit.findOne({
            where: {
                id: kitId
            },
            include:[{
                model:materia,
                attributes:['id', 'item', 'description', 'medida', 'unidad'],
                include:[{
                    model: price,
                    where: {
                        state: 'active'
                    },
                    attributes: ['id', 'valor', 'iva', 'descuentos', 'state']
                }]
            }]
        }).catch(err => {
            console.log(err);
            return null;
        });

        if(!searchKit) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        // Caso contrario, avanzamos
        res.status(201).json(searchKit);
    
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Creamos un kit

const addKit = async (req, res) => {
    try{
        // Recibimos datos por body
        const { code, nombre, description, extension, linea, categoria } = req.body;
        // Validamos que los datos entren correctamente
        if(!nombre || !extension) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos...
 
        // Validamos que no exista un kit con todos las condiciones
        const searchK = await searchKit(nombre, extension).catch(err => null);

        if(searchK == 404){
            const addKit = await createKitServices(code, nombre, description, extension, linea, categoria)
            .catch(err => {
                console.log(err);
                return null;
            })
            if(addKit == 502) return res.status(500).json({msg: 'No hemos logrado crear este kit'})
            return res.status(201).json(addKit); 


        }else if(searchK == 200){
            return res.status(200).json({msg: 'Ya existe este kit.'});
        }else{
            return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        }
    }catch(err){
        console.log(err);
        return res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Agregamos item al Kit
const addItem = async (req, res) => {
    try{
        // Recibimos datos por body
        const { mtId, kitId, cantidad, medida, calibre} = req.body;

        //Validamos que entren correctamente.
        if(!mtId || !kitId || !cantidad || !medida) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        
        // Caso contrario, avanzamos...

        const addChoosed = await addItemToKit(mtId, kitId, cantidad, medida, calibre)
        .then(async res => {
            const updateKit = await changeState(kitId, 'desarrollo')
            return res
        }) 
        .catch(err => {
            console.log(err); 
            return null
        });
        if(addChoosed == 500) return res.status(500).json({msg: 'Falló la función.'});
        if(addChoosed == 502) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        if(addChoosed == 404) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        if(addChoosed == 200) return res.status(404).json({msg: 'Este item ya hace parte del kit'});
        
        res.status(201).json(addChoosed)

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

const deleteItemOnKit = async(req, res) => {
    try{
        // Recibo dos varaibles por body
        const { kitId, itemId } = req.body;
        // Validamos
        if(!kitId || !itemId) return res.status(501).json({msg: 'Los parámetros no son validos'});
        
        // Caso contrario, avanzamos...
        const sendToDelete = await deleteDeleteItemOnKit(kitId, itemId)
        .then(async res => {
            const updateKit = await changeState(kitId, 'desarrollo')
            return res
        })
        .catch(err => null);

        if(sendToDelete == 502) return res.status(502).json({msg: 'No hemos logrado eliminar esto.'});
        // Caso contrario.
        res.status(200).json({msg: 'Eliminado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

const changeStateToKit = async(req, res) => {
    try{
        // Recibo parámetros por body
        const { kitId, state } = req.body;
        if(!kitId || !state) return res.status(501).json({msg: 'Los parámetros no son validos'});
        // Caso contrario

        const sendPeti = await changeState(kitId, state).catch(err => null);
        if(!sendPeti) return res.status(502).json({msg: 'No hemos logrado actualizar esto'});
        // caso contrario, actualizado con exito.
        res.status(200).json({msg: 'Actualizado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'})
    }
}
module.exports = { 
    addKit, // Agregamos KIT.
    addItem, // Agregar Item
    getKit, // Obtenemos el KIT
    deleteItemOnKit, // Eliminar item del kit
    getAllKit, // Obtenemos todos los kits
    changeStateToKit, // Actualizar estado del kit
    getAllKitCompleted, // Obtener solo kits completos
}