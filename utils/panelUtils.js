import { Sequelize, Op } from 'sequelize';
import LogPanelGM from '../models/logPanelGMModel.js';
import TypeLogsGM from '../models/typeLogsGMModel.js';
import LogRewardsUser from '../models/logRewardUserModel.js';
import TypePrize from '../models/typePrizesModel.js';
import TypeOrigenReward from '../models/typeOrigenRewardModel.js';
import TypeEvents from '../models/typeEventsModel.js';
import LogStream from '../models/logStreamsModel.js';
import TypeLogsStreamers from '../models/typeLogsStreamersModel.js';
import { getFormatDate } from './utils.js';
import LogExchange from '../models/logExchanges.js';
import TempCupon from '../models/tempCupones.js';
import Cupon from '../models/cuponesModel.js';


const obtenerLogsGM = async () => {
  try {
    // Obtener todos los datos de la tabla LogPanelGM excepto la columna action
    const logGMData = await LogPanelGM.findAll({
        attributes: { exclude: ['action'] }
    });
  
    // Obtener el nombre correspondiente al tipo de cada registro en la columna type
    const typeNames = {};
    const typeLogs = await TypeLogsGM.findAll();
    typeLogs.forEach(typeLog => {
        typeNames[typeLog.id] = typeLog.tipo;
    });
    
    // Modificar los datos según las especificaciones
    const modifiedLogGMData = logGMData.map(log => {
        return {
            ID: log.id,
            Administrador: log.userAction,
            Accion: typeNames[log.type] ? typeNames[log.type] : '-',
            Usuario: log.user ? log.user : '-',
            Cantidad: log.amount ? log.amount  : '-',
            'Elemento generado': log.cupon ? log.cupon : '-',
            Fecha: getFormatDate(log.date),
            //...log.toJSON()
        };
    });

    return modifiedLogGMData;
  } catch (error) {
    console.error('Error al obtener los logs GM:', error);
    throw error;
  }
};

const obtenerLogsStreamers = async () => {
    try {
      // Obtener todos los datos de la tabla LogPanelGM excepto la columna action
      const logStreamersData = await LogStream.findAll({
          attributes: { exclude: ['action'] }
      });
    
      // Obtener el nombre correspondiente al tipo de cada registro en la columna type
      const typeNames = {};
      const typeLogs = await TypeLogsStreamers.findAll();
      typeLogs.forEach(typeLog => {
          typeNames[typeLog.id] = typeLog.tipo;
      });
      
      // Modificar los datos según las especificaciones
      const modifiedLogStreamer = logStreamersData.map(log => {
          return {
              ID: log.id,
              Streamer: log.user,
              Accion: typeNames[log.type] ? typeNames[log.type] : '-',
              Cantidad: log.prize ? log.prize  : '-',
              'Elemento generado': log.cupon ? log.cupon : '-',
              Fecha: getFormatDate(log.date),
              //...log.toJSON()
          };
      });
  
      return modifiedLogStreamer;
    } catch (error) {
      console.error('Error al obtener los logs de streamers:', error);
      throw error;
    }
  };

  const obtenerLogsExchanges = async () => {
    try {
      // Obtener todos los datos de la tabla LogPanelGM excepto la columna action
      const logSExData = await LogExchange.findAll();
    
      
      // Modificar los datos según las especificaciones
      const modifiedLogEx = logSExData.map(log => {
          return {
              ID: log.id,
              Usuario: log.user,
              Cash: log.cash,
              Oro: log.oro,
              Fecha: getFormatDate(log.date),
              //...log.toJSON()
          };
      });
  
      return modifiedLogEx;
    } catch (error) {
      console.error('Error al obtener los logs de Intercambios:', error);
      throw error;
    }
  };

  const obtenerLogsCupones = async () => {
    try {
      // Obtener todos los datos de la tabla LogPanelGM excepto la columna action
      const logSCuponesData = await TempCupon.findAll();
    
      
      // Modificar los datos según las especificaciones
      const modifiedLogCupones = logSCuponesData.map(log => {
          return {
              ID: log.id,
              Usuario: log.user,
             'Cupón canjeado': log.ticket,
              Fecha: getFormatDate(log.fecha),
              //...log.toJSON()
          };
      });
  
      return modifiedLogCupones;
    } catch (error) {
      console.error('Error al obtener los logs de cupones:', error);
      throw error;
    }
  };

const obtenerCuponesGenerados = async () => {
try {
    // Obtener todos los datos de la tabla LogPanelGM excepto la columna action
    const cuponesData = await Cupon.findAll();

    const typeRewardName = {};
      const typeReward = await TypePrize.findAll();
      typeReward.forEach(type => {
        typeRewardName[type.id] = type.tipo;
      });
    
    // Modificar los datos según las especificaciones
    const modifiedLogCupones = cuponesData.map(log => {
        return {
            ID: log.id,
            'Cupón': log.ticket,
            'Límite de redenciones': log.limite,
            'Cantidad canjeada': log.users,
            'Tipo de recompensa': typeRewardName[log.type] ? typeRewardName[log.type] : '-',
            Recompensa: log.id_prize,
            Nombre: log.name_prize,
            //Fecha: getFormatDate(log.fecha),
            //...log.toJSON()
        };
    });

    return modifiedLogCupones;
} catch (error) {
    console.error('Error al obtener el detalle de cupones generados:', error);
    throw error;
}
};


const obtenerLogsRecompensas = async () => {
    try {
      // Obtener todos los datos de la tabla LogPanelGM excepto la columna action
      const logRewardsData = await LogRewardsUser.findAll();
    
      // Obtener el nombre correspondiente al tipo de cada registro en la columna type
      const typeRewardName = {};
      const typeReward = await TypePrize.findAll();
      typeReward.forEach(type => {
        typeRewardName[type.id] = type.tipo;
      });

      const typeOrigenName = {};
      const typeOrigen = await TypeOrigenReward.findAll();
      typeOrigen.forEach(type => {
        typeOrigenName[type.id] = type.tipo;
      });

      const typeEventName = {};
      const typeEvents = await TypeEvents.findAll();
      typeEvents.forEach(type => {
        typeEventName[type.id] = type.tipo;
      });
      
      // Modificar los datos según las especificaciones
      const modifiedLogReward = logRewardsData.map(log => {
          return {
              ID: log.id,
              Usuario: log.user,
              'Obtenido en': typeOrigenName[log.origen] ? typeOrigenName[log.origen] : '-',
              Recompensa: log.recompensa,
              'Tipo de recompensa': typeRewardName[log.tipo_recompensa] ? typeRewardName[log.tipo_recompensa] : '-',
              'Evento': typeEventName[log.origen_2] ? typeEventName[log.origen_2] : '-',
              Fecha: getFormatDate(log.fecha),
              //...log.toJSON()
          };
      });
      
      return modifiedLogReward;
    } catch (error) {
      console.error('Error al obtener los logs de recompensas:', error);
      throw error;
    }
  };
  


export {obtenerLogsGM,obtenerLogsRecompensas,obtenerLogsStreamers,obtenerLogsExchanges,obtenerLogsCupones,obtenerCuponesGenerados};