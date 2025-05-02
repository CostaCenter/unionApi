const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('ubicacion', { 
        // Nombre
        nombre: {
            type: DataTypes.STRING 
        },
        // Tipo. Clasifica la ubicación. 'Bogega', 'Producción, 'Tránsito', 'Despacho'
        tipo: {
            type: DataTypes.STRING
        },
        description: {
            type: DataTypes.STRING
        }
    }) 
}   