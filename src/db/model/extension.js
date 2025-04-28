const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('extension', { 
        // Nombre
        code: {
            type: DataTypes.STRING
        },
        name: {
            type: DataTypes.STRING
        },
        description: {
            type: DataTypes.STRING
        },
        // Estado... Activo o innactivo
        state: {
            type: DataTypes.STRING
        },  
    })  
} 