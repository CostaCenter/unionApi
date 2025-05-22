const express = require('express');
const { client, armado, kit, materia, price, cotizacion, kitCotizacion } = require('../db/db');
const { Op } = require('sequelize');
const { createCotizacion, addItemToCotizacionServices } = require('./services/cotizacionServices');
const { createRequisicion } = require('./services/requsicionService');
const dayjs = require('dayjs');
const { addItemToArmado } = require('./services/armadoServices');
const multer = require('multer');

const cloudinary = require('cloudinary').v2;
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Buscamos kits por Query
const searchSuperKitsQuery = async(req, res) => {
    try {
        const { query } = req.query; // Obtiene el parámetro de búsqueda desde la URL

        if (!query) {
            return res.status(400).json({ message: "Debes proporcionar un término de búsqueda." });
        }

        const superKits = await armado.findAll({
            where: {
                [Op.or]: [
                    { name: { [Op.iLike]: `%${query}%` } }, // Búsqueda flexible (ignora mayúsculas/minúsculas)
                ],
                state: 'active'
            },
            include:[{
                model: kit,
                include:[{
                    model: materia,
                    attributes: { exclude : ['peso', 'volumen', 'procedencia', 'criticidad', 'createdAt', 'updatedAt']},
                    include:[{
                        model: price,
                        state: 'active',
                        attributes: { exclude: ['iva', 'descuentos', 'createdAt', 'updatedAt']}
                    }]
                }]
            }],
            attributes: { exclude: ['createdAt', 'updatedAt'] },
            limit: 10, // Máximo 10 resultados para eficiencia
        }).catch((err => {
            console.log(err);
            return null;
        }));

        if(!superKits) return res.status(404).json({msg: 'No encontrado'})

        res.status(200).json(superKits);
    } catch (error) {
        console.error("Error al buscar productos:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
}

// Obtenemos un elemento para visualizarlo
const getSuperKit = async (req, res) => {
    try{
        // Recibimos referencia por params
        const { superKit } = req.params;
        // Validamos que entre el parámetro
        if(!superKit) return res.status(501).json({msg: 'Parámetro invalido'});
        // Caso contrario, avanzamos
        const searchSpKit = await armado.findByPk(superKit, {
            include: [{
                model: kit
            }] 
        }).catch(err => {
            // Pasamos por consola el error
            console.log(err);
            return null;
        });
        // Validamos respuesta
        if(!searchSpKit) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        // Caso contrario, avanzamos
        res.status(200).json(searchSpKit)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Creamos consulta para obtener los los armados activos
const getAll = async (req, res) => {
    try{
        // Generamos una consulta
        const searchAll = await armado.findAll({
            where: {
                state: 'active'
            },
            include:[{
                model: kit
            }]
        }).catch(err => {
            console.log(err);
            return null;
        });
 
        // Verificamos
        if(!searchAll) return res.status(404).json({msg: 'No hemos encontrado ningún elemento.'});
        // Caso contrario, avanzamos
        res.status(200).json(searchAll);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
 
// Crear elemento
const newArmado = async (req, res) => {
    try{ 
        // Recibimos variables por body
        const { name, description, show } = req.body;
        // Validamos la entrada
        if(!name || !description  ) return res.status(501).json({msg: 'Los parámetros ingresado no son validos.'});
        // Caso contrario, avanzamos...
        if(!req.file) return res.status(400).json({msg: 'No se ha subido ninguna imagen'})
         
        const result = await cloudinary.uploader.upload(
            `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`, // Usando el buffer de memoryStorage
            { folder: 'galeriaUnion' } // Opcional: especificar una carpeta
        )
 
        // Creamos consulta para avanzar
        const addNew = await armado.create({
            name,
            description,
            img: result.secure_url,
            show, 
            state: 'active'
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Si no obtenemos respuesta. Enviamos mistake
        if(!addNew) return res.status(502).json({msg: 'No hemos logrado crear esto, intentalo más tarde'});

        // Caso contrario, avanzamos
        res.status(201).json(addNew);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Agregar items al armado
// Agregamos item al Armado
const addItemArmado = async (req, res) => {
    try{
        // Recibimos datos por body
        const { armadoId, kitId, cantidad} = req.body;

        //Validamos que entren correctamente.
        if(!armadoId || !kitId || !cantidad ) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        
        // Caso contrario, avanzamos...

        const addChoosed = await addItemToArmado(armadoId, kitId, cantidad)
        .then(res => res)
        .catch(err => {
            console.log(err); 
            return null
        });
        if(addChoosed == 500) return res.status(500).json({msg: 'Falló la función.'});
        if(addChoosed == 502) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        if(addChoosed == 404) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        if(addChoosed == 200) return res.status(404).json({msg: 'Este kit ya hace parte del componente'});
        
        res.status(201).json(addChoosed)

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}




module.exports = { 
    searchSuperKitsQuery, // Buscamos por query
    getSuperKit, // Obtenemos un elemento
    getAll, // Obtenemos todo los superkits
    newArmado, // Creamos nuevo superKit
    addItemArmado, // agregar kit a Superkit
}  