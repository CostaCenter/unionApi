const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('productoCotizacion', { 
        id: { 
            type: DataTypes.INTEGER,
            primaryKey: true, 
            autoIncrement: true 
        },
        // Cantidad de kits
        cantidad: {
            type: DataTypes.STRING
        },
        // Precio
        precio: {
            type: DataTypes.STRING
        },
        medida: {
            type: DataTypes.STRING
        },
        // descuento
        descuento: {
            type: DataTypes.STRING
        }, 
    })  
} 