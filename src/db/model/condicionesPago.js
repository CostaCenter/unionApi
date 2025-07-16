const { DataTypes } = require('sequelize');
 
module.exports = sequelize => {
    sequelize.define('condicionesPago', { 
        // Nombre
        nombre: {
            type: DataTypes.STRING
        },
        // Contado, Crédito, Cuotas
        type: {
            type: DataTypes.STRING
        },
        // Días de plazo
        plazo: {
            type: DataTypes.INTEGER
        },
        // Descripción
        description: {  
            type: DataTypes.STRING
        },
        state: {
            type: DataTypes.BOOLEAN
        }
    })  
}    