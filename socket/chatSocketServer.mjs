// Servidor Socket.IO independiente para el chat de trade
import { Server } from 'socket.io';
import http from 'http';
import MarketService from '../services/marketService.js';

const userSockets = new Map();        // username → socket.id
const tradeRooms = new Map();         // tradeId → Set(usernames)
const socketUsers = new Map();        // socket.id → username

// Crea un servidor HTTP exclusivo para el chat
const chatServer = http.createServer();

// Inicializa Socket.IO
const io = new Server(chatServer, {
  cors: {
    origin: '*', // restringe a tu dominio en prod
    methods: ['GET', 'POST'],
  },
  path: '/cht/socket.io'
});

// Manejador de conexiones
io.on('connection', (socket) => {
  console.log(`[Chat] Cliente conectado: ${socket.id}`);

  // 🔹 Registro de usuario
  socket.on('register_user', (user) => {
    if (!user) return;

    // Si ya estaba conectado, lo reemplazamos
    if (userSockets.has(user)) {
      const oldSocketId = userSockets.get(user);
      if (oldSocketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        if (oldSocket) oldSocket.disconnect(true);
      }
    }

    userSockets.set(user, socket.id);
    socketUsers.set(socket.id, user);
    socket.user = user;

    console.log(`[Chat] Usuario ${user} registrado con socket ${socket.id}`);
    socket.emit('USER_REGISTERED', { user });
  });

  // 🔹 Unirse a una sala de trade
  socket.on('join_trade', ({ tradeId, user }) => {
    if (!tradeId || !user) return;
    const room = `trade_${tradeId}`;

    // Añade usuario a la sala
    socket.join(room);

    // Guarda relación tradeId → usuarios
    if (!tradeRooms.has(tradeId)) tradeRooms.set(tradeId, new Set());
    tradeRooms.get(tradeId).add(user);

    console.log(`[Chat] ${user} se unió a ${room}`);

    // Notificar a los demás de la sala
    io.to(room).emit('TRADE_USER_JOINED', { user, tradeId });
  });

  // 🔹 Enviar mensaje dentro de una sala
  socket.on('send_trade_message', async (payload) => {
    const { chat_id, sender, message, content_type, token, image } = payload;
    if (!chat_id || !sender || !message) return;
    const room = `trade_${chat_id}`;

    console.log(`[Chat] Mensaje recibido en ${room} de ${sender}:`, message);

    try {
      const result = await MarketService.sendMessage({
        chat_id,
        sender,
        message,
        content_type,
        token,
        image,
      });

      if (result.success) {
        io.to(room).emit('TRADE_NEW_MESSAGE', {
          chat_id,
          message: result.msg,
        });
      } else {
         io.to(room).emit('TRADE_ERROR', { chat_id,error: result.message });
      }
    } catch (err) {
      console.error(`[Chat] Error al guardar mensaje:`, err);
      io.to(room).emit('TRADE_ERROR', { chat_id,error: 'Error al guardar mensaje' });
    }
  });

  // 🔹 Enviar mensaje dentro de una sala
  socket.on('trade_action', async (payload) => {
    const { chat_id, user, action, auth } = payload;
    if (!chat_id || !user || !action) return;
    const room = `trade_${chat_id}`;

    console.log(`[Chat] Acción recibida en ${room} de ${user}:`, action);

    try {
      const result = await MarketService.pushAction({
        chat_id,
        user,
        action,
        token: auth
      });

      if (result.success) {
        io.to(room).emit('TRADE_SUCCESS_ACTION', {
          chat_id,
        });
      } else {
         io.to(room).emit('TRADE_ERROR', { result,chat_id });
      }
    } catch (err) {
      console.error(`[Chat] Error al guardar mensaje:`, err);
      io.to(room).emit('TRADE_ERROR', { chat_id,error: 'Error al guardar mensaje' });
    }
  });

  // 🔹 Manejar desconexión
  socket.on('disconnect', () => {
    const user = socketUsers.get(socket.id);
    if (!user) return;

    userSockets.delete(user);
    socketUsers.delete(socket.id);

    // Elimina de todas las salas de trade
    for (const [tradeId, usersSet] of tradeRooms.entries()) {
      usersSet.delete(user);
      if (usersSet.size === 0) {
        tradeRooms.delete(tradeId); // sala vacía → limpia
        console.log(`[Chat] Sala trade_${tradeId} eliminada (vacía)`);
      } else {
        io.to(`trade_${tradeId}`).emit('TRADE_USER_LEFT', { user, tradeId });
      }
    }

    console.log(`[Chat] Usuario ${user} desconectado y limpiado`);
  });
});

// 🚀 Inicia el servidor de chat en su propio puerto
const CHAT_PORT = 3030;
chatServer.listen(CHAT_PORT, () => {
  console.log(`[Chat] Servidor Socket.IO escuchando en puerto ${CHAT_PORT}`);
});

// 🔸 Enviar mensaje directo a un usuario específico
export function enviarMensajeAUsuario(user, payload) {
  const socketId = userSockets.get(user);
  if (socketId && io) {
    io.to(socketId).emit('TRADE_NEW_MESSAGE', payload);
    console.log(`[Chat] Mensaje directo enviado a ${user}:`, payload);
  } else {
    console.warn(`[Chat] Usuario ${user} no está conectado.`);
  }
}

// Exporta io para uso externo
export { io };
