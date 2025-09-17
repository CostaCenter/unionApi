const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('comprar_grupo', { 
        // Nombre
        name: {
            type: DataTypes.STRING 
        },
        description: {
            type: DataTypes.TEXT 
        },
        fecha: {
            type: DataTypes.DATE
        },
        // Aprobada , Espera , Perdida
        state: {
            type: DataTypes.STRING
        },
        days: {
            type: DataTypes.INTEGER
        }
    })  
}