const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('versionCotizacion', { 
        // Nombre
        name: {
            type: DataTypes.STRING 
        },
        description: {
            type: DataTypes.TEXT 
        },
        // Aprobada , Espera , Perdida
        state: {
            type: DataTypes.STRING
        },
    })   
}