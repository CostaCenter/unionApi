const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('client', { 
        // Tipo
        type: {
            type: DataTypes.STRING 
        },
        nit: {
            type: DataTypes.STRING 
        },
        photo: {
            type: DataTypes.STRING
        },
        nombre: {
            type: DataTypes.STRING 
        },
        siglas: {
            type: DataTypes.STRING 
        },
        direccion: {
            type: DataTypes.STRING 
        },
        ciudad: {
            type: DataTypes.STRING 
        },
        departamento: {
            type: DataTypes.STRING 
        },
        pais: {
            type: DataTypes.STRING 
        },
        fijos: {
            type: DataTypes.ARRAY(DataTypes.STRING) 
        },
        phone: {
            type: DataTypes.STRING 
        },
        email: {
            type: DataTypes.STRING 
        }
 
    })  
} 