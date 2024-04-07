
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
import LogPanelGM from '../models/logPanelGMModel.js';
import CharacterInfo from '../models/characterInfo.js';
import TokenSession from '../models/tokenSessionModel.js';
import UsersPanel from '../models/usersPanelModel.js';
import config from '../config/config.js';
import { signToken } from '../utils/authUtils.js';
import Blackout from '../models/blackoutModel.js';
import ClanInfo from '../models/clanInfoModel.js';
import { calculatePowerUse } from '../utils/prizesUtils.js';
import LogRewardsUser from '../models/logRewardUserModel.js';
import LogStream from '../models/logStreamsModel.js';
import LogExchange from '../models/logExchanges.js';
import TempCupon from '../models/tempCupones.js';
import { obtenerCuponesGenerados, obtenerLogsCupones, obtenerLogsExchanges, obtenerLogsGM, obtenerLogsRecompensas, obtenerLogsStreamers } from '../utils/panelUtils.js';

class GMPanelService {
    async verifyIsGM(user) {
        try {
          const existGM = await PanelGM.findOne({
            attributes:['id'],
            where:{
              user: user
            }
          });

          //console.log(existGM);

          return existGM ? 'true' : 'false';
        } catch (error) {
          throw new Error('Error al verificar si es GM');
        }
      }

      async getUserstoBan(user,token) {
        try {

           // Verificar token:
           const sessionToken = await TokenSession.findOne({
            attributes: ['token'],
            where: {
              token: token,
              id: user,
            },
            //transaction: t, // Asociar la transacción con esta consulta
          });

          if(!sessionToken){
            //await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
          }

          const users = await UserGameInfo.findAll({
            where: { ban: 0 },
            attributes: ['id','name','gold'],
          });

           // Mapear los usuarios a un nuevo array con índice y preparar la información
          const usersWithCharacters = [];

          for (const user of users) {
              // Obtener los nombres de personajes del usuario de la tabla characterinfo
              const characters = await CharacterInfo.findAll({
                  where: { userid: user.id },
                  attributes: ['name'],
              });

              // Mapear los nombres de personajes
              const characterNames = characters.map((character) => character.name);


              //Obtener cash
              const cashUser = await Cash.findOne({
                where: { id: user.name },
                attributes: ['cash'],
              });

              //console.log(cashUser);

              // Agregar la información completa del usuario
              usersWithCharacters.push({
                  id: user.id,
                  name: user.name,
                  personajes: characterNames,
                  gold: user.gold,
                  cash: cashUser === null ? 0 :cashUser.cash,
              });
          }

          // Mapear los usuarios a un nuevo array con índice
            const usersWithIndex = usersWithCharacters.map((user, index) => ({
                id: index + 1, // Ajustar el índice según tus necesidades
                name: user.name,
                personajes: user.personajes,
                gold:user.gold,
                cash:user.cash,
            }));
        
            return {success:true,code:'000',message:'ok',_lu:usersWithIndex};
    
          //return users;
        } catch (error) {
          console.error('Error al obtener usuarios:', error);
          throw new Error('Error interno del servidor');
        }
      }

      async getUsersName(user,token) {
        try {

           // Verificar token:
           const sessionToken = await TokenSession.findOne({
            attributes: ['token'],
            where: {
              token: token,
              id: user,
            },
            //transaction: t, // Asociar la transacción con esta consulta
          });

          if(!sessionToken){
            //await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
          }

          const users = await UserGameInfo.findAll({
            where: { ban: 0 },
            attributes: ['name'],
          });

          const namesArray = users.map(user => user.name);
        
            return {success:true,code:'000',message:'ok',_lun:namesArray};
    
          //return users;
        } catch (error) {
          console.error('Error al obtener usuarios:', error);
          throw new Error('Error interno del servidor');
        }
      }

      async getPersonajes(user,token) {
        try {

           // Verificar token:
           const sessionToken = await TokenSession.findOne({
            attributes: ['token'],
            where: {
              token: token,
              id: user.user,
            },
            //transaction: t, // Asociar la transacción con esta consulta
          });

          if(!sessionToken){
            //await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
          }

          const userGame = await UserGameInfo.findOne({
            attributes: ['id'],
            where: {
              name: user.asociado, // Cambia esto para usar el nombre de usuario correcto
            },
            //transaction: t, // Asociar la transacción con esta consulta
          });

          const personajes = await CharacterInfo.findAll({
            where: { userid: userGame.id },
            attributes: ['id','name'],
          });

          //const namesArray = users.map(user => user.name);
        
            return {success:true,code:'000',message:'ok',_lpr:personajes};
    
          //return users;
        } catch (error) {
          console.error('Error al obtener usuarios:', error);
          throw new Error('Error interno del servidor');
        }
      }

      async getClanes(user,token) {
        try {

           // Verificar token:
           const sessionToken = await TokenSession.findOne({
            attributes: ['token'],
            where: {
              token: token,
              id: user,
            },
            //transaction: t, // Asociar la transacción con esta consulta
          });

          if(!sessionToken){
            //await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
          }

          // Verificar si todos los miembros de members existen en usergameinfo
          const clanes = await ClanInfo.findAll({
            attributes: ['id','name'],
            //transaction: t,
          });
              
            return {success:true,code:'000',message:'ok',_lc:clanes};
    
          //return users;
        } catch (error) {
          console.error('Error al obtener usuarios:', error);
          throw new Error('Error interno del servidor');
        }
      }

      async getLogs(user,token) {
        try {

           // Verificar token:
           const sessionToken = await TokenSession.findOne({
            attributes: ['token'],
            where: {
              token: token,
              id: user,
            },
            //transaction: t, // Asociar la transacción con esta consulta
          });

          if(!sessionToken){
            //await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
          }

          //Logs GMS:
          // const _loggm = await LogPanelGM.findAll();
          const _loggm = await obtenerLogsGM();
          const _flgm = ['number','text','type','text','number','text','date'];
          //Logs Streamers
          const _logst = await obtenerLogsStreamers();//LogStream.findAll();
          const _flst = ['number','text','type','number','text','date'];
          //Logs Rewards
          const _logrw = await obtenerLogsRecompensas(); //await LogRewardsUser.findAll();
          const _flrw = ['number','text','type','number','type','type','date'];
          //Logs Cambios
          const _logex = await obtenerLogsExchanges();//LogExchange.findAll();
          const _flex = ['number','text','number','number','date'];
          //Logs Cupones
          const _logcp = await obtenerLogsCupones();//TempCupon.findAll();
          const _flcp = ['number','text','text','date'];
          //Cupones generados:
          const _cpg = await obtenerCuponesGenerados();//Cupon.findAll();
          const _fcp = ['number','text','number','number','type','number','text'];

          const logsNames = ['Log Cupones','Cupones generados','Log Cash/Oro','Log GM','Log de Recompensas','Log Streamers'];
              
          return {success:true,code:'000',message:'ok',logs:[_logcp,_cpg,_logex,_loggm,_logrw,_logst],lgn:logsNames,
          fltlogs:[_flcp,_fcp,_flex,_flgm,_flrw,_flst]  
        };
    
          //return users;
        } catch (error) {
          console.error('Error al obtener logs:', error);
          throw new Error('Error interno del servidor');
        }
      }

      async banUsers(token,data,user,isDataIntegrityValid,paramsString, req) {
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
            return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
          }

          const reason = data.reason;
          const users = data.users;

          //Verificar si es GM otra vez:
          const existGM = await UsersPanel.findOne({
            attributes:['id'],
            where:{
              user: user,
              [Op.or]: [{ type: 0 }, { type: 9 }],
            },
            transaction: t,
          });

          if(!existGM){
            await t.rollback();
            return {
              success: false,
              code: '001',
              message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
            };
          
          }

          for (const u of users) {
            //[Obtener ip si esta registrada]
            const ipUser = await InitialIpUser.findOne({ attributes: ['ip'], where: { user: u.name },transaction: t, });
            const ip = ipUser ? ipUser.ip : null;
            // Insertar un nuevo registro en la tabla "banlist" en una transacción separada
            await Banlist.create({
                UserID: u.name, // Ajustar el campo apropiado de la tabla "banlist"
                Reason: reason,
                userAction: user,
                UserIP: ip,
              }, { transaction: t });

            // Modificar la tabla "usergameinfo" para cambiar el estado de la columna "ban" a 1 en la misma transacción
            await UserGameInfo.update(
                { ban: 1, 
                  BanReason:reason, 
                  bandate:new Date()
                },
                {
                    where: { name: u.name },
                    transaction: t,
                }
            );

            //Insertar en LOG
            await LogPanelGM.create(
              {
                userAction:user,
                action: 'Baneo',
                user: u.name,
                type:0,
                date: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );
          }

          await t.commit();
          
          return {
            success: true,
            code: '000',
            message:'Se banearon a los usuarios seleccionados correctamente'
          };
        
        }
        catch (error) {
            await t.rollback();
            throw new Error('Error al banear usuarios');
        }
    }

    async recargaCash(token,data,user,isDataIntegrityValid,paramsString, req) {
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
          return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
        }

        const cash = Number(data.c);
        const oro = Number(data.o);
        const users = data._lu;
        const tipo = data.trx;

        //Verificar si es GM otra vez:
        const existGM = await UsersPanel.findOne({
          attributes:['id'],
          where:{
            user: user,
            [Op.or]: [{ type: 0 }, { type: 9 }],
          },
          transaction: t,
        });

        if(!existGM){
          await t.rollback();
          return {
            success: false,
            code: '001',
            message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
          };
        
        }

        var usersNoGold = [];
        var usersNoCash = [];

        var lowOro = [];
        var lowCash = [];

        for (const u of users) {

          //Verificar que el usuario exista:
          const userGold = await UserGameInfo.findOne({
            attributes: ['id','gold'],
            where: {
              name: u.name, // Cambia esto para usar el nombre de usuario correcto
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          if(!userGold){
            usersNoGold.push(u.name);
          }

          const userCash = await Cash.findOne({
            attributes: ['cash'],
            where: {
              id: u.name, // Cambia esto para usar el nombre de usuario correcto
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          if(!userCash){
            usersNoCash.push(u.name);
          }

          // Actualizar el cash en Cash
          if(cash>0){

            if(tipo === 1){
              await Cash.increment(
                'cash',
                { by: cash, where: { id: u.name  }, transaction: t }
              );
            } else {
              //Descuento...
              const uc = await Cash.findOne({
                attributes: ['id', 'cash'],
                where: {
                  id: u.name, // Cambia esto para usar el nombre de usuario correcto
                  cash: {
                    [Op.lte]: (cash-1), // Verifica que gold sea menor o igual a 4999
                  },
                },
                transaction: t, // Asociar la transacción con esta consulta
              });

              if (uc) {
                lowCash.push(u.name);
              } else{
                await Cash.decrement(
                  'cash',
                  { by: cash, where: { id: u.name  }, transaction: t }
                );
              }

            }
             //Insertar en LOG
            await LogPanelGM.create(
              {
                userAction:user,
                action: tipo === 1 ?'Recarga Cash':'Descuento Cash',
                user: u.name,
                amount: cash,
                type: 2,
                date: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );

            await LogRewardsUser.create({  
              user:u.name,
              origen:tipo === 1 ? 2 : 3,
              recompensa:tipo === 1 ? cash: (cash*-1),
              tipo_recompensa: 2,
              fecha: new Date(), 
            }, { transaction:t });
          }

          if(oro>0){

            if(tipo === 1){   
              await UserGameInfo.increment(
                'gold',
                { by: oro, where: { name: u.name  }, transaction: t }
              );
            } else {
              //Descuento...
              const ug = await UserGameInfo.findOne({
                attributes: ['id', 'gold'],
                where: {
                  name: u.name, // Cambia esto para usar el nombre de usuario correcto
                  gold: {
                    [Op.lte]: (oro-1), // Verifica que gold sea menor o igual a 4999
                  },
                },
                transaction: t, // Asociar la transacción con esta consulta
              });

              if (ug) {
                lowOro.push(u.name);
              } else{
                await UserGameInfo.decrement(
                  'gold',
                  { by: oro, where: { name: u.name  }, transaction: t }
                );
              }
            }

            await LogRewardsUser.create({  
              user:u.name,
              origen:tipo === 1 ? 2 : 3,
              recompensa:tipo === 1 ? oro: (oro*-1),
              tipo_recompensa: 1,
              fecha: new Date(), 
            }, { transaction:t });

            await LogPanelGM.create(
              {
                userAction:user,
                action: tipo === 1 ? 'Recarga Gold' : 'Descuento Gold',
                user: u.name,
                amount: oro,
                type: 1,
                date: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );
          }

        }

        if(lowCash.length > 0 && lowOro.length>0){
          const low = lowCash.concat(lowOro);
          await t.rollback(); // Revertir la transacción en caso de error
          return { success: false, code: '002', message: 'Los siguientes usuario(s) '+JSON.stringify(low)+' no tienen suficiente Cash u Oro para descontar' };
        }

        if(lowOro.length > 0){
          await t.rollback(); // Revertir la transacción en caso de error
          return { success: false, code: '002', message: 'Los siguientes usuario(s) '+JSON.stringify(lowOro)+' no tienen Gold suficiente para ser descontado' };
        }

        if(lowCash.length > 0){
          await t.rollback(); // Revertir la transacción en caso de error
          return { success: false, code: '002', message: 'Los siguientes usuario(s) '+JSON.stringify(lowCash)+' no tienen Cash suficiente para ser descontado' };
        }

        if (usersNoGold.length > 0) {
          await t.rollback(); // Revertir la transacción en caso de error
          return { success: false, code: '002', message: 'Usuario(s) '+JSON.stringify(usersNoGold)+' no encontrado [GOLD: Comunicar con algún administrador]' };
        }

        
        if (usersNoCash.length > 0) {
          await t.rollback(); // Revertir la transacción en caso de error
          return { success: false, code: '003', message: 'Usuario(s) '+JSON.stringify(usersNoCash)+' no encontrado [CASH: Comunicar con algún administrador]' };
        }
        

        await t.commit();
        
        return {
          success: true,
          code: '000',
        };
      
      }
      catch (error) {
          await t.rollback();
          throw new Error('Error al recargar');
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
        return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      const name = data._pn;
      const limit = Number(data.lm);
      const cupon = data.cp;
      const type = Number(data._tc);
      const prize = parseInt(data._prc,10);

      //Verificar si es GM otra vez:
      const existGM = await UsersPanel.findOne({
        attributes:['id'],
        where:{
          user: user,
          [Op.or]: [{ type: 0 }, { type: 9 }],
        },
        transaction: t,
      });

      if(!existGM){
        await t.rollback();
        return {
          success: false,
          code: '001',
          message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
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
          return { success: false, code: '003',message:'¡El item ID ingresado no existe!' };
        }
        //console.log(1);
      }

      //Insertar en LOG
      await LogPanelGM.create(
        {
          userAction:user,
          action: 'Generar Cupón',
          cupon:cupon,
          type:3,
          date: new Date(),
        },
        {
          transaction: t, // Asociar la transacción con esta operación
        }
      );

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
        await t.rollback();
        throw new Error('Error al generar cupon');
    }
}

  async createClan(user,token,clan,master,members) {
    const t = await sequelize.transaction();

    try {

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
        return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      //Verificar si es GM otra vez:
      const existGM = await UsersPanel.findOne({
        attributes:['id'],
        where:{
          user: user,
          [Op.or]: [{ type: 0 }, { type: 9 }],
        },
        transaction: t,
      });

      if(!existGM){
        await t.rollback();
        return {
          success: false,
          code: '001',
          message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
        };
      
      }

      // Verificar si el nombre del clan ya existe:
      const existingClan = await ClanInfo.findOne({
        attributes: ['id'],
        where: {
          name: clan,
        },
        transaction: t,
      });

      if (existingClan) {
        await t.rollback();
        return { success: false, code: '204', message: 'Ya existe un clan con el mismo nombre' };
      }

      // Verificar si existe el master:

      const usergetId = await UserGameInfo.findOne({
        attributes:['id'],
        where:{
          name: master
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if (!usergetId) {
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '202', message: 'ID del Master no existe' };
      }

      // Verificar si el usuario master ya es master de otro clan:
      const masterInAnotherClan = await ClanInfo.findOne({
        attributes: ['id'],
        where: {
          masterid: usergetId.id,
        },
        transaction: t,
      });

      if (masterInAnotherClan) {
        await t.rollback();
        return { success: false, code: '205', message: 'El usuario ya es master de otro clan' };
      }

      // Obtener el número de clanes creados
      const numberOfClans = await ClanInfo.count({
        transaction: t,
      });

      // Verificar si todos los miembros de members existen en usergameinfo
      const membersExist = await UserGameInfo.findAll({
        attributes: ['name'],
        where: {
          name: members,
        },
        transaction: t,
      });

      const membersExistNames = membersExist.map(member => member.name);

      const missingMembers = members.filter(member => !membersExistNames.includes(member));

      if (missingMembers.length > 0) {
        await t.rollback();
        return { success: false, code: '203', message: `No existen los ID's de los siguientes miembros: [${missingMembers.join(', ')}]` };
      }

      //Insertar en ClanInfo
      const newClan = await ClanInfo.create(
        {
          masterid:usergetId.id,
          mastername: master,
          name:clan,
          point:1,
          members:members.length + 1,
          rank: numberOfClans + 1,
          createtime: new Date(),
        },
        {
          transaction: t, // Asociar la transacción con esta operación
        }
      );

      const clanId = newClan.id;

      //Insertar en LOG
      await LogPanelGM.create(
        {
          userAction:user,
          action: 'Crear Clan',
          user:clan,
          type:4,
          date: new Date(),
        },
        {
          transaction: t, // Asociar la transacción con esta operación
        }
      );

      // Obtener el id del clan agregado y la columna clandid de todos los miembros
      await UserGameInfo.update(
        { clanid: clanId },
        {
          where: {
            name: master,
          },
          returning: true,
          transaction: t,
        }
      );

      const originRecords = members.map(u => ({
        userAction:user,
        action: 'Añadir miembro a Clan',
        user:u,
        amount:clanId,
        type:5,
        date: new Date(),
      }));

      await LogPanelGM.bulkCreate(originRecords, { transaction:t });

      await UserGameInfo.update(
        { clanid: clanId },
        {
          where: {
            name: members,
          },
          returning: true,
          transaction: t,
        }
      );

      await t.commit();
      
      return {
        success: true,
        code: '000',
        message:'Se ha creado el clan '+clan+' correctamente'
      };
    
    }
    catch (error) {
        await t.rollback();
        throw new Error('Error al generar cupon');
    }
  }

  async addMembers(user,token,clan,members) {
    const t = await sequelize.transaction();

    try {

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
        return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      //Verificar si es GM otra vez:
      const existGM = await UsersPanel.findOne({
        attributes:['id'],
        where:{
          user: user,
          [Op.or]: [{ type: 0 }, { type: 9 }],
        },
        transaction: t,
      });

      if(!existGM){
        await t.rollback();
        return {
          success: false,
          code: '001',
          message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
        };
      
      }

      // Verificar si todos los miembros de members existen en usergameinfo
      const membersExist = await UserGameInfo.findAll({
        attributes: ['name'],
        where: {
          name: members,
        },
        transaction: t,
      });

      const membersExistNames = membersExist.map(member => member.name);

      const missingMembers = members.filter(member => !membersExistNames.includes(member));

      if (missingMembers.length > 0) {
        await t.rollback();
        return { success: false, code: '203', message: `No existen los ID's de los siguientes miembros: [${missingMembers.join(', ')}]` };
      }

      // Verificar si todos los miembros de members todavia no tienen clan
      //console.log(members);
      const membersWithClan = await UserGameInfo.findAll({
        attributes: ['name'],
        where: {
          name: members,
          clanid: {
            [Op.ne]: 0, // Verifica que clanid no sea igual a 0
          },
        },
        transaction: t,
      });
      //console.log(membersWithClan);
      const membersWithClanNames = membersWithClan.map(member => member.name);
      
      if (membersWithClanNames.length > 0) {
        await t.rollback();
        return { success: false, code: '203', message: `Los siguientes usuarios ya pertenecen a un clan: [${membersWithClanNames.join(', ')}]` };
      }

      //Insertar en LOG
      const originRecords = members.map(u => ({
        userAction:user,
        action: 'Añadir miembro a Clan',
        user:u,
        amount:clan,
        type:5,
        date: new Date(),
      }));

      await LogPanelGM.bulkCreate(originRecords, { transaction:t });

      // Aumentar la cantidad de miembros en claninfo por id (clan)
      await ClanInfo.increment(
        'members',
        { by: members.length, where: { id: clan }, transaction: t }
      );

      await UserGameInfo.update(
        { clanid: clan },
        {
          where: {
            name: members,
          },
          returning: true,
          transaction: t,
        }
      );

      const nameClan = await ClanInfo.findOne({
        attributes:['name'],
        where:{
          id: clan,
        },
        transaction: t,
      });

      await t.commit();
      
      return {
        success: true,
        code: '000',
        message:'Se han añadido todos los usuarios al clan '+ nameClan.name +' correctamente'
      };
    
    }
    catch (error) {
        await t.rollback();
        throw new Error('Error al añadir miembros a clan');
    }
  }

  async giftPowerUser(user,token,dias,usuarios) {
    const t = await sequelize.transaction();

    try {

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
        return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      //Verificar si es GM otra vez:
      const existGM = await UsersPanel.findOne({
        attributes:['id'],
        where:{
          user: user,
          [Op.or]: [{ type: 0 }, { type: 9 }],
        },
        transaction: t,
      });

      if(!existGM){
        await t.rollback();
        return {
          success: false,
          code: '001',
          message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
        };
      
      }

     // Otorgar dias de Power User:
     // Obtener el powertime de usuarios desde UserGameInfo por sus nombres
      const userGamePowers = await UserGameInfo.findAll({
        attributes: ['name', 'powertime'],
        where: {
          name: usuarios, // Cambia 'usuarios' por tu arreglo de nombres de usuarios
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if (userGamePowers.length !== usuarios.length) {
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '202', message: 'No se encontraron todos los usuarios' };
      }

      // Calcular el powertime final para cada usuario
      const updatedUserGamePowers = await Promise.all(userGamePowers.map(async(userGamePower) => {
        const powertimefinal = await calculatePowerUse(userGamePower.powertime, dias);
        return { name: userGamePower.name, powertimefinal };
      }));

      //console.log(updatedUserGamePowers);

      // Actualizar el powertime para cada usuario
      for (const userGamePower of updatedUserGamePowers) {
        await UserGameInfo.update(
          { powertime: userGamePower.powertimefinal },
          { where: { name: userGamePower.name }, transaction: t }
        );
      }

      //Insertar en LOG
      await LogPanelGM.create(
        {
          userAction:user,
          action: 'Dar días de Power User',
          user:JSON.stringify(usuarios),
          amount:dias,
          type:6,
          date: new Date(),
        },
        {
          transaction: t, // Asociar la transacción con esta operación
        }
      );

      const originRecords = updatedUserGamePowers.map(user => ({
          user:user.name,
          origen:6,
          recompensa:dias,
          tipo_recompensa: 6,
          fecha: new Date(),
        }));

      await LogRewardsUser.bulkCreate(originRecords, { transaction:t });


      await t.commit();
      
      return {
        success: true,
        code: '000',
        message:'Se ha otorgado correctamente '+ String(dias)+' día(s) de Power User a los usuarios',
      };
    
    }
      catch (error) {
        await t.rollback();
        throw new Error('Error al otorgar dias de power user');
    }
  }

    async setLevel(user,token,level,personajes) {
      const t = await sequelize.transaction();
  
      try {
  
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
          return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
        }
  
        //Verificar si es GM otra vez:
        const existGM = await UsersPanel.findOne({
          attributes:['id'],
          where:{
            user: user,
            [Op.or]: [{ type: 0 }, { type: 9 }],
          },
          transaction: t,
        });
  
        if(!existGM){
          await t.rollback();
          return {
            success: false,
            code: '001',
            message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
          };
        
        }
  
        // Actualizar el nivel de personajes
        await CharacterInfo.update(
            { level:level, exp:0 },
            { where: { id: personajes}, transaction: t }
          );
  
        //Insertar en LOG
        await LogPanelGM.create(
          {
            userAction:user,
            action: 'Cambiar nivel de personajes',
            user:JSON.stringify(personajes),
            amount:level,
            type:7,
            date: new Date(),
          },
          {
            transaction: t, // Asociar la transacción con esta operación
          }
        );
  
        await t.commit();
        
        return {
          success: true,
          code: '000',
          message:'Se ha cambiado el nivel de los personajes seleccionados correctamente',
        };
      
      }

    catch (error) {
        await t.rollback();
        throw new Error('Error al cambiar de nivelS');
    }
  }

  async login(req,id, password) {
    const t = await sequelize.transaction();
    try {

      // Verificar si el usuario tiene la columna 'ban' en la tabla 'usergameinfo' en 1
      const userControl = await UsersPanel.findOne({ where: { user:id } });

      if (userControl && userControl.ban === 1) {
        // Si la columna 'ban' está en 1, retornar 1 (baneado)
        return { success:false,message:'Tu usuario se encuentra baneado. Contactaté con un administrador.',code: '200' };
      }

      // Verificar las credenciales en la tabla 'user'
      const user = await UsersPanel.findOne({
        attributes: ['user','type','asociado'],
        where: { user:id, password } });

      if (user) {
        // Si las credenciales son correctas, crear un token
        const tokenjwt = await signToken(id.toLowerCase(),'true');
        const token = encrypt(tokenjwt,config.key);

        const existingUser = await TokenSession.findOne({ where: { id: id } });

        //console.log('erro1');
        if (!existingUser) {
          await TokenSession.create({ id: id, token: token }, { transaction:t });
        } else{
          // Actualizar el token en tokensession
          await TokenSession.update({ token }, { where: { id }, transaction: t  });
        }

        // Devolver el objeto con toda la información del usuario, el token y el código 2
        await t.commit();
        return { _u: user, auth:token, code: '000',message:'Has iniciado sesión correctamente',success:true };
      } else {
        // Si las credenciales son incorrectas, retornar 3 (credenciales incorrectas)
        await t.rollback();
        return { success:false,message:'Credenciales incorrectas',code: '100' };
      }
    } catch (error) {
      await t.rollback();
      console.error('Error en el inicio de sesión:', error);
      throw new Error('Error en el servidor');
    }
  }  

  async logout(user, token) {
    const t = await sequelize.transaction();

    try {
      // Verifica si el token ya existe en la tabla Blackout
      const existingBlackout = await Blackout.findOne({
        where: {
          token,
          user,
        },
        transaction: t, // Asocia la transacción con esta consulta
      });

      if (!existingBlackout) {
        // Si el token no existe en Blackout, agrégalo
        await Blackout.create({
          user,
          token,
        }, { transaction: t });

        // Actualiza el campo 'lastconnect' en la tabla 'usergameinfo'
        await UsersPanel.update(
          { ultimaconexion: new Date() },
          { where: { user: user } },
          { transaction: t }
        );

        // Confirma la transacción si todo se ejecutó correctamente
        await t.commit();
        return {sucess:true, code:'000',message:'Cerrando sesión...'}
      }
    } catch (error) {
      // Si hay un error, realiza un rollback de la transacción
      await t.rollback();
      throw error;
    }
  }

}

export default new GMPanelService();