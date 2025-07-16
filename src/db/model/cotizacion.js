const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('cotizacion', { 
        // Nombre
        name: {
            type: DataTypes.STRING 
        },
        description: {
            type: DataTypes.TEXT 
        },
        time: {
            type: DataTypes.DATE
        },
        fechaAprobada: {
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
        }
    })  
}