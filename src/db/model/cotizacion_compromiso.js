const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('cotizacion_compromiso', { 
       cantidadComprometida: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0 
        },
        cantidadEntregada: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        medida: {
            type: DataTypes.STRING,
            allowNull: true
        },
        estado: {
            type: DataTypes.ENUM('reservado', 'parcial', 'completo', 'liberado'),
            defaultValue: 'reservado'
        }
    }) 
}   