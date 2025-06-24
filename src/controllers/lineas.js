const express = require('express');
const { linea, categoria, extension, percentage} = require('../db/db');
const { Op } = require('sequelize');
const { addLog } = require('./services/logServices');

// Controladores para lineas, categorías y extensiones

// GET ALL
const getAllFiltros = async(req, res) => {
    try{
        const searchLineas = await linea.findAll({
            order:[['name', 'ASC']]
        }).catch(err => null);
        const searchCategoria = await categoria.findAll({
            order:[['name', 'ASC']]
        }).catch(err => null);
        const searchExtension = await extension.findAll().catch(err => null);

        const filtros = {
            lineas: searchLineas,
            categorias: searchCategoria,
            extensiones: searchExtension,
        }
        res.status(200).json(filtros)

    }catch(err){
        console.log(err);
    }
}
// Crear metódo de linea
const addLinea = async (req, res) => {
    try{
        // Recibimos los datos por body
        const { code, name, type, description} = req.body;
        // Validamos que los parámetros entren correctamente
        if(!code || !name ) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, validamos si ya existe

        const searchBusqueda = await linea.findOne({
            where: {
                code
            }
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta
        if(searchBusqueda) return res.status(200).json({msg: 'Ya existe este metódo de busqueda.'});
        
        // Caso contrario, procedemos a crearlo.
        const addMethod = await linea.create({
            code,
            name,
            description,
            type,
            state: 'active'
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos respuesta.
        if(!addMethod) return res.status(502).json({msg: 'Lo sentimos, no hemos logrado crear este metódo de busqueda'});
        // Caso contrario, enviamos respuesta
        res.status(201).json(addMethod);
    }catch(err){
        console.log(err);
        return res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Actualizar linea
const updateLinea = async (req, res) => {
    try{
        // Recibimos datos por body
        const { lineaId, code, name, description, type } = req.body;
        // Validamos que el identificador entre.
        if(!lineaId) return res.status(501).json({msg: 'Parámetro invalido'});
        // Caso contrario, avanzamos...

        // Buscamos que ese metódo de linea exista
        const searchLinea = await linea.findByPk(lineaId).catch(err => {
            console.log(err);
            return null;
        });

        // Validamos la respuesta
        if(!searchLinea) return res.status(404).json({msg: 'Lo sentimos, no hemos encontrado esta linea.'});
 
        // Caso contrario, procedemos a actualizar.
        const updateLine = await linea.update({
            code,
            name, 
            description,
            type
        }, {
            where: {
                id: lineaId
            }
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta.
        if(!updateLine) return res.status(502).json({msg: 'Lo sentimos, no hemos logrado actualizar esta linea.'});
        // Caso contrario, enviamos respuestas positiva
        res.status(200).json({msg: 'Linea actualizada con éxito'});

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}
// Cambiar estado de una  linea
const lineaState = async (req, res) => {
    try{
        // Recibimos datos por body
        const { lineaId, state } = req.body;
        // Validamos que el identificador y el estado entren.
        if(!lineaId || !state) return res.status(501).json({msg: 'Parámetros invalidos'});
        // Caso contrario, avanzamos...

        // Buscamos que ese metódo de linea exista
        const searchLinea = await linea.findByPk(lineaId).catch(err => {
            console.log(err);
            return null;
        });

        // Validamos la respuesta
        if(!searchLinea) return res.status(404).json({msg: 'Lo sentimos, no hemos encontrado esta linea.'});
        // Caso contrario, procedemos a actualizar.

        const updateLine = await linea.update({
            state
        }, {
            where: {
                id: lineaId
            }
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta.
        if(!updateLine) return res.status(502).json({msg: 'Lo sentimos, no hemos logrado actualizar esta linea.'});
        // Caso contrario, enviamos respuestas positiva
        res.status(200).json({msg: 'Linea actualizada con éxito'});

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

 

// Categorías

// Crear metódo de Categoría
const addCategoria = async (req, res) => {
    try{
        // Recibimos los datos por body
        const { code, name,  description, type } = req.body;
        // Validamos que los parámetros entren correctamente
        if(!code || !name) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, validamos si ya existe

        const searchBusqueda = await categoria.findOne({
            where: {
                code
            }
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta
        if(searchBusqueda) return res.status(200).json({msg: 'Ya existe este metódo de busqueda.'});
        
        // Caso contrario, procedemos a crearlo.
        const addMethod = await categoria.create({
            code,
            name,
            description,
            type,
            state: 'active'
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos respuesta.
        if(!addMethod) return res.status(502).json({msg: 'Lo sentimos, no hemos logrado crear este metódo de busqueda'});
        // Caso contrario, enviamos respuesta
        res.status(201).json(addMethod);
    }catch(err){
        console.log(err);
        return res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Actualizar linea
const updateCategoria = async (req, res) => {
    try{
        // Recibimos datos por body
        const { categoriaId, code, name, description, type } = req.body;
        // Validamos que el identificador entre.
        if(!categoriaId) return res.status(501).json({msg: 'Parámetro invalido'});
        // Caso contrario, avanzamos...

        // Buscamos que ese metódo de linea exista
        const searchCategoria = await categoria.findByPk(categoriaId).catch(err => {
            console.log(err);
            return null;
        });

        // Validamos la respuesta
        if(!searchCategoria) return res.status(404).json({msg: 'Lo sentimos, no hemos encontrado esta categoría.'});
 
        // Caso contrario, procedemos a actualizar.
        const updateCategory = await categoria.update({
            code,
            name, 
            description,
            type
        }, {
            where: {
                id: categoriaId
            }
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta.
        if(!updateCategory) return res.status(502).json({msg: 'Lo sentimos, no hemos logrado actualizar esta categoría.'});
        // Caso contrario, enviamos respuestas positiva
        res.status(200).json({msg: 'Categoría actualizada con éxito'});

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}
// Cambiar estado de una  linea
const categoriaState = async (req, res) => {
    try{
        // Recibimos datos por body
        const { categoriaId, state } = req.body;
        // Validamos que el identificador y el estado entren.
        if(!categoriaId || !state) return res.status(501).json({msg: 'Parámetros invalidos'});
        // Caso contrario, avanzamos...

        // Buscamos que ese metódo de Categoría exista
        const searchCategoria = await categoria.findByPk(categoriaId).catch(err => {
            console.log(err);
            return null;
        });

        // Validamos la respuesta
        if(!searchCategoria) return res.status(404).json({msg: 'Lo sentimos, no hemos encontrado esta categoría.'});
        // Caso contrario, procedemos a actualizar.

        const updateCategory = await categoria.update({
            state
        }, {
            where: {
                id: categoriaId
            }
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta.
        if(!updateCategory) return res.status(502).json({msg: 'Lo sentimos, no hemos logrado actualizar esta categoría.'});
        // Caso contrario, enviamos respuestas positiva
        res.status(200).json({msg: 'Categoría actualizada con éxito'});

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Extensiones
// Crear metódo de Extemsión
const addExtension = async (req, res) => {
    try{
        // Recibimos los datos por body
        const { code, name,  description } = req.body;
        // Validamos que los parámetros entren correctamente
        if(!code || !name ) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, validamos si ya existe

        const searchBusqueda = await extension.findOne({
            where: {
                code
            }
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta
        if(searchBusqueda) return res.status(200).json({msg: 'Ya existe este metódo de busqueda.'});
        
        // Caso contrario, procedemos a crearlo.
        const addMethod = await extension.create({
            code,
            name,
            description,
            state: 'active'
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos respuesta.
        if(!addMethod) return res.status(502).json({msg: 'Lo sentimos, no hemos logrado crear este metódo de busqueda'});
        // Caso contrario, enviamos respuesta
        res.status(201).json(addMethod);
    }catch(err){
        console.log(err);
        return res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Actualizar Extensión
const updateExtension = async (req, res) => {
    try{
        // Recibimos datos por body
        const { extensionId, code, name, description } = req.body;
        // Validamos que el identificador entre.
        if(!extensionId) return res.status(501).json({msg: 'Parámetro invalido'});
        // Caso contrario, avanzamos...

        // Buscamos que ese metódo de extensión exista
        const searchExtension = await extension.findByPk(extensionId).catch(err => {
            console.log(err);
            return null;
        });

        // Validamos la respuesta
        if(!searchExtension) return res.status(404).json({msg: 'Lo sentimos, no hemos encontrado esta Extensión.'});
 
        // Caso contrario, procedemos a actualizar.
        const updateExtension = await extension.update({
            code,
            name, 
            description,
        }, {
            where: {
                id: extensionId
            }
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta.
        if(!updateExtension) return res.status(502).json({msg: 'Lo sentimos, no hemos logrado actualizar esta Extensión.'});
        // Caso contrario, enviamos respuestas positiva
        res.status(200).json({msg: 'Extensión actualizada con éxito'});

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Cambiar estado de una  linea
const extensionState = async (req, res) => {
    try{
        // Recibimos datos por body
        const { extensionId, state } = req.body;
        // Validamos que el identificador y el estado entren.
        if(!extensionId || !state) return res.status(501).json({msg: 'Parámetros invalidos'});
        // Caso contrario, avanzamos...

        // Buscamos que ese metódo de Extensión exista
        const searchExtension = await categoria.findByPk(extensionId).catch(err => {
            console.log(err);
            return null;
        });

        // Validamos la respuesta
        if(!searchExtension) return res.status(404).json({msg: 'Lo sentimos, no hemos encontrado esta extensión.'});
        // Caso contrario, procedemos a actualizar.

        const updateExtensionVar = await extension.update({
            state
        }, {
            where: {
                id: extensionId
            }
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta.
        if(!updateExtensionVar) return res.status(502).json({msg: 'Lo sentimos, no hemos logrado actualizar esta Extensión.'});
        // Caso contrario, enviamos respuestas positiva
        res.status(200).json({msg: 'Extensión actualizada con éxito'});

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Dar porcentaje a una linea
const givePercentage = async (req, res) => {
    try{
        // Recibimos datos por body
        const { lineaId, final, distribuidor, userId} = req.body;
        // Validamos la entrada de los valores
        if(!lineaId || !final || !distribuidor) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, comenzamos
        // Consultamos que no exista otra registro con esos datos
        const searchPercentage = await percentage.findOne({
            where: {
                final,
                distribuidor,
                lineaId,
                state :'active'
            }
        });

        if(searchPercentage) return res.status(200).json({msg: 'Estos porcentajes ya estan considerados.'});
        // Caso contrario, avanzamos
        // Solicitamos la creación

        const update = await percentage.update({
            state: 'inactive'
        }, {
            where: {
                lineaId
            }
        })
        const createPercentageForLinea = await percentage.create({
            final,
            distribuidor,
            lineaId,
            state: 'active' 
        }).then(async res => {
            const a = await addLog('lineas', lineaId, 'create', 'Actualizó porcentajes', userId, res.id)
            return res
        }) 
        // Validamos la respuesta.
        if(!createPercentageForLinea) return res.status(502).json({msg: 'No hemos logrado crear esto'});
        // Caso contrario, enviamos respuesta
        res.status(201).json(createPercentageForLinea);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
    
}

// Obtenemos todas las lineas con sus porcentajes
const getAllLineasWithPercentage = async(req, res) => {
    try{    
        // Recibimos toda la consulta por url
        // Procedemos a consultar todas las lineas, donde el porcentaje este activo.
        const searchAllLineas = await linea.findAll({
            where: {
                type: 'comercial'
            },
            include:[{
                model: percentage,
                where: {
                    state:'active'
                },
                required: false
            }]
        });
        // Validamos
        if(!searchAllLineas) return res.status(404).json({msg: 'No hay lineas'});
        // Caso contrario, enviamos respuestas.
        res.status(200).json(searchAllLineas);
        
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

module.exports = {
    // LINEA
    addLinea, // Agregar nueva linea
    updateLinea, // Actualizar una linea.
    lineaState, // Actualizar estado de una linea
    
    // CATEGORÍAS 
    addCategoria, // Agregar nueva categoría 
    updateCategoria, // Actualizar una categoría
    categoriaState, // Actualizar estado de una categoría
    
    // Extensión
    addExtension, // Agregar nueva extensión
    updateExtension, // Actualizar Extensión
    extensionState, // Actualizar estado de una extensión

    getAllFiltros, // Obtenemos todos los filtros
    givePercentage, // Damos un porcentaje a la linea.
    getAllLineasWithPercentage, // Obtenemos todas las lineas con porcentajes
}