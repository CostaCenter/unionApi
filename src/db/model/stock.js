const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('stock', { 
        // Nombre
        cantidad: {
            type: DataTypes.DECIMAL(10, 4) 
        },
        medida: {
            type: DataTypes.STRING
        },
        tipo: {
            type: DataTypes.STRING // Materia Prima o Producto comercializable. Producto listo.
        },
        unidad: {
            type: DataTypes.STRING,
            allowNull: true
        },
        ubicacionId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        state: {
            type: DataTypes.STRING
        },
        limit: {
            type: DataTypes.INTEGER
        },
    }) 
}  