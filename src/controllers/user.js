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

// OBTENER TODOS LOS USUARIOS
const getUsers = async (req, res) => {
    try {
        const usuarios = await user.findAll({
            attributes: { exclude: ['password'] },
            order: [['createdAt', 'DESC']]
        }).catch(err => {
            console.log(err);
            return null;
        });

        if (!usuarios) return res.status(500).json({ msg: 'Error al obtener los usuarios.' });
        res.status(200).json(usuarios);
    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: 'Ha ocurrido un error al obtener los usuarios.' });
    }
};

// ACTUALIZAR USUARIO
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, lastName, nick, phone, email, photo, age, rango, area } = req.body;

        const usuario = await user.findByPk(id).catch(err => null);
        if (!usuario) return res.status(404).json({ msg: 'Usuario no encontrado.' });

        // Validar que el email o nick no pertenezcan a otro usuario
        if (email && email !== usuario.email) {
            const existe = await user.findOne({ where: { email, id: { [Op.ne]: id } } }).catch(() => null);
            if (existe) return res.status(502).json({ msg: 'Ya existe una cuenta con ese correo.' });
        }
        if (nick && nick !== usuario.nick) {
            const existeNick = await user.findOne({ where: { nick, id: { [Op.ne]: id } } }).catch(() => null);
            if (existeNick) return res.status(502).json({ msg: 'Ya existe una cuenta con ese nick.' });
        }

        await usuario.update({
            name: name || usuario.name,
            lastName: lastName || usuario.lastName,
            nick: nick || usuario.nick,
            phone: phone || usuario.phone,
            email: email || usuario.email,
            photo: photo !== undefined ? photo : usuario.photo,
            age: age || usuario.age,
            rango: rango || usuario.rango,
            area: area || usuario.area,
        });

        // Devolver sin contraseña
        const { password: _, ...usuarioSinPass } = usuario.toJSON();
        res.status(200).json(usuarioSinPass);
    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: 'Ha ocurrido un error al actualizar el usuario.' });
    }
};

// CAMBIAR ESTADO DEL USUARIO (active <-> inactive)
const changeUserState = async (req, res) => {
    try {
        const { id } = req.params;

        const usuario = await user.findByPk(id).catch(err => null);
        if (!usuario) return res.status(404).json({ msg: 'Usuario no encontrado.' });

        const nuevoEstado = usuario.state === 'active' ? 'inactive' : 'active';
        await usuario.update({ state: nuevoEstado });

        const { password: _, ...usuarioSinPass } = usuario.toJSON();
        res.status(200).json({ ...usuarioSinPass, state: nuevoEstado });
    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: 'Ha ocurrido un error al cambiar el estado.' });
    }
};

// ELIMINAR USUARIO
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const usuario = await user.findByPk(id).catch(err => null);
        if (!usuario) return res.status(404).json({ msg: 'Usuario no encontrado.' });

        await usuario.destroy();
        res.status(200).json({ msg: 'Usuario eliminado correctamente.', id });
    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: 'Ha ocurrido un error al eliminar el usuario.' });
    }
};

// CAMBIAR CONTRASEÑA (sin requerir la actual)
const changePassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        if (!password) return res.status(501).json({ msg: 'Se requiere la nueva contraseña.' });
        if (String(password).length < 6) return res.status(400).json({ msg: 'La contraseña debe tener al menos 6 caracteres.' });

        const usuario = await user.findByPk(id).catch(err => null);
        if (!usuario) return res.status(404).json({ msg: 'Usuario no encontrado.' });

        const nuevaPass = bcrypt.hashSync(String(password), Number.parseInt(rounds));
        await usuario.update({ password: nuevaPass });

        res.status(200).json({ msg: 'Contraseña actualizada correctamente.' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: 'Ha ocurrido un error al cambiar la contraseña.' });
    }
};

module.exports = {
    getLogged,       // Ruta de prueba
    signUp,          // Crear usuario
    signIn,          // Iniciar sesión
    isAuthenticated, // Autenticación
    validateEmail,   // Validar email
    getUsers,        // Obtener todos los usuarios
    updateUser,      // Actualizar usuario
    changeUserState, // Cambiar estado activo/inactivo
    deleteUser,      // Eliminar usuario
    changePassword,  // Cambiar contraseña
}