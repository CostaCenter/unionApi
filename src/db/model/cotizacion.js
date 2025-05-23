const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('cotizacion', { 
        // Nombre
        name: {
            type: DataTypes.STRING 
        },
        description: {
            type: DataTypes.STRING 
        },
        time: {
            type: DataTypes.DATE
        },
        fechaAprobada: {
            type: DataTypes.DATE
        },
        price: {
            type: DataTypes.STRING
        },
        descuento: {
            type: DataTypes.STRING
        },
        iva: {
            type: DataTypes.STRING
        },
        // Aprobada , Espera , Perdida
        state: {
            type: DataTypes.STRING
        } 
    })  
}