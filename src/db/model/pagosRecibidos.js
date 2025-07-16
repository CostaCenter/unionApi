const { DataTypes } = require('sequelize');
 
module.exports = sequelize => {
    sequelize.define('pagoRecibido', { 
        // Pago a paso, 1 - 2 - 3
        valor: {
            type: DataTypes.STRING
        },
        // Días de plazo
        fecha_pago: {
            type: DataTypes.DATE
        },
        // Descripción
        metodoPago: {  
            type: DataTypes.STRING
        },
        // Al aprobar cotización, etc.
        referencia: {
            type: DataTypes.STRING
        },
    })  
}  