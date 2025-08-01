const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('priceKit', { 
        // Valor
        valor: {
            type: DataTypes.STRING 
        },
        iva: {
            type: DataTypes.STRING
        },
        bruto: {
            type: DataTypes.STRING
        },
        state: {
            type: DataTypes.STRING
        } 
    })  
}
// Esta tabla es la relación directa con todos los precios.
