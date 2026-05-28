const { notification } = require('../db/db');
const { Op } = require('sequelize');
const { sendNotificationFromController } = require('./services/notificationServices');

// GET /api/notifications - Obtener las últimas 30 notificaciones del usuario
const getNotifications = async (req, res) => {
    try {
        const userId = req.user.user.id;

        // Obtener las últimas 30 notificaciones del usuario
        const notifications = await notification.findAll({
            where: {
                userId: userId
            },
            order: [['createdAt', 'DESC']],
            limit: 30
        });

        // Contar notificaciones no vistas
        const unseenCount = await notification.count({
            where: {
                userId: userId,
                isSeen: false
            }
        });

        res.status(200).json({
            success: true,
            data: notifications,
            unseenCount: unseenCount,
            msg: 'Notificaciones obtenidas exitosamente'
        });

    } catch (error) {
        console.error('Error al obtener notificaciones:', error);
        res.status(500).json({
            success: false,
            msg: 'Ha ocurrido un error al obtener las notificaciones',
            error: error.message
        });
    }
};

// PUT /api/notifications/mark-as-seen - Marcar todas las notificaciones como vistas
const markAllAsSeen = async (req, res) => {
    try {
        const userId = req.user.user.id;

        // Actualizar todas las notificaciones no vistas del usuario
        const [updatedCount] = await notification.update(
            { isSeen: true },
            {
                where: {
                    userId: userId,
                    isSeen: false
                }
            }
        );

        res.status(200).json({
            success: true,
            updatedCount: updatedCount,
            msg: `Se marcaron ${updatedCount} notificaciones como vistas`
        });

    } catch (error) {
        console.error('Error al marcar notificaciones como vistas:', error);
        res.status(500).json({
            success: false,
            msg: 'Ha ocurrido un error al marcar las notificaciones como vistas',
            error: error.message
        });
    }
};

// PUT /api/notifications/:id/mark-as-read - Marcar una notificación específica como leída
const markAsRead = async (req, res) => {
    try {
        const userId = req.user.user.id;
        const notificationId = req.params.id;

        // Buscar la notificación específica del usuario
        const userNotification = await notification.findOne({
            where: {
                id: notificationId,
                userId: userId
            }
        });

        if (!userNotification) {
            return res.status(404).json({
                success: false,
                msg: 'Notificación no encontrada o no pertenece al usuario'
            });
        }

        // Actualizar la notificación como leída
        await userNotification.update({ isRead: true });

        res.status(200).json({
            success: true,
            data: userNotification,
            msg: 'Notificación marcada como leída exitosamente'
        });

    } catch (error) {
        console.error('Error al marcar notificación como leída:', error);
        res.status(500).json({
            success: false,
            msg: 'Ha ocurrido un error al marcar la notificación como leída',
            error: error.message
        });
    }
};

// POST /api/notifications - Crear una nueva notificación
const createNotification = async (req, res) => {
    try {
        // Extraer parámetros del body de la request
        const { 
            userId, 
            title, 
            body, 
            category, 
            actionUrl, 
            targetId, 
            groupKey 
        } = req.body;

        // Validar datos requeridos
        if (!userId || !title || !body) {
            return res.status(400).json({
                success: false,
                msg: 'Los campos userId, title y body son requeridos'
            });
        }

        // Llamar al servicio global de notificaciones
        const result = await sendNotificationFromController({
            userId,
            title,
            body,
            category,
            actionUrl,
            targetId,
            groupKey
        }, req);

        // Verificar si el servicio procesó correctamente
        if (!result.success) {
            return res.status(500).json({
                success: false,
                msg: 'Error al procesar la notificación',
                error: result.error
            });
        }

        // Respuesta exitosa con información completa
        res.status(201).json({
            success: true,
            data: result.data,
            isUpdate: result.isUpdate,
            unseenCount: result.unseenCount,
            msg: result.message
        });

    } catch (error) {
        console.error('❌ Error en createNotification:', error);
        res.status(500).json({
            success: false,
            msg: 'Ha ocurrido un error al crear la notificación',
            error: error.message
        });
    }
};

// Función helper para crear notificaciones directamente en BD (para uso interno del sistema)
const createNotificationDirect = async (notificationData) => {
    try {
        const newNotification = await notification.create(notificationData);
        return {
            success: true,
            data: newNotification
        };
    } catch (error) {
        console.error('Error al crear notificación directa:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    getNotifications,
    markAllAsSeen,
    markAsRead,
    createNotification,
    createNotificationDirect
};