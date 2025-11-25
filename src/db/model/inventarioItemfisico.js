const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('inventarioItemFisico', { 
        // Nombre
        cantidadDisponible: {
            type: DataTypes.DECIMAL(10,4) 
        },
        longitudInicial: {
            type: DataTypes.DECIMAL(10,4)
        },
        state: {
            type: DataTypes.STRING
        },
        // Si cnatidadDisponible < longitudInicial & > 0
        esRemanente: {
            type: DataTypes.BOOLEAN
        }

    }) 
}  