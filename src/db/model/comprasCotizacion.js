const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('comprasCotizacion', { 
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
        // Estado... Pendiente, compras
        estadoPago: { 
            type: DataTypes.STRING
        },
        // Financiero , EsperandoAlmacen, finalizado
        proceso: {
            type: DataTypes.STRING
        },
        dayCompras: {
            type: DataTypes.DATE
        },
        daysFinish: {
            type: DataTypes.DATE
        },
        validez: {
            type: DataTypes.INTEGER
        }
    })  
}