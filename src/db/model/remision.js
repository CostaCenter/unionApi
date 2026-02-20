const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('remision', { 
        // Número de remisión (auto-generado)
        numeroRemision: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        // Estado de la remisión
        estado: {
            type: DataTypes.ENUM('Activa', 'Remisionada', 'Cancelada'),
            defaultValue: 'Activa',
            allowNull: false
        },
        // Fecha de remisión (cuando se remisiona)
        fechaRemision: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Observaciones generales
        observaciones: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Usuario que creó la remisión
        usuarioId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        // Campos adicionales para remisión
        placa: {
            type: DataTypes.STRING,
            allowNull: true
        },
        guia: {
            type: DataTypes.STRING,
            allowNull: true
        },
        cajas: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        oc: {
            type: DataTypes.STRING,
            allowNull: true
        },
        ov: {
            type: DataTypes.STRING,
            allowNull: true
        }
    })
}
