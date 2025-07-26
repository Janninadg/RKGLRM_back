import Ticket from '../models/ticketsModel.js';
import Cash from '../models/cashModel.js';
import UserGameInfo from '../models/userGameInfoModel.js';
import PendingPresents from '../models/pendingPresentsModel.js';
import { Sequelize, Op, fn, col } from 'sequelize';
import sequelize from '../config/database.js';
import { verifyPacketAndBan } from '../utils/securityUtils.js';
import TicketOro from '../models/ticketsOroModel.js';
import UserItemInfo from '../models/userItemInfoModel.js';
import TempCupon from '../models/tempCupones.js';
import Cupon from '../models/cuponesModel.js';
import TokenSession from '../models/tokenSessionModel.js';
//import EventTickets from '../models/eventTicketsModel.js';
import LogRewardsUser from '../models/logRewardUserModel.js';
import TrackingPacket from '../models/trackingPacketModel.js';
import colors from "colors";

class EventService {

  async redeemCupon(paramsString,token,user,cupon,isDataIntegrityValid, req) {
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
        return { success: false, code: '300', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      // Obtener el tipo, nombre,uri:
      // Obtener el premio de la tabla rouletteprizes según orderPrize y tipo de evento:
      const cuponPrize = await Cupon.findOne({
        attributes: ['type', 'id_prize', 'name_prize', 'uri','limite','users'],
        where: {
          ticket: cupon,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });
  
      if (!cuponPrize) {
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '004', message: 'El cupón ingresado no existe' };
      }

      //console.log(cuponPrize);

      //Verificar si ya expiro:

      if (cuponPrize.limite <= cuponPrize.users) {
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '002', message: 'El cupón ingresado ya expiró' };
      }

      //Verificar si el usuario ya redimio anteriormente el cupon:

      const userRedeem = await TempCupon.findOne({
        attributes: ['id'],
        where: {
          user: user,
          ticket: cupon,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if (userRedeem) {
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '001', message: 'Ya canjeaste este cupón anteriormente' };
      }

      var typePrize = cuponPrize.type;
      var message;

      // Agregar el premio según el tipo
      switch (typePrize) {
        case 0:
          // Obtener el ID de usuario desde UserGameInfo por su nombre
          const userGameInfo = await UserGameInfo.findOne({
            attributes: ['id'],
            where: {
              name: user, // Cambia esto para usar el nombre de usuario correcto
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          if (!userGameInfo) {
            await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '202', message: 'ID de Usuario no encontrado' };
          }
          
          // Agregar el premio a PendingPresents usando el ID de usuario obtenido
          await PendingPresents.create(
            {
              present_id: cuponPrize.id_prize,
              user_id: userGameInfo.id, // Usar el ID de usuario obtenido
              added_time: new Date(),
            },
            {
              transaction: t, // Asociar la transacción con esta operación
            }
          );

          //console.log(res);

          message = `Has obtenido un(a) ${cuponPrize.name_prize}`;
          break;
        case 1:
           //Verificar que el usuario exista:
          const userGold = await UserGameInfo.findOne({
            attributes: ['id','gold'],
            where: {
              name: user, // Cambia esto para usar el nombre de usuario correcto
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          if (!userGold) {
            await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '004', message: 'Usuario no encontrado [GOLD: Comunicar con algún administrador]' };
          }

          // Actualizar el gold en UserGameInfo
          await UserGameInfo.increment(
            'gold',
            { by: cuponPrize.id_prize, where: { name: user }, transaction: t }
          );

          message = `Has obtenido ${cuponPrize.id_prize} de Oro`;
          break;
        case 2:
           //Verificar que el usuario exista:
          const userCash = await Cash.findOne({
            attributes: ['cash'],
            where: {
              id: user, // Cambia esto para usar el nombre de usuario correcto
            },
            transaction: t, // Asociar la transacción con esta consulta
          });
    
          if (!userCash) {
            await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '004', message: 'Usuario no encontrado [CASH: Comunicar con algún administrador]' };
          }

          // Actualizar el cash en Cash
          await Cash.increment(
            'cash',
            { by: cuponPrize.id_prize, where: { id: user }, transaction: t }
          );

          message = `Has obtenido ${cuponPrize.id_prize} de Cash`;
          break;
        case 3:
          // Actualizar el cash en Cash
          await Ticket.increment(
            'tickets',
            { by: cuponPrize.id_prize, where: { id: user }, transaction: t }
          );

          message = `Has obtenido ${cuponPrize.id_prize} ticket(s) de cash`;
          break;
        case 4:
            // Actualizar el cash en Cash
            await TicketOro.increment(
              'tickets',
              { by: cuponPrize.id_prize, where: { id: user }, transaction: t }
            );
    
            message = `Has obtenido ${cuponPrize.id_prize} ticket(s) de oro`;
            break;
        case 5:
          //Obtener id de usuario
          // Obtener el ID de usuario desde UserGameInfo por su nombre
          const userGame = await UserGameInfo.findOne({
            attributes: ['id'],
            where: {
              name: user, // Cambia esto para usar el nombre de usuario correcto
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          if (!userGame) {
            await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '202', message: 'ID de Usuario no encontrado' };
          }
          
          //Obtener el nro de slot mas cercano disponible
          // Obtener todos los slots distintos del usuario
          const distinctSlots = await UserItemInfo.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('slot')), 'slot']],
            where: {
              userid: userGame.id,
            },
            raw: true,
            transaction: t,
          });

          // Mapear los resultados a un array de números
          const distinctSlotsArray = distinctSlots.map((item) => item.slot)
          var slotFree = null;

          //console.log(distinctSlotsArray);

          for (let i = 0; i <= 89; i++) {
            if (!distinctSlotsArray.includes(i)) {
              slotFree = i;
              break;
            }
          }
          //console.log(slotFree);
          //Si no hay, volver a enviar el mensaje de slot no disponible
          if(slotFree === null){
            await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '003', message: 'No tiene slots disponbiles para canjear el premio' };
          }


          //Si tiene, guardar el premio temporal en useriteminfo
          await UserItemInfo.create(
            {
              userid: userGame.id,
              itemid: cuponPrize.id_prize,
              slot: slotFree,
              limittime: 0,
            },
            {
              transaction: t, // Asociar la transacción con esta operación
            }
          );

          message = `Has obtenido un(a) ${cuponPrize.name_prize} temporal`;
          break;
        default:
          await t.rollback(); // Revertir la transacción en caso de error
          return { success: false, code: '201', message: 'Tipo de premio no válido' };
      }

      await Cupon.increment(
        'users',
        { by: 1, where: { ticket: cupon }, transaction: t }
      );

      await TempCupon.create(
        {
          user: user,
          ticket: cupon,
          fecha: new Date()
        },
        {
          transaction: t, // Asociar la transacción con esta operación
        }
      );

      await LogRewardsUser.create({  
        user:user,
        origen:13,
        recompensa:cuponPrize.id_prize,
        tipo_recompensa: typePrize,
        fecha: new Date(), 
      }, { transaction: t });

      //const key = generateKey();
      //const MnOpQr = encrypt(JSON.stringify(cuponPrize), key) + '-' + key;

      await t.commit(); // Confirmar la transacción si todas las operaciones tienen éxito

      return { success: true, code: '000', message };
    
    }
    catch (error) {
        await t.rollback();
        throw new Error('Error al canjear cupón');
    }
  } 

  
}

export default new EventService();