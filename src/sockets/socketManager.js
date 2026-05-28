const jwt = require('jsonwebtoken');
const authConfig = require('../../config/auth');

// userId (string|number) -> Set de socketIds activos
const userSockets = new Map();

let _io = null;

/**
 * Inicializa el sistema de sockets.
 * Llámalo UNA vez pasándole la instancia de Socket.IO.
 */
function initSocketManager(io) {
  _io = io;

  // Middleware: verifica el JWT enviado en el handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('AUTH_REQUIRED'));

    try {
      const decoded = jwt.verify(token, authConfig.secret);
      // El payload tiene forma { user: { id, name, rango, ... } }
      socket.userId = String(decoded?.user?.id);
      if (!socket.userId || socket.userId === 'undefined') {
        return next(new Error('INVALID_TOKEN'));
      }
      next();
    } catch {
      next(new Error('INVALID_TOKEN'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`[Socket] Usuario ${userId} conectado: ${socket.id}`);

    // Registrar en el mapa
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    // Sala privada de notificaciones
    socket.join(`user:${userId}`);

    // ── Eventos existentes (no se tocan) ──────────────────────────────
    socket.on('join:requerimiento', (reqId) => {
      socket.join(`req:${reqId}`);
      console.log(`[Socket] ${socket.id} se unió a req:${reqId}`);
    });

    socket.on('send:message', (reqId, mensaje) => {
      console.log(`[Socket] Mensaje en req:${reqId}:`, mensaje);
      io.to(`req:${reqId}`).emit('requerimiento:update', { reqId, mensaje });
    });
    // ─────────────────────────────────────────────────────────────────

    socket.on('disconnect', () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userSockets.delete(userId);
      }
      console.log(`[Socket] Usuario ${userId} desconectado: ${socket.id}`);
    });
  });
}

/**
 * Emite una notificación en tiempo real a un usuario específico.
 * Si el usuario no está conectado, la llamada se ignora silenciosamente.
 *
 * @param {string|number} recipientId  - ID del usuario destinatario
 * @param {object}        notificationData - Payload de la notificación
 */
function sendLiveNotification(recipientId, notificationData) {
  if (!_io) return;
  _io.to(`user:${String(recipientId)}`).emit('new_notification', notificationData);
  console.log(`[Socket] Notificación enviada a usuario ${recipientId}`);
}

module.exports = { initSocketManager, sendLiveNotification };
