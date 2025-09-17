const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('movimientoInventario', { 
        // Nombre
        cantidad: {
            type: DataTypes.STRING 
        },
        // TipoMaterial // Materia Prima o Producto comercializable. Para filtrar mejor.
        tipoProducto: {
            type: DataTypes.STRING
        },
        tipoMovimiento: { // Entrada POR OC a Producción, Transferencia
            type: DataTypes.STRING
        },
        referenciaDeDocumento: { // Orden de compra, Número de OP, Número de Recepción
            type: DataTypes.STRING
        },
        documentoId: {
            type: DataTypes.INTEGER
        },
        notas: {
            type: DataTypes.TEXT
        }
    }) 
}   