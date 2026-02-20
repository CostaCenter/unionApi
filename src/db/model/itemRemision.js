const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('itemRemision', { 
        // Cantidad remisionada
        cantidad: {
            type: DataTypes.DECIMAL(10, 4),
            allowNull: false,
            defaultValue: 0
        },
        // Medida del item (para productos con mt2, etc.)
        medida: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // Estado del item en la remisión
        estado: {
            type: DataTypes.ENUM('Pendiente', 'Remisionado', 'Cancelado'),
            defaultValue: 'Pendiente',
            allowNull: false
        },
        // Notas específicas del item
        notas: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    })
}
