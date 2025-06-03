const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('productPrice', { 
        // Nombre
        valor: {
            type: DataTypes.STRING 
        },
        iva: {
            type: DataTypes.STRING
        },
        descuentos: {
            type: DataTypes.STRING
        },
        state: {
            type: DataTypes.STRING
        } 
    })  
}