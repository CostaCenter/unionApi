const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('itemToProject', { 
        cantidad: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0 
        },
        necesidad: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0  
        },
        unidad: {
            type: DataTypes.STRING
        },
        estado: {
            type: DataTypes.STRING,
            defaultValue: 'pendiente'
        } 
    })
}     