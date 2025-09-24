
import { Sequelize,Op } from 'sequelize';
import sequelize from '../config/database.js';
import { verifyPacketAndBan } from '../utils/securityUtils.js';
import { encrypt,generateKey } from '../helpers/encryption.js';
import PanelGM from '../models/gmPanelModel.js';
import UserGameInfo from '../models/userGameInfoModel.js';
import Banlist from '../models/banListModel.js';
import Cash from '../models/cashModel.js';
import TrackingPacket from '../models/trackingPacketModel.js';
import ItemInfo from '../models/itemInfoModel.js';
import Cupon from '../models/cuponesModel.js';
import InitialIpUser from '../models/ipUserModel.js';
import Streamer from '../models/streamersModel.js';
import LogStream from '../models/logStreamsModel.js';
import TokenSession from '../models/tokenSessionModel.js';
import UsersPanel from '../models/usersPanelModel.js';

class StreamersService {
    async verifyIsStreamer(user) {
        try {
          const existGM = await Streamer.findOne({
            attributes:['id'],
            where:{
              user: user
            }
          });

          //console.log(existGM);

          return existGM ? 'true' : 'false';
        } catch (error) {
          throw new Error('Error al verificar si es Streamer');
        }
      }

      async setCupon(token,data,user,isDataIntegrityValid,paramsString, req) {
        const t = await sequelize.transaction();
      
        try {
    
          // Verificar el paquete utilizando la clase PacketVerifier
    
          const verifyPacketEqual = (isDataIntegrityValid); //&& (userId === userId2) && ((ticketCount+operator) === resOp) && (ticketCount === ticketCount2) && (key1 === key2);
          const banInfo = await verifyPacketAndBan(user,user, paramsString, verifyPacketEqual, t, req);
    
          console.log(banInfo);
    
          if (banInfo) {
            await t.rollback(); // Revertir la transacción en caso de error
            return banInfo;
          }
    
          const trx = await sequelize.transaction(); 
          // Si la cadena de parámetros no existe, insertarla en trackingpacket
          await TrackingPacket.create(
            {
              packet: paramsString,
              user: user,
              fecha_uso: new Date(),
            },
            {
              transaction: trx, // Asociar la transacción con esta operación
            }
          );
    
          await trx.commit(); 

          // Verificar token:
          const sessionToken = await TokenSession.findOne({
            attributes: ['token'],
            where: {
              token: token,
              id: user,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          if(!sessionToken){
            await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '005', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
          }
    
          const name = data._pn;
          const limit = Number(data.lm);
          const cupon = data.cp;
          const prize = parseInt(data._prc,10);
          const tipoCupon = parseInt(data.sc,10);
          const type = tipoCupon === 0 ? 2 : (Number(data._tc) === 2 ? 0 :Number(data._tc)+1);
    
          //Verificar si es GM otra vez:
        const existSt = await UsersPanel.findOne({
          attributes:['id'],
          where:{
            user: user,
            type: 1,
          },
          transaction: t,
        });

        if(!existSt){
          await t.rollback();
          return {
            success: false,
            code: '001',
            message: 'Usted no puede realizar ninguna acción porque ya no es Streamer, esta sesión será cerrada...'
          };
        
        }

        if(type === 0){
          //console.log(prize);
          const itemData = await ItemInfo.findOne({
            attributes: ['type'],
            where: {
              id: prize, // Cambia esto para usar el nombre de usuario correcto
            },
            transaction: t, // Asociar la transacción con esta consulta
          });
  
          //console.log(itemData);
      
          if (!itemData) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.log("!![Streamer Panel]".red,' Item ID ingresado no existe'.red);
            return { success: false, code: '003',message:'¡El item ID ingresado no existe!' };
          }
          //console.log(1);
        }

          //Verificar nro de cupones generados al dia por streamer...
          // Obtener la fecha actual
            const fechaActual = new Date();
            // Establecer la fecha al principio del día actual
            fechaActual.setHours(0, 0, 0, 0);
            
            // Obtener la fecha al final del día actual
            const fechaFin = new Date();
            fechaFin.setHours(23, 59, 59, 999);

            // Contar el número de cupones generados por el usuario en el día actual y el tipo específico
    
            const cuponesGenerados = await LogStream.count({
            where: {
                user: user,
                type: tipoCupon,
                date: {
                    [Op.between]: [fechaActual, fechaFin],
                },
            },  transaction: t
            });
            //console.log(cuponesGenerados);
            

            // Establecer límites según el tipo de cupón
            var limite;
            var codigoError='005';
            var msg='';

          switch (tipoCupon) {
            case 0:
                limite = 2;
                codigoError = '003';
                msg='No puedes generar más de 2 cupones para torneos en un día. Espera hasta mañana...';
                break;
            case 1:
                limite = 6;
                codigoError = '004';
                msg='No puedes generar más de 6 cupones para viewers en un día. Espera hasta mañana...';
                break;
            }
    
            // Verificar si el usuario supera el límite permitido
            // if (cuponesGenerados >= limite) {
            //     await t.rollback();
            //     return {
            //         success: false,
            //         code: codigoError,
            //         message: msg,
            //       };
             
            // }

          //Crear Log de cupon
          await LogStream.create(
            {
              action:'Generacion de cupon - '+ (type === 1 ? 'Gold' : (type===2 ? 'Cash' : 'Item')),
              user: user,
              prize: prize,
              type: tipoCupon,
              cupon:cupon,
              date: new Date(),
            },
            {
              transaction: t, // Asociar la transacción con esta operación
            }
          );

          //Crear cupon
    
          await Cupon.create(
            {
              name_prize: name,
              limite: limit,
              ticket:cupon,
              type:type,
              id_prize:prize,
              uri:'',
            },
            {
              transaction: t, // Asociar la transacción con esta operación
            }
          );
    
          await t.commit();
          
          return {
            success: true,
            code: '000',
            message:'Se ha generado el cupon '+cupon+' correctamente'
          };
        
        }
        catch (error) {
            console.error('Error al contar los cupones:', error);
            await t.rollback();
            throw new Error('Error al generar cupon');
            //console.log(error);
        }
    }

}

export default new StreamersService();