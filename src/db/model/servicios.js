const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('service', { 
        // Nombre
        name: { 
            type: DataTypes.STRING 
        },
        description: {
            type: DataTypes.STRING
        }
    }) 
}