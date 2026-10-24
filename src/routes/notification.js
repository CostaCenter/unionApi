const express = require('express');
const {
    getNotifications,
    markAllAsSeen,
    clearAllNotifications,
    markAsRead,
    createNotification,
    createNotificationDirect
} = require('../controllers/notification');
const { isAuthenticated } = require('../controllers/user');
const router = express.Router();

// GET /api/notifications - Obtener las últimas 20 notificaciones del usuario autenticado
// POST /api/notifications - Crear una nueva notificación
router.route('/')
    .get(isAuthenticated, getNotifications)
    .post(createNotification);

// PUT /api/notifications/mark-as-seen - Marcar todas las notificaciones del usuario como vistas
router.route('/mark-as-seen')
    .put(isAuthenticated, markAllAsSeen);

// DELETE /api/notifications/clear-all - Eliminar todas las notificaciones del usuario
router.route('/clear-all')
    .delete(isAuthenticated, clearAllNotifications);

// PUT /api/notifications/:id/mark-as-read - Marcar una notificación específica como leída
router.route('/:id/mark-as-read')
    .put(isAuthenticated, markAsRead);

module.exports = router;