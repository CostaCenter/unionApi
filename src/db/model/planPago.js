const { DataTypes } = require('sequelize');
 
module.exports = sequelize => {
    sequelize.define('planPago', { 
        // Pago a paso, 1 - 2 - 3
        orden: {
            type: DataTypes.STRING
        },
        // Días de plazo
        porcentaje: {
            type: DataTypes.STRING
        },
        // Descripción
        description: {  
            type: DataTypes.STRING
        },
        // Al aprobar cotización, etc.
        momentoPago: {
            type: DataTypes.STRING
        },
        state: {
            type: DataTypes.BOOLEAN
        } 
    })  
}  