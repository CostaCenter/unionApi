const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('adjunt', { 
        // Valor
        title: {
            type: DataTypes.TEXT 
        },
        adjunt: {
            type: DataTypes.TEXT,
        },
        type: {
            type: DataTypes.STRING
        },
        name: {
            type: DataTypes.STRING
        },
    })  
}
// Esta tabla es la relación directa con todos los precios.
