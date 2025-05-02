const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('inventario', { 
        // Nombre
        cantidad: {
            type: DataTypes.STRING 
        },
        cantidadComprometida: {
            type: DataTypes.STRING
        },
        medida: {
            type: DataTypes.STRING
        }
    }) 
}  