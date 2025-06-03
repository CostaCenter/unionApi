const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('producto', { 
        // Nombre
        item: { 
            type: DataTypes.STRING 
        },
        description: {
            type: DataTypes.STRING
        },
        peso: {
            type: DataTypes.STRING
        },
        volumen: {
            type: DataTypes.STRING
        },
        procedencia: {
            type: DataTypes.STRING
        },
        criticidad: {
            type: DataTypes.STRING
        },
    }) 
}