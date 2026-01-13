import fs from 'fs';
import path from 'path';

const logDir = 'C:\\xampp\\htdocs\\files\\logs';
const logPath = path.join(logDir, 'chat-ping.log');

// Asegurar que el directorio exista
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const pingLogStream = fs.createWriteStream(logPath, {
  flags: 'a', // append
});

export function logPing(message) {
  pingLogStream.write(message + '\n');
}
