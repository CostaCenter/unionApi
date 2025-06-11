const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('areaCotizacion', { 
        // Nombre
        name: { 
            type: DataTypes.STRING 
        },
        description: {
            type: DataTypes.STRING
        },
        state: { // Esto indica si esta activa o no el área
            type: DataTypes.BOOLEAN
        }
    }) 
} 