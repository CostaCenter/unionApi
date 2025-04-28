const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('categoria', { 
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
        // Comercial o Interna
        type: {
            type: DataTypes.STRING
        },
        // Estado... Activo o innactivo
        state: {
            type: DataTypes.STRING
        },  
    })  
} 