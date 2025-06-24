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
        // Tabla o contexto
        distribuidor : {
            type: DataTypes.DECIMAL
        },
        // Porcentaje final
        final: {
            type: DataTypes.DECIMAL 
        },
        // Estado... Activo o innactivo
        state: {
            type: DataTypes.STRING
        },  
    })  
} 