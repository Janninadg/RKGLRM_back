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
function computeBasePower() {
  const equivalentDay = 1440;             // minutos en un día
  const codigoBase7 = 1064269940 - 420;   // línea base de 7 días
  const horaBase      = new Date("2023-07-03T01:20:00Z");
  const nowLimaStr    = new Date().toLocaleString('en-US', { timeZone: 'America/Lima' });
  const nowLima       = new Date(nowLimaStr);

  // Diferencia en segundos desde la horaBase
  const diffSec = Math.trunc((nowLima - horaBase) / 1000);

  // A partir de 7 días, restamos 7 * equivalentDay para llevarlo a “0 días”
  return codigoBase7 + diffSec - (7 * equivalentDay);
}


const calculatePowerUse = async (powertime, days) => {
  const equivalentDay = 1440;
  // 1) obtenemos el power de base (0 días) sin recursión
  const basePower = computeBasePower();

  // 2) si el powertime es “antiguo” (< basePower), resetéalo
  if (powertime <= basePower) {
    powertime = 0;
  }

  // 3) si partimos de cero, volvemos a calcular desde la horaBase
  if (powertime === 0) {
    const codigoBase7 = 1064269940 - 420;
    const horaBase      = new Date("2023-07-03T01:20:00Z");
    const nowLimaStr    = new Date().toLocaleString('en-US', { timeZone: 'America/Lima' });
    const nowLima       = new Date(nowLimaStr);
    const diffSec       = Math.trunc((nowLima - horaBase) / 1000);

    let result = codigoBase7 + diffSec;

    if (days === 7) {
      // ya está en 7 días
    } else if (days < 7) {
      result -= (7 - days) * equivalentDay;
    } else {
      result += (days - 7) * equivalentDay;
    }

    return result;
  }

  // 4) si ya tenemos powertime > 0, simplemente lo desplazamos
  return powertime + days * equivalentDay;
};

  export { calculatePowerUse,getAmountItem,setClassName,setTypeName };