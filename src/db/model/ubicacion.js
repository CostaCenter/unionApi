const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('ubicacion', { 
        // Nombre
        nombre: {
            type: DataTypes.STRING 
        },
        // Tipo. Clasifica la ubicación. 'Bodega', 'Producción, 'Tránsito', 'Despacho'
        tipo: {
            type: DataTypes.STRING
        },
        description: {
            type: DataTypes.STRING
        }
    }) 
}   