const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('requisicion', { 
        // Nombre
        nombre : {
            type: DataTypes.STRING
        },
        // FECHA
        fecha: {
            type: DataTypes.DATE 
        },
        estado: { // Aprobado, Pendiente, Comprado, Compra parcial
            type: DataTypes.STRING
        },
        fechaNecesaria: { // Fecha en la que se necesita el material
            type: DataTypes.DATE
        },
        notas: {
            type: DataTypes.TEXT
        },
        notas: {
            type: DataTypes.TEXT
        }
    }) 
}   