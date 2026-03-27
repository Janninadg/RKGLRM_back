import fs from 'fs';
import path from 'path';
import socketLockManager from './socketLockManager.js';
import { CHAT_CRITICAL_ACTIONS } from './socketLockConfig.js';

// 📂 Ruta base (misma que usas)
const basePath = 'C:/xampp/htdocs/files';
const logDir = path.join(basePath, 'logs');
const logFile = path.join(logDir, 'chat_actions_logs.log');

// crear carpeta si no existe
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 📝 escribir archivo
function writeToFile(message) {
  fs.appendFile(logFile, message + '\n', (err) => {
    if (err) {
      console.error('Error escribiendo log:', err);
    }
  });
}

// 🧾 log normal
export function logSocket(msg) {
  console.log(msg);
  writeToFile(msg);
}

function nowText() {
  return new Date().toISOString();
}

// 🎨 formateador de tabla bonita
function formatTable(rows) {
  if (!rows.length) return '(sin solicitudes activas)';

  const headers = ['key', 'user', 'action', 'description', 'createdAt'];

  const data = rows.map(r => ({
    key: r.key,
    user: r.user,
    action: r.solicitud,
    description: r.desc || '',
    createdAt: r.createdAt instanceof Date
      ? r.createdAt.toISOString()
      : r.createdAt
  }));

  const colWidths = headers.map(h =>
    Math.max(
      h.length,
      ...data.map(row => String(row[h] ?? '').length)
    )
  );

  const pad = (str, len) => str + ' '.repeat(len - str.length);

  let output = '';

  // header
  output += headers.map((h, i) => pad(h, colWidths[i])).join(' | ') + '\n';

  // separador
  output += colWidths.map(w => '-'.repeat(w)).join('-|-') + '\n';

  // filas
  data.forEach(row => {
    output += headers
      .map((h, i) => pad(String(row[h] ?? ''), colWidths[i]))
      .join(' | ') + '\n';
  });

  return output;
}

// 📊 imprimir locks (console + file)
export function printSocketLocks(formatDate) {
  const rows = socketLockManager.getLocks();

  const title = `[${formatDate}] Solicitudes críticas (SOCKET):`;

  // consola
  console.log('\n' + title);
  console.table(rows);

  // archivo
  let text = '\n' + title + '\n';

  if (!rows.length) {
    text += '(sin solicitudes activas)\n';
  } else {
    text += formatTable(rows);
  }

  writeToFile(text);
}

// 🔑 key builder
export function buildSocketLockKey(user, action) {
  if (!user || !action) return null;

  const config = CHAT_CRITICAL_ACTIONS.get(action);

  if (!config) return `${user}:${action}`;

  if (config.exclusiveGroup) {
    return `${user}:GROUP:${config.exclusiveGroup}`;
  }

  return `${user}:ACTION:${action}`;
}