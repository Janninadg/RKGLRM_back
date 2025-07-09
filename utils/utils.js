import path from 'path';
import { fileURLToPath } from 'url';
import ffi from 'ffi-napi';
import ref from 'ref-napi';

// __dirname equivalente en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Ruta local al DLL
const dllPath = path.join(__dirname, 'CRCApi.dll');

// Definimos el puntero genérico a string
const charPtr = ref.types.CString;

// Mapeo de funciones del DLL
const lib = ffi.Library(dllPath, {
  // GetCrcFile: recibe (wchar_t* path) y devuelve char*
  // En Windows los WideString son UTF-16, que en Node.js usamos 'ucs2'
  GetCrcFile: [ charPtr, [ 'pointer' ] ],
  // FreeString: recibe char* y no devuelve nada
  FreeString: [ 'void', [ charPtr ] ]
});

/**
 * Llama a GetCrcFile del DLL para obtener el CRC de un fichero.
 * @param {string} filePath - Ruta absoluta al archivo.
 * @returns {string} El CRC en formato string de 8 hex dígitos.
 */
export const getCrcFileNative = (filePath) => {
  // Convertimos el JS string a un WideString (ucs2 + '\0')
  const widePath = Buffer.from(filePath + '\0', 'ucs2');

  // Llamamos al DLL
  const resultPtr = lib.GetCrcFile(widePath);
  if (ref.isNull(resultPtr)) {
    throw new Error('GetCrcFile devolvió puntero nulo');
  }

  // Leemos el C string devuelto (ASCII/UTF-8)
  const crc = ref.readCString(resultPtr, 0);

  return { ptr: resultPtr, crc };
};

/**
 * Libera la memoria que devolvió GetCrcFile.
 * @param {Buffer|number} ptr - El puntero que devolvió GetCrcFile.
 */
export const freeNativeString = (ptr) => {
  lib.FreeString(ptr);
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