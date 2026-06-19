const { notification } = require('../../db/db');
const { Op } = require('sequelize');

/**
 * Servicio global para manejar la creación y disparo de notificaciones
 * con soporte para agrupación inteligente y WebSockets
 * 
 * @param {Object} params - Parámetros de la notificación
 * @param {number} params.userId - ID del usuario destinatario
 * @param {string} params.title - Título de la notificación
 * @param {string} params.body - Cuerpo/mensaje de la notificación
 * @param {string} [params.category='general'] - Categoría de la notificación
 * @param {string} [params.actionUrl] - URL de acción para redirección
 * @param {string} [params.targetId] - ID del registro específico relacionado
 * @param {string} [params.groupKey] - Clave para agrupar notificaciones relacionadas
 * @param {Object} [io] - Instancia de Socket.io (opcional, se puede pasar desde el controlador)
 * @returns {Promise<Object>} Resultado de la operación
 */
const sendNotification = async ({ 
    userId, 
    title, 
    body, 
    category = 'general', 
    actionUrl = null, 
    targetId = null, 
    groupKey = null 
}, io = null) => {
    try {
        // Validación de parámetros requeridos
        if (!userId || !title || !body) {
            throw new Error('Los parámetros userId, title y body son requeridos');
        }

        let notificationData;
        let isUpdate = false;

        // LÓGICA DE AGRUPACIÓN INTELIGENTE
        if (groupKey) {
            // Buscar notificación existente con el mismo groupKey que no haya sido vista
            const existingNotification = await notification.findOne({
                where: {
                    userId: userId,
                    groupKey: groupKey,
                    isSeen: false
                },
                order: [['updatedAt', 'DESC']] // Obtener la más reciente
            });

            if (existingNotification) {
                // ESCENARIO A: Existe y está sin ver - Actualizar la notificación existente
                await existingNotification.update({
                    title: title,
                    body: body,
                    category: category,
                    actionUrl: actionUrl,
                    targetId: targetId,
                    updatedAt: new Date()
                });

                notificationData = existingNotification.toJSON();
                isUpdate = true;

                console.log(`📝 Notificación agrupada actualizada - GroupKey: ${groupKey}, UserId: ${userId}`);
            } else {
                // ESCENARIO B: No existe notificación previa sin ver - Crear nueva
                const newNotification = await notification.create({
                    userId,
                    title,
                    body,
                    category,
                    actionUrl,
                    targetId,
                    groupKey,
                    isSeen: false,
                    isRead: false
                });

                notificationData = newNotification.toJSON();
                console.log(`🆕 Nueva notificación agrupada creada - GroupKey: ${groupKey}, UserId: ${userId}`);
            }
        } else {
            // ESCENARIO B: No tiene groupKey - Crear notificación normal
            const newNotification = await notification.create({
                userId,
                title,
                body,
                category,
                actionUrl,
                targetId,
                groupKey: null,
                isSeen: false,
                isRead: false
            });

            notificationData = newNotification.toJSON();
            console.log(`📨 Nueva notificación individual creada - UserId: ${userId}`);
        }

        // DISPARO POR WEBSOCKETS
        if (io) {
            // Emitir la notificación al usuario específico usando el formato correcto de sala
            io.to(`user:${userId}`).emit('new_notification', {
                ...notificationData,
                isUpdate: isUpdate, // Indica si es una actualización o nueva notificación
                timestamp: new Date().toISOString()
            });

            console.log(`🔔 Notificación enviada por WebSocket a usuario ${userId} en sala user:${userId}`);
        } else {
            console.warn('⚠️ Instancia de Socket.io no proporcionada - Notificación guardada pero no enviada por WebSocket');
        }

        // Contar notificaciones no vistas para el contador de la campana
        const unseenCount = await notification.count({
            where: {
                userId: userId,
                isSeen: false
            }
        });

        return {
            success: true,
            data: notificationData,
            isUpdate: isUpdate,
            unseenCount: unseenCount,
            message: isUpdate 
                ? 'Notificación agrupada actualizada exitosamente' 
                : 'Notificación creada exitosamente'
        };

    } catch (error) {
        console.error('❌ Error en sendNotification:', error);
        
        return {
            success: false,
            error: error.message,
            message: 'Error al procesar la notificación'
        };
    }
};

/**
 * Función helper para enviar notificación desde un controlador con acceso a req.app
 * @param {Object} params - Parámetros de la notificación
 * @param {Object} req - Objeto request de Express (para obtener io)
 * @returns {Promise<Object>} Resultado de la operación
 */
const sendNotificationFromController = async (params, req) => {
    const io = req.app.get('io');
    
    if (!io) {
        console.error('⚠️ Instancia de Socket.io NO encontrada en req.app - Verifica la configuración del servidor');
    }
    
    return await sendNotification(params, io);
};

/**
 * Envía la misma notificación a múltiples usuarios
 * @param {Object} params - Parámetros de la notificación (sin userId)
 * @param {number[]} userIds - IDs de los usuarios destinatarios
 * @param {Object} [io] - Instancia de Socket.io
 * @returns {Promise<Object>} Resultado consolidado de la operación
 */
const sendNotificationToMultipleUsers = async (params, userIds = [], io = null) => {
    if (!Array.isArray(userIds) || userIds.length === 0) {
        return {
            success: false,
            error: 'Debes proporcionar al menos un userId',
            message: 'No se enviaron notificaciones'
        };
    }

    const results = [];

    for (const userId of userIds) {
        try {
            const result = await sendNotification({ ...params, userId }, io);
            results.push({ userId, ...result });
        } catch (error) {
            console.error(`❌ Error enviando notificación a usuario ${userId}:`, error);
            results.push({
                userId,
                success: false,
                error: error.message
            });
        }
    }

    const successCount = results.filter((result) => result.success).length;

    return {
        success: successCount > 0,
        total: userIds.length,
        successCount,
        failedCount: userIds.length - successCount,
        results,
        message: `Notificaciones enviadas: ${successCount}/${userIds.length}`
    };
};

/**
 * Helper para enviar notificaciones a múltiples usuarios desde un controlador
 * @param {Object} params - Parámetros de la notificación (sin userId)
 * @param {number[]} userIds - IDs de los usuarios destinatarios
 * @param {Object} req - Objeto request de Express
 * @returns {Promise<Object>} Resultado consolidado de la operación
 */
const sendNotificationToMultipleUsersFromController = async (params, userIds, req) => {
    const io = req.app.get('io');

    if (!io) {
        console.error('⚠️ Instancia de Socket.io NO encontrada en req.app - Verifica la configuración del servidor');
    }

    return await sendNotificationToMultipleUsers(params, userIds, io);
};

/**
 * Función para marcar múltiples notificaciones como vistas por groupKey
 * @param {number} userId - ID del usuario
 * @param {string} groupKey - Clave del grupo a marcar como visto
 * @returns {Promise<Object>} Resultado de la operación
 */
const markGroupAsSeen = async (userId, groupKey) => {
    try {
        const [updatedCount] = await notification.update(
            { isSeen: true },
            {
                where: {
                    userId: userId,
                    groupKey: groupKey,
                    isSeen: false
                }
            }
        );

        return {
            success: true,
            updatedCount: updatedCount,
            message: `${updatedCount} notificaciones del grupo marcadas como vistas`
        };

    } catch (error) {
        console.error('❌ Error en markGroupAsSeen:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    sendNotification,
    sendNotificationFromController,
    sendNotificationToMultipleUsers,
    sendNotificationToMultipleUsersFromController,
    markGroupAsSeen
};