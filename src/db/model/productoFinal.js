const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('producto', { 
        // Nombre
        item: { 
            type: DataTypes.STRING 
        },
        description: {
            type: DataTypes.STRING
        },
        medida: { // Esto indica si debemos aplicar formulario por MT2
            type: DataTypes.STRING
        },
        unidad: { // Esta opción es si alguna variación en calculos se llegan a presentar en el software más adelante.
            type: DataTypes.STRING
        },
        peso: {
            type: DataTypes.STRING
        },
        volumen: {
            type: DataTypes.STRING
        },
        procedencia: {
            type: DataTypes.STRING
        },
        criticidad: {
            type: DataTypes.STRING
        },
    }) 
}