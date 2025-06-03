const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('permission', { 
        // Tabla o contexto
        name : {
            type: DataTypes.STRING
        },
        // Porcentaje final
        descripcion: {
            type: DataTypes.STRING 
        },
    })
}     