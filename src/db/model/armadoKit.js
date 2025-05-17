const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('armadoKits', { 
        id: { 
            type: DataTypes.INTEGER,
            primaryKey: true, 
            autoIncrement: true 
        },
        // Nombre
        cantidad: {
            type: DataTypes.STRING
        } 
    })  
}    