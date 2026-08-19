const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('comprasCotizacionItem', { 
       cantidad: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0 
        },
        precioUnidad: {
            type: DataTypes.STRING
        },
        descuento: {
            type: DataTypes.STRING
        },
        precio: {
            type: DataTypes.STRING
        },
        precioTotal: { // Resultado de precio unidad x Cantidad total
            type: DataTypes.STRING
        },
        estado: {
            type: DataTypes.STRING,
            defaultValue: 'pendiente'
        },
        medida: {
            type: DataTypes.STRING
        },
        entregado: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        tipo: {
            type: DataTypes.STRING(32),
            allowNull: true,
            validate: {
                isIn: [['material', 'producto', 'servicio_libre']],
            },
        },
        descripcionLibre: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    })  
}     