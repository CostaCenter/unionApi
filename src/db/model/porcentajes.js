const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('percentage', { 
        // Tabla o contexto
        distribuidor : {
            type: DataTypes.DECIMAL
        },
        // Porcentaje final
        final: {
            type: DataTypes.DECIMAL 
        },
        state: { // CREATE, UPDATE, DELETE OR READ...
            type: DataTypes.STRING
        },
    })
}   