import net from 'net';

// Lista para almacenar clientes conectados
const clientesActivos = new Map(); // { id: socket }

let clientIdCounter = 1; // Contador para asignar ID único

const server = net.createServer((socket) => {
    const clientId = clientIdCounter++;
    clientesActivos.set(clientId, socket);

    console.log(`[Servidor] Cliente ${clientId} conectado.`);

    //socket.write(JSON.stringify({ message: "Conexión establecida", clientId }));

    // Crear el mensaje de bienvenida y enviarlo al cliente
    // const mensajeInicial = {idgm: 1, message: 'Hola, este es un mensaje de GM', type: 1};
    // const mensajeInicial2 = {idgm: 1, message: 'Hola, este es un mensaje de GM', type: 2,users:''};
    // const mensajeInicial3 = {idgm: 1, message: 'Hola, este es un mensaje de GM', type: 3,};

    // Enviar el mensaje en formato JSON
    socket.write(JSON.stringify(mensajeInicial));

    // Manejar mensajes recibidos desde el cliente
    socket.on('data', (data) => {
        console.log(`[Cliente ${clientId}] Mensaje recibido:`, data.toString());
    });

    // Manejar desconexión del cliente
    socket.on('close', () => {
        console.log(`[Servidor] Cliente ${clientId} desconectado.`);
        clientesActivos.delete(clientId);
    });

    socket.on('error', (err) => {
        console.log(`[Servidor] Error con el cliente ${clientId}:`, err.message);
        clientesActivos.delete(clientId);
    });
});

// Iniciar el servidor en el puerto 40318
const PORT = 40318;
server.listen(PORT, () => {
    console.log(`[Servidor] Escuchando en el puerto ${PORT}...`);
});

// Función para enviar mensaje a un cliente específico
export function enviarMensajeACliente(id, mensaje) {
    return new Promise((resolve, reject) => {
      const socket = clientesActivos.get(id);
      if (socket) {
        // Convertir el mensaje a JSON y a buffer
        const mensajeJSON = JSON.stringify(mensaje);
        const msgBuffer = Buffer.from(mensajeJSON, 'utf8');
        const sizeBuffer = Buffer.alloc(4);
        sizeBuffer.writeUInt32BE(msgBuffer.length, 0);
  
        // Creamos un temporizador de 6 segundos
        const timeout = setTimeout(() => {
          console.error(`[Servidor] Error: Timeout esperando respuesta del cliente ${id}.`);
          reject({
            success: false,
            code: '999',
            message: `Cliente activo pero no respondió en el tiempo esperado (6s).`
          });
        }, 6000);

        socket.once('data', (data) => {
          clearTimeout(timeout); // Si responde, cancelamos el timeout
          const respuesta = data.toString('utf8');
          console.log(`[Servidor] Respuesta del cliente ${id}:`, respuesta);
          resolve(respuesta);
        });
  
        // Enviar primero el tamaño (si tu protocolo lo requiere) y luego el mensaje
        // socket.write(sizeBuffer);
        socket.write(msgBuffer);
        console.log(`[Servidor] Mensaje enviado a Cliente ${id}: ${mensajeJSON}`);
      } else {
      console.error(`[Servidor] Error: Cliente ${id} no está activo.`);
      reject({
        success: false,
        code: '999',
        message: `Cliente no activo, no se puede enviar mensaje.`
      });
    }
    });
  }

// Función para obtener la lista de clientes activos
export function obtenerClientesActivos() {
    return Array.from(clientesActivos.keys());
}
