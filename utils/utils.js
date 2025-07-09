import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

// __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Convertimos execFile a promesa
const execFileAsync = promisify(execFile);

/**
 * Ejecuta el archivo FileCrc.exe para obtener el serial/CRC de un archivo.
 * @param {string} filePath - Ruta absoluta del archivo a procesar.
 * @returns {Promise<string|null>} Serial ID en texto plano o null si falló.
 */
export const getSerialFromFile = async (filePath) => {
  try {
    // Ruta absoluta al ejecutable
    const exePath = path.join(__dirname, 'FileCrc.exe');

    // Ejecutamos el .exe con el archivo como argumento
    const { stdout } = await execFileAsync(exePath, [filePath]);

    const serial = stdout.trim();
    return serial;
  } catch (err) {
    console.error('Error al obtener serial desde FileCrc.exe:', err.message);
    return null;
  }
};

const getFormatDate = (isoDate) => {
    // Convertir la fecha de la base de datos a un objeto Date
    const date = new Date(isoDate);

    // Obtener los componentes de la fecha
    const day = String(date.getDate()).padStart(2, '0'); // Añadir ceros al día si es necesario
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Añadir ceros al mes si es necesario
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    // Formatear la fecha como DD/MM/YYYY HH:MM:SS
    const fechaFormateada = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

    return fechaFormateada;

}

const getDateMinusTimeZone = (date) => {
    // Convertir la fecha de la base de datos a un objeto Date
    // const date = new Date(isoDate);

    // Obtener la diferencia horaria actual del sistema en minutos
    const offsetMinutes = date.getTimezoneOffset();

    // Ajustar la fecha para que coincida con el horario:
    const adjustedDate = new Date(date.getTime() + (offsetMinutes * 60000));

    return adjustedDate;
}

const getDateAdjustedMeridiam = (date) => {
    // Convertir la fecha de la base de datos a un objeto Date
    // const date = new Date(isoDate);

    // Obtener la diferencia horaria actual del sistema en minutos
    const offsetMinutes = date.getTimezoneOffset();

    // Ajustar la fecha para que coincida con el horario:
    const adjustedDate = new Date(date.getTime() - (offsetMinutes * 60000));

    return adjustedDate;
}

export {getFormatDate,getDateMinusTimeZone,getDateAdjustedMeridiam};