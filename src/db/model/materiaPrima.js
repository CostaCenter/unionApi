const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('materia', { 
        // Nombre
        item: {
            type: DataTypes.STRING 
        },
        description: {
            type: DataTypes.STRING
        },
        medida: {
            type: DataTypes.STRING
        },
        unidad: {
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
        calibre: {
            type: DataTypes.INTEGER
        }
    }) 
}