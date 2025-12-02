const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('necesidadProyecto', { 
        cantidadComprometida: {
            type: DataTypes.DECIMAL(10,4) 
        },

        cantidadEntregada: {
            type: DataTypes.DECIMAL(10,4) 
        },
        estado: {
            type: DataTypes.ENUM('reservado', 'parcial', 'completo', 'liberado'),
            defaultValue: 'reservado'
        }
    }) 
}   