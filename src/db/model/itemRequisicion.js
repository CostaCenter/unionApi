const { DataTypes } = require('sequelize');
// Cotización compras - NECESITAMOS ESTO
module.exports = sequelize => {
    sequelize.define('itemRequisicion', { 
        // Cantidad necesitada
        cantidad: {
            type: DataTypes.STRING 
        },
        // Cantidad comprada.
        cantidadEntrega: {
            type: DataTypes.STRING 
        },
        // MEDIDA
        medida: {
            type: DataTypes.STRING
        },
        // PENDIENTE, SIN EMPEZAR, PARCIAL, COMPLETADO, CANCELADO
        estado: {
            type: DataTypes.STRING
        }
    })  
}