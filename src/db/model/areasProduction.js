const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('areaProduction', { 
        // Nombre
        name: { 
            type: DataTypes.STRING 
        },
        description: {
            type: DataTypes.STRING
        },
    }) 
} 