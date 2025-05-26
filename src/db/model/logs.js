const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('log', { 
        // Tabla o contexto
        entidad : {
            type: DataTypes.STRING
        },
        // FECHA
        entidad_id: {
            type: DataTypes.INTEGER 
        },
        segunda_id: {
            type: DataTypes.INTEGER 
        }, 
        accion: { // CREATE, UPDATE, DELETE OR READ...
            type: DataTypes.STRING
        },
        // DETALLE
        detalle: {
            type: DataTypes.STRING
        },
        fecha: { // Fecha en que se registro el movimiento
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        notas: {
            type: DataTypes.TEXT
        },
    }) 
}   