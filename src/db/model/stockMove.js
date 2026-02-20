const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('stockMove', { 
        // Nombre
        cantidad: {
            type: DataTypes.DECIMAL(10, 4) 
        },
        // TipoMaterial // Materia Prima o Producto comercializable. Para filtrar mejor.
        tipoProducto: {
            type: DataTypes.STRING // Materia Prima o Producto comercializable. Producto listo.
        },
        tipoMovimiento: { // Entrada POR OC a Producción, Transferencia
            type: DataTypes.STRING //
            // OC - Orden de compra
            // OP - Orden de producción
            // TRANSFERENCIA - Movimiento entre bodegas

        },
        referenciaDeDocumento: { // Orden de compra, Número de OP, Número de Recepción
            type: DataTypes.STRING
        },
        comprasCotizacionId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        bodegaOrigenId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        bodegaDestinoId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        notas: {
            type: DataTypes.TEXT
        }
    }) 
}    