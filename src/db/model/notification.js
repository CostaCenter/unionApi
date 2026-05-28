const { DataTypes } = require('sequelize');

module.exports = sequelize => {
    sequelize.define('notification', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        // Usuario dueño de la notificación
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        // Título de la notificación
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        // Cuerpo/mensaje de la notificación
        body: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        // Controla si se limpió el contador de la campana
        isSeen: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        // Controla si se abrió el detalle de la notificación
        isRead: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        // Categoría de la notificación
        category: {
            type: DataTypes.STRING,
            defaultValue: 'general'
        },
        // Ruta base de redirección
        actionUrl: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // UUID o ID del registro específico (factura, tarea, etc.)
        targetId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // Clave para agrupar notificaciones relacionadas
        groupKey: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        timestamps: true, // Incluye createdAt y updatedAt
        indexes: [
            {
                fields: ['userId', 'createdAt'] // Índice compuesto para consultas eficientes
            },
            {
                fields: ['userId', 'isSeen'] // Índice para el contador de no vistas
            },
            {
                fields: ['userId', 'groupKey', 'isSeen'] // Índice para agrupación de notificaciones
            }
        ]
    });
}