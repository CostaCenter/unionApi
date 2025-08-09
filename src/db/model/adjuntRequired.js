const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('adjuntRequired', { 
        // Valor
        mesagge: {
            type: DataTypes.TEXT 
        },
        adjunt: {
            type: DataTypes.TEXT,
        },
        type: {
            type: DataTypes.STRING
        },
    })  
}
// Esta tabla es la relación directa con todos los precios.
