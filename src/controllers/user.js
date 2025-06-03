const express = require('express');
const { user, permission } = require('../db/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const rounds = process.env.AUTH_ROUNDS || 10;
const secrete = process.env.AUTH_SECRET || 'WithGod';
const expires = process.env.AUTH_EXPIRES || "30d";
const authConfig = require('../../config/auth'); 
const dayjs = require('dayjs');
const { validateEmailService } = require('./services/userServices');
// CONTROLADORES DEL CLIENTE

// Enlace básico
const getLogged = async (req, res) => {
    try{
        res.status(200).json({user: req.user})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// AUTENTICAR EL TOKEN
const isAuthenticated = async (req,res, next)=>{
    const token = req.headers.authorization.split(' ')[1];
    if(!token){
        console.log('logueate, por favor');
        return next('Please login to access the data');
    }
    try {
        const verify = jwt.verify(token,authConfig.secret);
        req.user = verify;
        console.log('Lo hace con éxito') 
        next();
    } catch (error) {
        console.log('intenta pero falla');
        return next(error);  
    }
}
const signIn = async(req, res) => {
    try{ 
        // Recibimos datos por body
        const { phone, password} = req.body;
    
        const usuario = await user.findOne({
            where: {
                email:phone
            },
            include:[{
                model: permission,
                as: 'permissions'
            }] 
 
        }).catch(err => {
            console.log(err);
            return null;
        });
        if(!usuario) {
            console.log('No hemos encontrado este usuario.');
            return res.status(404).json({msg: 'Usuario no encontrado'});
        }
    
        if(bcrypt.compareSync(password, usuario.password)){
            let token = jwt.sign({user: usuario}, authConfig.secret, {
                expiresIn: authConfig.expires
            });
            res.status(200).header('auth_token').json({
                error: null,
                data: token
            })
        }else{
            // No autoriza el acceso.
            console.log('error aca');
            res.status(401).json({msg: 'La contraseña no es valida.'});
        }
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// CREAR USUARIO
const signUp = async (req, res) => {
    try{
        // Recibo toda la informacion por body
        const { name, lastName, nick, phone, email, password, photo, age, area, rango} = req.body; 
        // Validamos que entren los datos necesarios
        if(!name ) return res.status(501).json({msg: 'Parametros no validos.'});
        
        const passwordy = String(password); // Pasamos la contraseña a STRING
        let pass = bcrypt.hashSync(passwordy, Number.parseInt(rounds)); // Finalizamos Hasheo

        // Validamos que no exista un correo igual
        const searchEmail = await user.findOne({ 
            where: {
                email,
            }
        }).catch(err => null);

        if(searchEmail) return res.status(502).json({msg: 'Ya existe una cuenta con este email o teléfono'});

        const searchPhone = await user.findOne({
            where: {
                phone,
            }
        }).catch(err => null);
        if(searchPhone) return res.status(502).json({msg: 'Ya existe una cuenta con este email o teléfono'});



        // caso contrario, creamos el cliente.
        const createUsuario = await user.create({
            name,
            lastName,
            nick,
            phone,
            email,
            password: pass,
            photo,
            age,
            rango,
            area,
            state: 'active'
        }).catch(err => {
            console.log(err);
            return null;
        });

        if(!createUsuario) return res.status(502).json({msg: 'No hemos podido crear este cliente.'});
        // Caso contrario, enviamos respuesta.
        res.status(201).json(createUsuario);

    }catch(err ){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'})
    }
}
 
// Validamos Email
const validateEmail = async(req, res) => {
    try{
        // Recibimos dato por body
        const { email } = req.body;
        if(!email) return res.status(501).json({msg: 'No hemos recibido el parámetro'});
        // Caso contrario, enviamos consulta.
        
        const sendValitario = await validateEmailService(email).catch(err => null);
        if(!sendValitario || sendValitario == 404) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        // Caso contrario, enviamos respuesta.
        res.status(200).json(sendValitario);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
 

module.exports = {
    getLogged, // Ruta de prueba
    signUp, // Crear usuario
    signIn, // Iniciar sesión
    isAuthenticated, // Autenticación
    validateEmail, // Validar
}