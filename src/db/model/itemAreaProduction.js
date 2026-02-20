const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('itemAreaProduction', { 
        // Cantidad que debe procesarse en esta área
        cantidad: {
            type: DataTypes.DECIMAL(10, 4),
            allowNull: false,
            defaultValue: 0
        },
        // Cantidad ya procesada/completada en esta área
        cantidadProcesada: {
            type: DataTypes.DECIMAL(10, 4),
            allowNull: false,
            defaultValue: 0
        },
        // Medida del item (para productos con mt2, etc.)
        medida: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // Estado del proceso en esta área
        estado: {
            type: DataTypes.ENUM('pendiente', 'en_proceso', 'completado', 'pausado'),
            defaultValue: 'pendiente'
        },
        // Notas u observaciones del proceso
        notas: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Fecha de inicio del proceso en esta área
        fechaInicio: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Fecha de finalización del proceso en esta área
        fechaFin: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }) 
} 