import ItemInfo from "../models/itemInfoModel.js";

const setClassName = (classitem) => {
    try {
        switch (classitem) {
           case 1:
            // Swordman
            return ' Swordman';
          case 2:
            // Archer
            return ' Archer';
          case 4:
            // Black
            return ' BlackSmith';
          case 8:
            // Mage
            return ' Mage';
          case 16:
            // Ninja
            return ' Ninja';
          default:
            return '';
        }
  
    } catch (error) {
      console.error(`Error al entregar premios:`, error);
      throw error;
    }
};

const setTypeName = (type) => {
    try {
        switch (type) {
           case 0:
            // Swordman
            return 'Helmet';
          case 1:
            // Archer
            return 'Armor';
          case 2:
            // Black
            return 'Shoulder';
          case 3:
            // Mage
            return 'Arms';
          case 4:
            // Ninja
            return 'Primary weapon';
          case 5:
            // Ninja
            return 'Secondary weapon';
          case 9:
            // Ninja
            return 'Cards';
          case 10:
            // Ninja
            return 'Set';
          case 11:
            // Ninja
            return 'Discount Card';
          case 12:
            // Ninja
            return 'Poison';
          case 13:
            // Ninja
            return 'Stone';
          case 14:
            // Ninja
            return 'Stone';
          default:
            return 'None';
        }
  
    } catch (error) {
      console.error(`Error al entregar premios:`, error);
      throw error;
    }
};

const getAmountItem = async (itemid,transaction) => {
  try {
    const itemData = await ItemInfo.findOne({
      attributes: ['type','hit2'],
      where: {
        id: itemid, // Cambia esto para usar el nombre de usuario correcto
      },
      transaction, // Asociar la transacción con esta consulta
    });

    if (!itemData) {
      await transaction.rollback(); // Revertir la transacción en caso de error
      return { success: false, code: '402', message: 'ID de Item no encontrado' };
    }

    switch (itemData.type) {
      case 12:
        return itemData.hit2;
        break;
    
      default:
        return 0;
        break;
    }

  } catch (error) {
    console.error(`Error al obtener datos del item ${itemid}:`, error);
    throw error;
  }
};

// Helper puro para calcular el power base de 0 días
// function computeBasePower() {
//   const equivalentDay = 1440;             // minutos en un día
//   const codigoBase7 = 1064269940 - 420;   // línea base de 7 días
//   const horaBase      = new Date("2023-07-03T01:20:00Z");
//   const nowLimaStr    = new Date().toLocaleString('en-US', { timeZone: 'America/Lima' });
//   const nowLima       = new Date(nowLimaStr);

//   // Diferencia en segundos desde la horaBase
//   const diffSec = Math.trunc((nowLima - horaBase) / 1000);

//   // A partir de 7 días, restamos 7 * equivalentDay para llevarlo a “0 días”
//   return codigoBase7 + diffSec - (7 * equivalentDay);
// }


const MS_PER_MIN = 60 * 1000;
const MINUTES_PER_DAY = 1440;

/**
 * To_Days equivalent: días enteros entre 0001-01-01 y la fecha dada.
 * Reproduce: DaysBetween(EncodeDate(1,1,1), ADateTime) + 365 + 1
 * @param {Date} date
 * @returns {number} número entero de días
 */
function toDays(date = new Date()) {
  // Fecha base 0001-01-01 (UTC)
  const base = Date.UTC(1, 0, 1); // año 1, mes 0 (enero), día 1
  // Fecha actual truncada a medianoche local (reproduce DaysBetween behavior)
  const cur = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((cur - base) / (24 * MS_PER_MIN * 60));
  // replicamos exactamente la corrección del Pascal (+365 + 1)
  return diffDays + 365 + 1;
}

/**
 * Base code sin añadir días: (To_Days(now)*24 + HourOf(now)) * 60 + MinuteOf(now)
 * @param {Date} date
 * @returns {number}
 */
function baseMinutesCode(date = new Date()) {
  const days = toDays(date);
  const hour = date.getHours();
  const minute = date.getMinutes();
  return (days * 24 + hour) * 60 + minute;
}

/**
 * Calcula el dayscode igual que en Pascal:
 * (To_Days(now)*24 + HourOf(now)) * 60 + MinuteOf(now) + (dias * GetMinOfDay)
 */
function computeDaysCodeAddDays(daysToAdd, date = new Date()) {
  return baseMinutesCode(date) + (daysToAdd * MINUTES_PER_DAY);
}

/**
 * calculatePowerUse: recibe powertime (minutes-code), y days (número de días a añadir).
 * - powertime por defecto = 0 (tal como pediste).
 * - si powertime está caducado (<= código base actual) -> reinicia desde now + days
 * - si no está caducado -> extiende sumando days en minutos
 *
 * Devuelve el nuevo powertime (número entero).
 */
const calculatePowerUse = async (powertime = 0, days = 0) => {
  return powertime;
  // valida parámetros
  const dias = Number(days) || 0;
  let pt = Number(powertime) || 0;

  // código base actual (sin días añadidos)
  const now = new Date();
  const baseNowCode = baseMinutesCode(now);
  const minutesToAdd = dias * MINUTES_PER_DAY;

  let newPowertime;
  if (pt === 0) {
    // sin powertime previo: iniciar desde ahora + days
    newPowertime = computeDaysCodeAddDays(dias, now);
  } else if (pt <= baseNowCode) {
    // expirado (o exactamente en el límite) -> reiniciar desde ahora + days
    newPowertime = computeDaysCodeAddDays(dias, now);
  } else {
    // no expirado -> extender sumando días en minutos (mantenemos misma "escala" de código)
    newPowertime = pt + minutesToAdd;
  }

  // devolver entero
  return Math.trunc(newPowertime);
};

export { calculatePowerUse,getAmountItem,setClassName,setTypeName };