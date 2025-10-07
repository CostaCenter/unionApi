const { DataTypes } = require('sequelize');
// Cotización compras - NECESITAMOS ESTO
module.exports = sequelize => {
    sequelize.define('cotizacion', { 
        // Nombre
        name: {
            type: DataTypes.STRING 
        },
        description: {
            type: DataTypes.TEXT 
        },
        fecha: {
            type: DataTypes.DATE
        },
        price: {
            type: DataTypes.STRING
        },
        descuento: {
            type: DataTypes.STRING
        },
        iva: {
            type: DataTypes.STRING
        },
        // Aprobada , Espera , Perdida
        state: {
            type: DataTypes.STRING
        },
        // Version
        version: {
            type: DataTypes.STRING
        },
        estadoPago: { 
            type: DataTypes.STRING
        },
        proceso: {
            type: DataTypes.STRING
        },
        days: {
            type: DataTypes.INTEGER
        },
        validez: {
            type: DataTypes.INTEGER
        }
    })  
}