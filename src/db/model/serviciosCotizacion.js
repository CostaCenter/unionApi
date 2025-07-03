const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('serviceCotizacion', { 
        // Precio
        precio: { 
            type: DataTypes.STRING 
        },
        // Descuento
        descuento: {
            type: DataTypes.STRING
        },
        // Cantidad
        cantidad: { 
            type: DataTypes.STRING
        },
    }) 
}