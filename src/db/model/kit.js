const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('kit', { 
        // Nombre
        code: {
            type: DataTypes.INTEGER
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