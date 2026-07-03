const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('requiredKit', { 
        // Valor
        nombre: {
            type: DataTypes.STRING 
        },
        leidoProduccion: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        leidoComercial: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        description: {
            type: DataTypes.TEXT
        },
        state: {
            type: DataTypes.STRING,
            defaultValue: 'petition'
        },
        tipo: {
            type: DataTypes.STRING,
            defaultValue: 'kit'
        },
        parentRequerimientoId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        esContenedor: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        extensionId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        leidoCompras: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    })   
}
// Esta tabla es la relación directa con todos los precios.
