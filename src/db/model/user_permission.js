const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('user_permission', { 
        // PERMITIDO O NO
        granted: {
            type: DataTypes.BOOLEAN 
        },
    })
}    