const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('armado', { 
        // Nombre
        name: {
            type: DataTypes.TEXT
        },
        description: {
            type: DataTypes.TEXT
        },
        // IMG
        img: {
            type: DataTypes.TEXT
        },
        show: {
            type: DataTypes.BOOLEAN 
        },
        // Estado... Activo o innactivo
        state: {
            type: DataTypes.STRING
        },
    }) 
}