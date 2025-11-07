const express = require('express');
const { proveedor, materia, producto, price, productPrice } = require('../db/db');
const { Op } = require('sequelize');
// CONTROLADORES DEL CLIENTE

// Obtener proveedor 
const getProvider = async(req, res) => {
    try{
        const { providerId } = req.params;
        // Recibimos parámetro por params.
        if(!providerId) return res.status(501).json({msg: 'parámetro no es valido.'});
        // Realizamos la consulta
        const searchProvider = await proveedor.findByPk(providerId ,{
            order:[['createdAt', 'DESC']],
            include:[{
                model: price,
                where: {
                        state: 'active'
                },
                include:[{
                    model: materia, 
                    
                }],
                required: false

            }, {
                model: productPrice,
                where: {
                    state: 'active'
                },
                include:[{
                    model: producto,
                }],
                required: false
            }]
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos respuesta
        if(!searchProvider) return res.status(404).json({msg: 'No hay resultados'});
        // Caso contrario
        res.status(200).json(searchProvider)
    }catch(err){
        console.log(err)
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    };
}

// Buscar proveedores
const searchProveeresQuery = async(req, res) => {
    try {
        const { query } = req.query; // Obtiene el parámetro de búsqueda desde la URL

        if (!query) {
            return res.status(400).json({ message: "Debes proporcionar un término de búsqueda." });
        }

        const clientes = await proveedor.findAll({
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

// Obtener todos los proveedores
const getAllProveedores = async (req, res) => {
    try{
        // Realizamos la consulta
        const searchProvider = await proveedor.findAll({
            order:[['createdAt', 'DESC']]
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos respuesta
        if(!searchProvider) return res.status(404).json({msg: 'No hay resultados'});
        // Caso contrario
        res.status(200).json(searchProvider)
    }catch(err){
        console.log(err)
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    };
}
// Crear proveedor
const addProveedor = async (req, res) => {
    try{
        // Recibimos datos por body
        const { type, nit, persona, email, img, nombre, siglas, direccion, ciudad, departamento, pais, fijo, phone } = req.body;
        
        // Validamos que los parámetros importantes, se ingresen correctamente.
        if(!type || !nit || !persona || !email || !nombre  || !direccion || !ciudad || !departamento || !pais || !phone) return res.status(501).json({msg: 'Parámetros no son validos'});
        //Caso contrario, avanzamos...

        // Validamos si ya existe un usuario con ese NIT
        const searchProveedor = await proveedor.findOne({
            where: {
                nit
            }
        }).catch(err => {
            console.log(err);
            return null
        });
        // Si hay un registro, envia respuesta.
        if(searchProveedor) return res.status(200).json({msg: 'Este proveedor ya hace parte del sistema.'});
        // Caso contrario, procedemos a crear el proveedor
        const createProveedor = await proveedor.create({
            type,
            nit,
            persona,
            email,
            img,
            nombre,
            siglas,
            direccion,
            ciudad,
            departamento,
            pais,
            fijo,
            phone,
            state: 'active'
        }).catch(err => {
            console.log(err);
            return null;
        }); 

        if(!createProveedor) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        // Caso contrario, avanzamos
        res.status(201).json(createProveedor);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Actualizar proveedor
const updateProveedor = async (req, res) => {
    try{
        // Recibimos datos por body
        const { proveedorId, type, nit, img, email, nombre, siglas, direccion, ciudad, departamento, pais, fijo, phone} = req.body;
        // Validamos que entre el parámetro
        if(!proveedorId) return res.status(501).json({msg: 'Parámetro invalido.'});
        
        // Caso contrario, avanzamos
        // Buscamos el proveedor
        const searchProveedor = await proveedor.findByPk(proveedorId).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos que exista un registro
        if(!searchProveedor) return res.status(404).json({msg: 'No hemos encontrado este proveedor.'});
        //  Caso contrario, actualizamos los datos
        const updateP = await proveedor.update({
            type,
            nit,
            img,
            nombre,
            siglas,
            direccion,
            ciudad,
            departamento,
            pais,
            fijo,
            email,
            phone
        },{
            where: {
                id: proveedorId
            }
        })
        .catch(err => {
            console.log(err);
            return null;
        });

        if(!updateP) return res.status(502).json({msg: 'No hemos logrado actualizar este proveedor'});
        //  Caso contrario, devolvemos respuesa
        res.status(200).json({msg: 'Actualizado con éxito'});
    
    }catch(err){
        console.log(err);
        return res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Cambiar el estado del proveedor
const changeStateProveedor = async (req, res) => {
    try{
        // Recibimos datos por body
        const { proveedorId, state } = req.body;
        // Validamos que entre el parámetro
        if(!proveedorId) return res.status(501).json({msg: 'Parámetro invalido.'});
        
        // Caso contrario, avanzamos
        // Buscamos el proveedor
        const searchProveedor = await proveedor.findByPk(proveedorId).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos que exista un registro
        if(!searchProveedor) return res.status(404).json({msg: 'No hemos encontrado este proveedor.'});
        //  Caso contrario, actualizamos los datos
        const updateP = await proveedor.update({
            state
        },{
            where: {
                id: proveedorId
            }
        })
        .catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta.
        if(!updateP) return res.status(502).json({msg: 'No hemos logrado cambiar el estado de este proveedor.'});
        //  Caso contrario, devolvemos respuesa
        res.status(200).json({msg: 'Actualizado con éxito'});
    }catch(err){
        console.log(err);
        return res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

module.exports = {
    getProvider, // Un proveedor por ID
    addProveedor, // Agregar nuevo proveedor
    updateProveedor, // Actualizar datos del proveedor
    changeStateProveedor, // Cambiar el estado del proveedor 
    getAllProveedores, // Obtener proveedores
    searchProveeresQuery, // GET QUERY PROVEEDOR
}