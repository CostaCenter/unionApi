const express = require('express');
const {
    getNotifications,
    markAllAsSeen,
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

// PUT /api/notifications/:id/mark-as-read - Marcar una notificación específica como leída
router.route('/:id/mark-as-read')
    .put(isAuthenticated, markAsRead);

module.exports = router;