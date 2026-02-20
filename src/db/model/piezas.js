const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('pieza', { 
        // Nombre
        name: { 
            type: DataTypes.STRING 
        },
        description: {
            type: DataTypes.STRING
        },
        version: {
            type: DataTypes.INTEGER
        },
        state: { // Esto indica si esta activa o no el área
            type: DataTypes.BOOLEAN
        },  
    }) 
} 