// Servidor Socket.IO independiente para el chat de trade
import { Server } from 'socket.io';
import http from 'http';
import MarketService from '../services/marketService.js';
import { logPing } from '../utils/logger.js';

// tradeId → Map(socketId → username)
const tradeRooms = new Map();

// socketId → { user, trades: Set<tradeId> }
const sockets = new Map();

// tradeId → Map(socketId → { user, lastPing })
const tradePings = new Map();

// Crea un servidor HTTP exclusivo para el chat
const chatServer = http.createServer();

// Inicializa Socket.IO
const io = new Server(chatServer, {
  cors: {
    origin: '*', // restringe a tu dominio en prod
    methods: ['GET', 'POST'],
  },
  path: '/cht/socket.io',
  transports: ['polling'], 
});

function formatDate(date = new Date()) {
  const pad = (n) => n.toString().padStart(2, '0');

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
         `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Manejador de conexiones
io.on('connection', (socket) => {
  console.log(`[Chat] Cliente conectado: ${socket.id}`);

   // ⏱️ Si en 10s no se registra → fuera
  const registerTimeout = setTimeout(() => {
    if (!sockets.has(socket.id)) {
      console.warn(`[Chat] Socket huérfano eliminado: ${socket.id}`);
      socket.disconnect(true);
    }
  }, 10_000);

  // 🔹 Registro de usuario
  socket.on('register_user', (user) => {
    if (!user) return;

    // 🚫 ya registrado este socket
    if (socket.user && sockets.has(socket.id)) {
      console.warn(
        `[Chat][REGISTER][IGNORED] socket=${socket.id} ya registrado como ${socket.user}`
      );
      return;
    }

    clearTimeout(registerTimeout);

    sockets.set(socket.id, {
      user,
      trades: new Set()
    });

    socket.user = user;

    console.log(
      `[Chat][REGISTER] user=${user} socket=${socket.id}`
    );

    socket.emit('USER_REGISTERED', { user });
  });

  // 🔹 Unirse a una sala de trade
  socket.on('join_trade', ({ tradeId }) => {
    if (!tradeId || !socket.user) return;

    const room = `trade_${tradeId}`;
    socket.join(room);

    // 🧩 trade → sockets
    if (!tradeRooms.has(tradeId)) {
      tradeRooms.set(tradeId, new Map());
    }
    tradeRooms.get(tradeId).set(socket.id, socket.user);

    // 🧩 socket → trades
    if (!sockets.has(socket.id)) {
      sockets.set(socket.id, {
        user: socket.user,
        trades: new Set(),
      });
    }
    sockets.get(socket.id).trades.add(tradeId);

    // 🧩 pings por trade
    if (!tradePings.has(tradeId)) {
      tradePings.set(tradeId, new Map());
    }
    tradePings.get(tradeId).set(socket.id, {
      user: socket.user,
      lastPing: Date.now(),
    });

    console.log(
      `[JOIN][trade=${tradeId}] user=${socket.user} socket=${socket.id}`
    );

    io.to(room).emit('TRADE_USER_JOINED', {
      user: socket.user,
      tradeId,
    });
  });

  // 🔹 Enviar mensaje dentro de una sala
  socket.on('send_trade_message', async (payload) => {
    const { chat_id, sender, message, content_type, token, image } = payload;
    if (!chat_id || !sender ) return;
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

  socket.on('client_ping', ({ tradeId }) => {
    if (!tradeId) return;

    const INTERVAL = 60_000;
    const TOLERANCE = 5_000;
    const now = Date.now();

    const tradeMap = tradePings.get(tradeId);
    if (!tradeMap) return;

    const entry = tradeMap.get(socket.id);
    if (!entry) return;

    const diff = now - entry.lastPing;

     const timestamp = formatDate();

     if (diff < INTERVAL - TOLERANCE) {
      const msg =
        `[${timestamp}] [PING][trade=${tradeId}] FAST | user=${entry.user} socket=${socket.id} (${Math.floor(diff / 1000)}s)`;

      // console.warn(msg);
      logPing(msg);
      return;
    }

     entry.lastPing = now;

      const msg =
        `[${timestamp}] [PING][trade=${tradeId}] OK | user=${entry.user} socket=${socket.id}`;

      // console.log(msg);
      logPing(msg);
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
    const data = sockets.get(socket.id);
    if (!data) return;

    for (const tradeId of data.trades) {
      tradeRooms.get(tradeId)?.delete(socket.id);
      tradePings.get(tradeId)?.delete(socket.id);

      io.to(`trade_${tradeId}`).emit('TRADE_USER_LEFT', {
        user: data.user,
        tradeId
      });

      if (tradeRooms.get(tradeId)?.size === 0) {
        tradeRooms.delete(tradeId);
        tradePings.delete(tradeId);
      }
    }

    sockets.delete(socket.id);

    console.log(
      `[Chat] [DISCONNECT] user=${data.user} socket=${socket.id} limpiado`
    );
  });


  socket.on('leave_trade', ({ tradeId }) => {
    if (!tradeId || !socket.user) return;

    const socketData = sockets.get(socket.id);
    if (!socketData) return;

    const room = `trade_${tradeId}`;
    socket.leave(room);

    tradeRooms.get(tradeId)?.delete(socket.id);
    tradePings.get(tradeId)?.delete(socket.id);
    sockets.get(socket.id)?.trades.delete(tradeId);

    io.to(room).emit('TRADE_USER_LEFT', {
      user: socket.user,
      tradeId
    });

    
    console.log(
      `[LEAVE][trade=${tradeId}] user=${socket.user} socket=${socket.id}`
    );

    // 🧹 Limpieza si el trade queda vacío
    if (tradeRooms.get(tradeId)?.size === 0) {
      tradeRooms.delete(tradeId);
      tradePings.delete(tradeId);

      console.log(
        `[CLEAN][trade=${tradeId}] sala eliminada (vacía)`
      );
    }
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
