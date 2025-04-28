const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('proveedor', { 
        // Nombre
        type: {
            type: DataTypes.STRING
        },
        persona: {
            type: DataTypes.STRING
        },
        // NIT
        nit:{
            type: DataTypes.STRING
        },
        // Imagen de perfil
        img:{
            type: DataTypes.STRING
        },
        // Razón social 
        nombre:{
            type: DataTypes.STRING
        },
        // Siglas
        siglas: {
            type: DataTypes.STRING
        },
        // Email
        email:{
            type: DataTypes.STRING
        },
        // Dirección
        direccion:{
            type: DataTypes.STRING
        },
        // Ciudad
        ciudad:{
            type: DataTypes.STRING
        },
        // Departamento
        departamento:{
            type: DataTypes.STRING
        },
        // pais
        pais:{
            type: DataTypes.STRING
        },
        // Departamento
        fijo:{
            type: DataTypes.STRING
        },
        // ¨hone
         phone:{
            type: DataTypes.STRING
        },
        // Estado... Activo o innactivo
        state: {
            type: DataTypes.STRING
        }, 

    }) 
}