const express = require('express');
const { user, permission, user_permission} = require('../db/db');
const { Op } = require('sequelize');
const { addLog } = require('./services/logServices');

// Crear permisos
const addPermission = async(req, res) => {
    try{
        // Recibimos daots por body
        const { name, descripcion } = req.body;
        // Validamos estos valores
        if(!name || !descripcion) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, procedemos a crear

        const permissionCreate = await permission.create({
            name,
            descripcion
        });
        // Validamos permissionCreate
        if(!permissionCreate) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        // Caso contrario, avanzamos...
        res.status(201).json(permissionCreate);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    } 
}

// Dar permisos a un usuario
const givePermissionToUser = async(req, res) => {
    try{
        // Recibimos datos por body
        const { userId, permissionId, state } = req.body;
        // Validamos la entrada de los valores
        if(!userId || !permissionId || !state) return res.status(400).json({msg: 'Parámetros invalidos.'});
        // Caso contrario, comenzamos a validar
        // Buscamos no exista este rango ya.
        const searchPermission = await user_permission.findOne({
            where: {
                userId,
                permissionId
            } 
        })
        // Validamos la respuesta
        if(searchPermission) return res.status(200).json({msg: 'Este rango ya fue asignado.'});
        // Caso contrario, avanzamos
        // Creamos consulta para ingresar registro
        const givePerm = await user_permission.create({
            userId,
            permissionId,
            granted: state
        });
        // Validamos respuesta al crear
        if(!givePerm) return res.status(502).json({msg: 'No hemos logrado asignar este permiso.'});
        // Caso contrario, enviamos JSON
        res.status(201).json(givePerm);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
module.exports = {
    addPermission, // Agregar nuevo permiso
    givePermissionToUser, // Dar permiso a un usuario
}