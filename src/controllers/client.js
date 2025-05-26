const express = require('express');
const { client } = require('../db/db');
const { Op } = require('sequelize');

const getAllClient = async(req, res) => {
    try{
        // Enviamos petición para crear clientes
        const searchAll = await client.findAll({
            order:[["createdAt", 'DESC']]
        })
        // Validamos que existan registros
        // En caso de que no, reportamos con estado 404
        if(!searchAll) return res.status(404).json({msg: 'No hemos encontrado resultados.'});
        // Caso contrario, enviamos la respuesta
        // Con estado 200
        res.status(200).json(searchAll);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Creamos un nuevo cliente
const newClient = async(req, res) => {
    try{
        // Recibimos datos del cliente por body
        const { type, nit, photo, nombre, siglas, direccion, ciudad, departamento, pais, fijos, phone, email } = req.body;
    
        // Validamos que los datos entren correctamente
        if(!type || !nit || !nombre || !direccion || !ciudad || !departamento || !phone ) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, validamos si ya existe este registro en la base de datos
         
        const searchClient = await client.findOne({
            where: {
                nit
            }
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Si hay registro, enviamos la respuesta de que ese cliente ya existe
        if(searchClient) return res.status(200).json({msg: 'Este cliente ya existe'})
        // Caso contrario, comenzamos con la creación de cliente
        
        const createClient = await client.create({
            type,
            nit,
            photo,
            nombre,
            siglas,
            direccion,
            ciudad,
            departamento,
            pais,
            fijos,
            phone,
            email
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Si no obtenemos respuesta, enviamos error 502!
        if(!createClient) return res.status(502).json({msg: 'No hemos logrado crear esto, intentalo más tarde'})
        // Caso contrario, enviamos respuesta del cliente creado 201. Succesfull!
        res.status(201).json(createClient)
    
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Actualizamos cliente
const updateClientFunction = async(req, res) => {
    try{
        // Recibimos datos por body
        const { clientId, type, nit, photo, nombre, siglas, direccion, ciudad, departamento, pais, fijos, phone, email } = req.body;
        if(!clientId) return res.status(501).json({msg: 'Este parámetro no es valido'});

        // Caso contrario, avanzamos
        const searchClient = await client.findByPk(clientId).catch(err => null);

        // Si hay registro, enviamos la respuesta de que ese cliente ya existe
        if(!searchClient) return res.status(404).json({msg: 'No hemos encontrado este cliente'})
        // Caso contrario, comenzamos con la creación de cliente
        
        const updateClient = await client.update({
            type,
            nit,
            photo,
            nombre,
            siglas,
            direccion, 
            ciudad,
            departamento,
            pais,
            fijos,
            phone,
            email
        }, { 
            where: {
                id: clientId
            }
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Si no obtenemos respuesta, enviamos error 502!
        if(!updateClient) return res.status(502).json({msg: 'No hemos logrado crear esto, intentalo más tarde'})
        // Caso contrario, enviamos respuesta del cliente creado 201. Succesfull!
        res.status(200).json({msg: 'Cliente actualizado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}



module.exports = { 
    newClient, // Creamos un nuevo cliente
    updateClientFunction, // Actualizamos cliente
    getAllClient, // Obtenemos todos los clientes
}