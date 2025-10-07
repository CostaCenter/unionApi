const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('ComprasCotizacionProyecto', { 
        // Nombre
        name: {
            type: DataTypes.STRING
        },
    })  
}   