const { DataTypes } = require('sequelize');
 
module.exports = sequelize => {
    sequelize.define('itemPieza', { 
        id: { 
            type: DataTypes.INTEGER,
            primaryKey: true, 
            autoIncrement: true 
        },
        // Nombre
        cantidad: {
            type: DataTypes.STRING
        },
        medida: {
            type: DataTypes.STRING
        },
        calibre: {
            type: DataTypes.INTEGER
        }
    })  
}  