const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('notaCotizacion', { 
        texto: {
            type: DataTypes.TEXT 
        },
        imagen: {
            type: DataTypes.TEXT
        },
        type: {
            type: DataTypes.STRING // IMAGEN; TEXTO; MIXTO
        },
    })  
}