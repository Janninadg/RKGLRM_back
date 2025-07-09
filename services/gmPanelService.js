
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
import Streamer from '../models/streamersModel.js';
import { obtenerCuponesGenerados, obtenerLogsCupones, obtenerLogsExchanges, obtenerLogsGM, obtenerLogsRecompensas, obtenerLogsStreamers } from '../utils/panelUtils.js';
import EventPoint from '../models/eventPointsModel.js';
import StreamPlatform from '../models/streamsPlatformsModel.js';
import Anuncio from '../models/anunciosModel.js';

import fs from 'fs/promises'; // Importar módulo de promesas para ESM
import path from 'path';
// import { v4 as uuidv4 } from 'uuid';
import { enviarMensajeACliente, obtenerClientesActivos } from '../socket/socketServer.mjs';
import FileManager from '../models/fileManagerModel.js';
import { getSerialFromFile } from '../utils/utils.js';


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
            console.log("!![GM Panel]".red,' Sesión antigua'.red);
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

              //Obtener event points
              const eventPoints = await UserGameInfo.findOne({
                // attributes: ['Points'],
                where: {
                  name: user.name, // Cambia esto para usar el nombre de usuario correcto
                },
                // transaction: t,
                // lock: t.LOCK.UPDATE,
              });


              //console.log(cashUser);

              // Agregar la información completa del usuario
              usersWithCharacters.push({
                  id: user.id,
                  name: user.name,
                  personajes: characterNames,
                  gold: user.gold,
                  cash: cashUser === null ? 0 :cashUser.cash,
                  ep: eventPoints === null ? 0:eventPoints.clanpoint,
              });
          }

          // Mapear los usuarios a un nuevo array con índice
            const usersWithIndex = usersWithCharacters.map((user, index) => ({
                id: index + 1, // Ajustar el índice según tus necesidades
                name: user.name,
                personajes: user.personajes,
                gold:user.gold,
                cash:user.cash,
                ep:user.ep,
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
            console.log("!![GM Panel]".red,' Sesión antigua'.red);
            return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
          }

          const userAsociado = await UsersPanel.findOne({
            attributes: ['asociado'],
            where: {
              user: user.user, // Cambia esto para usar el nombre de usuario correcto
            },
            //transaction: t, // Asociar la transacción con esta consulta
          });

          const userGame = await UserGameInfo.findOne({
            attributes: ['id'],
            where: {
              name: userAsociado.asociado, // Cambia esto para usar el nombre de usuario correcto
            },
            //transaction: t, // Asociar la transacción con esta consulta
          });

          if(!userGame){
            //await t.rollback(); // Revertir la transacción en caso de error
            console.log("!![GM Panel]".red,' Usuario asociado no existe'.red);
            return { success: false, code: '002', message: 'Tu usuario [asociado] no existe' };
          }

          const personajes = await CharacterInfo.findAll({
            where: { userid: userGame.id },
            attributes: ['id','name'],
          });

          //const namesArray = users.map(user => user.name);
        
            console.log("[GM Panel]".green,' Exito'.green);
            return {success:true,code:'000',message:'ok',_lpr:personajes};
    
          //return users;
        } catch (error) {
          console.error('Error al obtener usuarios:', error);
          throw new Error('Error interno del servidor');
        }
      }

      async getPersonajeUser(user,token,username) {
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
            console.log("!![GM Panel]".red,' Sesión antigua'.red);
            return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
          }

          //Verificar si es GM otra vez:
          const existGM = await UsersPanel.findOne({
            attributes:['id'],
            where:{
              user: user,
              [Op.or]: [{ type: 0 }, { type: 9 },{type:2},{type:4}],
            },
            // transaction: t,
          });

          if(!existGM){
            await t.rollback();
            return {
              success: false,
              code: '001',
              message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
            };
          
          }


          const userGame = await UserGameInfo.findOne({
            attributes: ['id'],
            where: {
              name: username, // Cambia esto para usar el nombre de usuario correcto
            },
            //transaction: t, // Asociar la transacción con esta consulta
          });

          if(!userGame){
            //await t.rollback(); // Revertir la transacción en caso de error
            console.log("!![GM Panel]".red,' Usuario no existe'.red);
            return { success: false, code: '002', message: 'Usuario no existe' };
          }

          const personajes = await CharacterInfo.findAll({
            where: { userid: userGame.id },
            attributes: ['id','name','level','exp'],
          });

          //const namesArray = users.map(user => user.name);
        
            console.log("[GM Panel]".green,' Exito'.green);
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

      async getAnuncios(user,token) {
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
          const anuncios = await Anuncio.findAll({
            order: [
              ['importante', 'DESC'], // Ordenar primero por el atributo 'importante', de mayor a menor
              ['fecha', 'DESC'], // Luego, ordenar por fecha, del más reciente al más antiguo
            ],
          });
           
            return {success:true,code:'000',message:'ok',ann:anuncios};
    
          //return users;
        } catch (error) {
          console.error('Error al obtener anuncios:', error);
          throw new Error('Error interno del servidor');
        }
      }

      async changeAnunciosStatus(user,token,anuncioid) {
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
              [Op.or]: [{ type: 0 }, { type: 9 },{type:4}],
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


            // Obtener el status actual del streamer
            const anuncio = await Anuncio.findOne({
              where: { id: anuncioid },
              transaction: t, // Asociar la transacción con esta consulta
              lock: t.LOCK,
            });

            if (!anuncio) {
              await t.rollback();
              return {
                success: false,
                code: '003',
                message: 'El anuncio no existe.',
              };
            }

            anuncio.estado = anuncio.estado === 1 ? 0 : 1;
            await anuncio.save({ transaction: t });

          await t.commit();
          
          return {
            success: true,
            code: '000',
            message:'Se cambio el estado del anuncio correctamente'
          };
        
        }
        catch (error) {
            await t.rollback();
            throw new Error('Error al banear usuarios');
        }
    }

      async getStreamers(user,token) {
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
            console.log("!![GM Panel]".red,' Sesión antigua'.red);
            return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
          }

          // Obtener todos los streamers
          const streamers = await Streamer.findAll();

          // Obtener los nombres de las plataformas
          const streamersWithPlatformNames = await Promise.all(
              streamers.map(async (streamer) => {
                  const platform = await StreamPlatform.findOne({
                      where: { id: streamer.platform },
                      attributes: ['name'],
                  });

                  return {
                      ...streamer.toJSON(),
                      platformName: platform ? platform.name : 'Plataforma desconocida',
                  };
              })
          );

          return {success:true,code:'000',message:'ok',st:streamersWithPlatformNames };
    
          //return users;
        } catch (error) {
          console.error('Error al obtener logs:', error);
          throw new Error('Error interno del servidor');
        }
      }

      async changeStreamerStatus(user,token,streamerId) {
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
              [Op.or]: [{ type: 0 }, { type: 9 },{type:4}],
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


            // Obtener el status actual del streamer
            const streamer = await Streamer.findOne({
              where: { id: streamerId },
              transaction: t, // Asociar la transacción con esta consulta
              lock: t.LOCK,
            });

            if (!streamer) {
              await t.rollback();
              return {
                success: false,
                code: '003',
                message: 'El streamer no existe.',
              };
            }

            streamer.status = streamer.status === 1 ? 0 : 1;
            await streamer.save({ transaction: t });

          await t.commit();
          
          return {
            success: true,
            code: '000',
            message:'Se cambio el estado del streamer correctamente'
          };
        
        }
        catch (error) {
            await t.rollback();
            throw new Error('Error al banear usuarios');
        }
    }

    async changeLinkStreamer(user,token,streamerId,link) {
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
            [Op.or]: [{ type: 0 }, { type: 9 },{type:4}],
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


          // Obtener el status actual del streamer
          const streamer = await Streamer.findOne({
            where: { id: streamerId },
            transaction: t, // Asociar la transacción con esta consulta
            lock: t.LOCK,
          });

          if (!streamer) {
            await t.rollback();
            return {
              success: false,
              code: '003',
              message: 'El streamer no existe.',
            };
          }

          streamer.link = link;
          await streamer.save({ transaction: t });

        await t.commit();
        
        return {
          success: true,
          code: '000',
          message:'Se cambio el link del streamer correctamente'
        };
      
      }
      catch (error) {
          await t.rollback();
          throw new Error('Error al banear usuarios');
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

           //Verificar si es GM otra vez:
          const existGM = await UsersPanel.findOne({
            attributes:['id'],
            where:{
              user: user,
              [Op.or]: [{ type: 9 }],
            },
            // transaction: t,
          });

          if(!existGM){
            // await t.rollback();
            console.log("!![GM Panel]".red,' Ya no es GM'.red);
            return {
              success: false,
              code: '001',
              message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
            };
          
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
            console.log("!![GM Panel]".red,' Sesión antigua'.red);
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
              [Op.or]: [{ type: 0 }, { type: 9 },{type:4}],
            },
            transaction: t,
          });

          if(!existGM){
            console.log("!![GM Panel]".red,' Ya no es GM'.red);
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

          console.log("[GM Panel]".green,' Exito'.green);
          
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

        // console.log(banInfo);

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
          console.log("!![GM Panel]".red,' Sesión antigua'.red);
          return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
        }

        const cash = Number(data.c);
        const oro = Number(data.o);
        const eventPoints = Number(data.ep);
        const users = data._lu;
        const tipo = data.trx;

        //Verificar si es GM otra vez:
        const existGM = await UsersPanel.findOne({
          attributes:['id'],
          where:{
            user: user,
            [Op.or]: [{ type: 0 }, { type: 9 },{type:4}],
          },
          transaction: t,
        });

        if(!existGM){
          await t.rollback();
          console.log("!![GM Panel]".red,' Ya no es GM'.red);
          return {
            success: false,
            code: '001',
            message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
          };
        
        }

        var usersNoGold = [];
        var usersNoCash = [];
        var usersNoPoints = [];

        var lowOro = [];
        var lowCash = [];
        var lowEventPoints = [];

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

          const userEventPoints = await UserGameInfo.findOne({
            // attributes: ['Points'],
            where: {
              name: u.name, // Cambia esto para usar el nombre de usuario correcto
            },
            transaction: t,
            // lock: t.LOCK.UPDATE,
          });

          if(!userEventPoints){
            usersNoPoints.push(u.name);
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
                type: tipo === 1 ?2:10,
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
                type: tipo === 1 ? 1:9,
                date: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );
          }

          if(eventPoints>0){

            if(tipo === 1){   
              // console.log(eventPoints);
              await UserGameInfo.increment(
                'clanpoint',
                { by: eventPoints, where: { name: u.name  }, transaction: t }
              );
              // console.log(2123);
            } else {
              //Descuento...
              const eg = await UserGameInfo.findOne({
                attributes: ['id', 'clanpoint'],
                where: {
                  name: u.name, // Cambia esto para usar el nombre de usuario correcto
                  gold: {
                    [Op.lte]: (eventPoints-1), // Verifica que gold sea menor o igual a 4999
                  },
                },
                transaction: t, // Asociar la transacción con esta consulta
              });

              if (eg) {
                lowEventPoints.push(u.name);
              } else{
                await UserGameInfo.decrement(
                  'clanpoint',
                  { by: eventPoints, where: { name: u.name  }, transaction: t }
                );
              }
            }

            await LogRewardsUser.create({  
              user:u.name,
              origen:tipo === 1 ? 2 : 3,
              recompensa:tipo === 1 ? eventPoints: (eventPoints*-1),
              tipo_recompensa: 13,
              fecha: new Date(), 
            }, { transaction:t });

            await LogPanelGM.create(
              {
                userAction:user,
                action: tipo === 1 ? 'Recarga Puntos de Evento' : 'Descuento Puntos de Evento',
                user: u.name,
                amount: eventPoints,
                type:  tipo === 1 ? 11 : 12,
                date: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );
          }

        }

        // if(lowCash.length > 0 && lowOro.length>0){
        //   const low = lowCash.concat(lowOro);
        //   await t.rollback(); // Revertir la transacción en caso de error
        //   console.log("!![GM Panel]".red,' Error al decrementar - Saldo insuficiente de cash de usuarios');
        //   return { success: false, code: '002', message: 'Los siguientes usuario(s) '+JSON.stringify(low)+' no tienen suficiente Cash u Oro para descontar' };
        // }

        if(lowOro.length > 0){
          await t.rollback(); // Revertir la transacción en caso de error
          console.log("!![GM Panel]".red,' Error al decrementar - Saldo insuficiente de oro de usuarios'.red);
          return { success: false, code: '002', message: 'Los siguientes usuario(s) '+JSON.stringify(lowOro)+' no tienen Gold suficiente para ser descontado' };
        }

        if(lowCash.length > 0){
          await t.rollback(); // Revertir la transacción en caso de error
          console.log("!![GM Panel]".red,' Error al decrementar - Saldo insuficiente de cash de usuarios'.red);
          return { success: false, code: '002', message: 'Los siguientes usuario(s) '+JSON.stringify(lowCash)+' no tienen Cash suficiente para ser descontado' };
        }

        
        if(lowEventPoints.length > 0){
          await t.rollback(); // Revertir la transacción en caso de error
          console.log("!![GM Panel]".red,' Error al decrementar - Saldo insuficiente de puntos de evento de usuarios'.red);
          return { success: false, code: '002', message: 'Los siguientes usuario(s) '+JSON.stringify(lowEventPoints)+' no tienen Puntos de evento suficiente para ser descontado' };
        }

        if (usersNoGold.length > 0) {
          await t.rollback(); // Revertir la transacción en caso de error
          console.log("!![GM Panel- GOLD]".red,' Usuarios no encontrados: '.red,JSON.stringify(usersNoCash).magenta);
          return { success: false, code: '002', message: 'Usuario(s) '+JSON.stringify(usersNoGold)+' no encontrado [GOLD: Comunicar con algún administrador]' };
        }

        
        if (usersNoCash.length > 0) {
          await t.rollback(); // Revertir la transacción en caso de error
          console.log("!![GM Panel- CASH]".red,' Usuarios no encontrados: '.red,JSON.stringify(usersNoCash).magenta);
          return { success: false, code: '003', message: 'Usuario(s) '+JSON.stringify(usersNoCash)+' no encontrado [CASH: Comunicar con algún administrador]' };
        }

        if (usersNoPoints.length > 0) {
          await t.rollback(); // Revertir la transacción en caso de error
          console.log("!![GM Panel- EVENT POINT]".red,' Usuarios no encontrados: '.red,JSON.stringify(usersNoPoints).magenta);
          return { success: false, code: '003', message: 'Usuario(s) '+JSON.stringify(usersNoPoints)+' no encontrado [EVENT POINTS: Comunicar con algún administrador]' };
        }
        

        await t.commit();
        
        console.log("[GM Panel]".green,' Exito'.green);
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

      // console.log(banInfo);

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
        console.log("!![GM Panel]".red,' Sesión antigua'.red);
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
          [Op.or]: [{ type: 0 }, { type: 9 }, { type: 2 },{type:4}],
        },
        transaction: t,
      });

      if(!existGM){
        await t.rollback();
        console.log("!![GM Panel]".red,' Ya no es GM'.red);
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
          console.log("!![GM Panel]".red,' Item ID ingresado no existe'.red);
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
      console.log("[GM Panel]".green,' Exito'.green);
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
        console.log("!![GM Panel]".red,' Sesión antigua'.red);
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      //Verificar si es GM otra vez:
      const existGM = await UsersPanel.findOne({
        attributes:['id'],
        where:{
          user: user,
          [Op.or]: [{ type: 0 }, { type: 9 }, { type: 2 },{type:4}],
        },
        transaction: t,
      });

      if(!existGM){
        console.log("!![GM Panel]".red,' Ya no es GM'.red);
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
        console.log("!![GM Panel]".red,' Nombre de clan repetido'.red);
        return { success: false, code: '204', message: 'Ya existe un clan con el mismo nombre' };
      }

      // Verificar si existe el master:

      const usergetId = await UserGameInfo.findOne({
        attributes:['id'],
        where:{
          name: master,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if (!usergetId) {
        await t.rollback(); // Revertir la transacción en caso de error
        console.log("!![GM Panel]".red,' No existe el ID del Master ingresado'.red);
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
        console.log("!![GM Panel]".red,' El usuario ya es master de otro clan'.red);
        return { success: false, code: '205', message: 'El usuario ya es master de otro clan' };
      }

      // Verificar si el usuario master pertenece a otro clan:
      const memberOfClan = await UserGameInfo.findOne({
        attributes: ['id'],
        where: {
          clanid: 0,
          name: master,
        },
        transaction: t,
      });

      if (!memberOfClan) {
        await t.rollback();
        console.log("!![GM Panel]".red,' El usuario es miembro de otro clan'.red);
        return { success: false, code: '205', message: 'El usuario es miembro de otro clan' };
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
        console.log("!![GM Panel]".red,` No existen los ID's de los siguientes miembros: [${missingMembers.join(', ')}]`.red);
        return { success: false, code: '203', message: `No existen los ID's de los siguientes miembros: [${missingMembers.join(', ')}]` };
      }

      // Verificar si todos los miembros no pertenecen a otro clan
      const membersExistClan = await UserGameInfo.findAll({
        attributes: ['name'],
        where: {
          clanid:0,
          name: members,
        },
        transaction: t,
      });

      const membersClanNames = membersExistClan.map(member => member.name);

      const missingClanMembers = members.filter(member => !membersClanNames.includes(member));

      if (missingClanMembers.length > 0) {
        await t.rollback();
        console.log("!![GM Panel]".red,` Los siguiente usuarios ya pertenecen a otros clanes: [${missingClanMembers.join(', ')}]`.red);
        return { success: false, code: '203', message: `Los siguiente usuarios ya pertenecen a otros clanes:  [${missingClanMembers.join(', ')}]` };
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
      console.log("[GM Panel]".green,' Exito'.green);
      
      return {
        success: true,
        code: '000',
        message:'Se ha creado el clan '+clan+' correctamente'
      };
    
    }
    catch (error) {
      console.log("!![GM Panel]".red,' Error exception'.red);
        await t.rollback();
        throw new Error('Error al crean clan');
    }
  }

  async crearAnuncio(user,token,titulo,autor,texto,categoria,imagen,importante, estado) {
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
        console.log("!![GM Panel]".red,' Sesión antigua'.red);
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      //Verificar si es GM otra vez:
      const existGM = await UsersPanel.findOne({
        attributes:['id'],
        where:{
          user: user,
          [Op.or]: [{ type: 0 }, { type: 9 }, { type: 2 },{type:4}],
        },
        transaction: t,
      });

      if(!existGM){
        console.log("!![GM Panel]".red,' Ya no es GM'.red);
        await t.rollback();
        return {
          success: false,
          code: '001',
          message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
        };
      
      }


      // Verificar si la imagen es un archivo o un enlace
      let imagePath = ''; // Imagen por defecto

      // console.log(imagen);

      if (typeof imagen === 'object' && imagen.r) {
        // Extraer la parte base64 y el tipo de imagen
        const matches = imagen.r.match(/^data:(.+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Formato de imagen inválido');
        }

        const extension = matches[1].split('/')[1]; // Obtener la extensión del archivo (jpg, png, etc.)
        const base64Data = matches[2]; // Datos de la imagen en base64

        // Crear un nombre único para la imagen
        const filename = `${Date.now()}.${extension}`;
        const filepath = path.join('C:/xampp/htdocs/pictures/anuncios', filename);

        // Guardar el archivo en el servidor
        await fs.writeFile(filepath, base64Data, 'base64');

        // Asignar la ruta de la imagen al anuncio
        imagePath = `/pictures/anuncios/${filename}`;
      } else if (typeof imagen === 'string' && imagen.startsWith('http')) {
        // Si es un enlace, no hacer nada, solo usar el valor de imagen tal como está
        imagePath = imagen;
      }

      // Crear el anuncio:
      const nuevoAnuncio = await Anuncio.create({
        titulo: titulo,
        autor: autor || 'Rakion Old',  // Si no se proporciona un autor, utiliza el valor por defecto
        contenido: texto,
        imagen: imagePath || '/pictures/rakxmas.png', // Usa la imagen por defecto si no se proporciona
        category: categoria || 'anuncio general', // Establecer la categoría de anuncio, o ajustarla según tu lógica
        importante: importante || 0, // Por defecto, no es importante si no se proporciona
        estado: estado || 1, // Por defecto, estado activo si no se proporciona
      }, {
        transaction: t, // Asociar la transacción con esta operación
      });

      //Insertar en LOG
      await LogPanelGM.create(
        {
          userAction:user,
          action: 'Crear Anuncio',
          user:'-',
          type:13,
          date: new Date(),
        },
        {
          transaction: t, // Asociar la transacción con esta operación
        }
      );

      await t.commit();
      
      console.log("[GM Panel]".green,' Exito'.green);
      
      return {
        success: true,
        code: '000',
        message:'Se ha creado el anuncio correctamente'
      };
    
    }
    catch (error) {
      console.log("!![GM Panel]".red,' Error exception'.red);
        await t.rollback();
        console.log(error);
        throw new Error('Error al generar cupon');
    }
  }

  async exists(filepath) {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  async uploadFiles(user,token,archivos) {
    const t = await sequelize.transaction();
    
    const ae = []; // archivos con error
    const as = []; // archivos subidos exitosamente

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
        console.log("!![GM Panel]".red,' Sesión antigua'.red);
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      //Verificar si es GM otra vez:
      const existGM = await UsersPanel.findOne({
        attributes:['id'],
        where:{
          user: user,
          [Op.or]: [{ type: 9 },{type:4}],
        },
        transaction: t,
      });

      if(!existGM){
        console.log("!![GM Panel]".red,' Ya no es GM'.red);
        await t.rollback();
        return {
          success: false,
          code: '001',
          message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
        };
      
      }


       // 2. Guardar archivos .xfs
      //  const uploadDir = 'C:/xampp/htdocs/files/';

      // Dentro de tu método:
      for (const archivo of archivos) {
        const { originalname: name, path: filePath } = archivo;

        try {
          // Validar extensión
          if (!/\.xfs$/i.test(name)) throw new Error('Extensión inválida');

          const uploadDir = 'C:/xampp/htdocs/ThisDownloader/';
          const base = path.basename(name, '.xfs');
          const ext = path.extname(name);
          const originalPath = path.join(uploadDir, name);

          // Leer buffer desde disco
          const buffer = await fs.readFile(filePath);

          if (await this.exists(originalPath)) {
            let i = 1;
            let newOldName;
            do {
              newOldName = path.join(uploadDir, `${base} (${i})${ext}`);
              i++;
            } while (await this.exists(newOldName));

            await fs.rename(originalPath, newOldName);
            console.log(`→ Archivo anterior renombrado a: ${newOldName}`);
          }

          await fs.writeFile(originalPath, buffer); // <- NO base64, sino buffer directo

          await fs.unlink(filePath);

          const fileSizeInBytes = buffer.length;

           const serial = await getSerialFromFile(originalPath);
          console.log('Serial ID generado:', serial);

          // Verificar si ya existe (ignorar mayúsculas/minúsculas)
          const existingFile = await FileManager.findOne({
            where: sequelize.where(
              sequelize.fn('LOWER', sequelize.col('FileName')),
              name.toLowerCase()
            ),
            transaction: t
          });

          if (existingFile) {
            // Actualizar registro existente
            await existingFile.update({
              SerialID: serial, // Puedes reemplazar con uuid si luego lo necesitas
              Length: fileSizeInBytes
            }, { transaction: t });
          } else {
            // Insertar nuevo registro
            await FileManager.create({
              FileName: name,
              SerialID: serial,
              Length: fileSizeInBytes
            }, { transaction: t });
          }

          // Registrar log por archivo subido
          await LogPanelGM.create({
            userAction: user,
            action: 'Subir archivos',
            user: name, // nombre original del archivo subido
            type: 18,
            date: new Date(),
          }, { transaction: t });

          as.push(name); // agregado con éxito
        } catch (fileErr) {
          ae.push({ name, error: fileErr.message });
        }
      }

      await t.commit();
       // Determinar mensaje final
      let message = '';
      let code = '000';
      if (ae.length === archivos.length) {
        message = 'Todos los archivos enviados no se han podido subir.';
        code = '100';
      } else if (ae.length > 0 && as.length > 0) {
        message = 'Se han subido algunos archivos correctamente, pero otros presentaron errores.';
        code = '100';
      } else {
        message = 'Se han subido todos los archivos correctamente.';
        code = '000';
      }

      console.log("[GM Panel]".green, ' Subida finalizada'.green);
      return {
        success: true,
        code,
        message,
        archivos_subidos: as,
        archivos_error: ae,
      };
    } catch (error) {
      await t.rollback();
      console.log("!![GM Panel]".red, ' Error en la subida'.red);
      console.error(error);
      throw new Error('Error al subir archivos');
    }
  }

  async enviarMensajes(user,token,texto,users,sala,type ) {
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
        console.log("!![GM Panel]".red,' Sesión antigua'.red);
        return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      //Verificar si es GM otra vez:
      const existGM = await UsersPanel.findOne({
        attributes:['id'],
        where:{
          user: user,
          [Op.or]: [{ type: 0 }, { type: 9 }, { type: 2 },{type:4}],
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


      // Enviar mensajes:

      // Obtener id de gm:
      const gmUser = await UsersPanel.findOne({
            where: {
                user: user,
            },
        });

      const mssg = {
        'idgm':gmUser.id,
        'message':texto,
      };
     

      switch (type) {
        case 1:
          //Todos
          console.log("[GM Panel]".green,' Enviando mensaje a todos'.cyan);
          mssg['type'] = 1;
          console.log("[Object] ".cyan, mssg);
          break;
        case 2:
          //Usuarios
          // console.log(users);
          mssg['users'] = users.join('#');
          mssg['type'] = 2;
          console.log("[GM Panel]".green,' Enviando mensaje a usuarios en especifico'.cyan);
          console.log("[Object] ".cyan, mssg);
          break;
        case 3:
          mssg['sala'] = Number(sala);
          mssg['type'] = 3;
          console.log("[GM Panel]".green,' Enviando mensaje a sala'.cyan);
          console.log("[Object] ".cyan, mssg);
          break;
        default:
          console.log("!![GM Panel]".red,' No existe este tipo de envío de mensajes'.red);
          return {
            success: false,
            code: '002',
            message: 'No existe este tipo de envio de mensajes'
          };
          break;
      }

      // **Enviar mensaje al socket TCP**
      // await enviarMensajeSocket(12345, '127.0.0.1', mssg);

      // Simulación: Esperar 5 segundos y luego enviar un mensaje al cliente 1
     
        const activos = obtenerClientesActivos();
        // console.log("[Servidor] Clientes activos:", activos);

        let res;

        if (activos.length > 0) {
            // enviarMensajeACliente(activos[0], mssg);
            try {
              // Espera la respuesta de la promesa
              res = await enviarMensajeACliente(activos[0], mssg);
              // console.log("Respuesta recibida:", res);
              // Aquí puedes utilizar la variable 'res' que contiene la respuesta
              // return res; // O hacer lo que necesites con ella
            } catch (error) {
              console.error("Error al enviar mensaje:", error);
              // Maneja el error o lanza una excepción
            }
        } else {
            console.log("[Servidor] No hay clientes activos para enviar mensajes.");
            console.log("!![GM Panel]".blue,' No se pudo enviar el mensaje porque no hay clientes activos.'.blue);
            return {
              success: false,
              code: '003',
              message: 'El cliente no puede recibir mensajes en este momento. Contacta con el administrador.'
            };
        }

      const response = JSON.parse(res);
      console.log("[Object Received] ".magenta, response);

      if(Number(response.reason) === 1 && gmUser.id === response.idgm){
        console.log("!![GM Panel]".red,' No se pudo enviar el mensaje. Ocurrió un error en el servidor.'.red);
          return {
              success: false,
              code: '002',
              message: 'No se ha podido enviar el mensaje. Hay un error interno en el servidor.'
            };
      }
   

      //Insertar en LOG

      switch (type) {
        case 1:
          //Todos
          await LogPanelGM.create(
            {
              userAction:user,
              action: 'Enviar Mensaje a Todos',
              user:'-',
              type:14,
              date: new Date(),
            },
            {
              transaction: t, // Asociar la transacción con esta operación
            }
          );
          break;
        case 2:
          //Usuarios
          const originRecords = users.map(u => ({
            userAction:user,
            action: 'Enviar Mensaje a Usuarios',
            user:u,
            type:15,
            date: new Date(),
          }));

          await LogPanelGM.bulkCreate(originRecords, { transaction:t });
          break;
        case 3:
          await LogPanelGM.create(
            {
              userAction:user,
              action: 'Enviar Mensaje a Sala',
              amount:sala,
              user:'-',
              type:16,
              date: new Date(),
            },
            {
              transaction: t, // Asociar la transacción con esta operación
            }
          );
          break;
      }

      console.log("[GM Panel]".green,' Mensaje enviado correctamente'.green);

      await t.commit();
      
      return {
        success: true,
        code: '000',
        message:'Se ha enviado el mensaje correctamente'
      };
    
    }
    catch (error) {
      console.log("!![GM Panel]".red,' Error exception'.red);
        await t.rollback();
        console.log(error);
        throw new Error('Error al enviar mensajes');
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
        console.log("!![GM Panel]".red,' Sesión antigua'.red);
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      //Verificar si es GM otra vez:
      const existGM = await UsersPanel.findOne({
        attributes:['id'],
        where:{
          user: user,
          [Op.or]: [{ type: 0 }, { type: 9 }, { type: 2 },{type:4}],
        },
        transaction: t,
      });

      if(!existGM){
        console.log("!![GM Panel]".red,' Ya no es GM'.red);
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
        console.log("!![GM Panel]".red,`No existen los ID's de los siguientes miembros: [${missingMembers.join(', ')}]`.red);
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
        console.log("!![GM Panel]".red,` Los siguientes usuarios ya pertenecen a un clan: [${membersWithClanNames.join(', ')}]`.red);
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

      console.log("[GM Panel]".green,' Exito'.green);
      
      return {
        success: true,
        code: '000',
        message:'Se han añadido todos los usuarios al clan '+ nameClan.name +' correctamente'
      };
    
    }
    catch (error) {
      console.log("!![GM Panel]".red,' Error exception'.red);
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
        console.log("!![GM Panel]".red,' Sesión antigua'.red);
        return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      //Verificar si es GM otra vez:
      const existGM = await UsersPanel.findOne({
        attributes:['id'],
        where:{
          user: user,
          [Op.or]: [{ type: 0 }, { type: 9 }, { type: 2 },{type:4}],
        },
        transaction: t,
      });

      if(!existGM){
        await t.rollback();
        console.log("!![GM Panel]".red,' Ya no es GM'.red);
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
        console.log("!![GM Panel]".red,' No se encontraron todos los usuarios'.red);
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
    

      //Insertar en LOG PANEL
      const originRecordsPanel = usuarios.map(u => ({
          userAction:user,
          action: 'Dar días de Power User',
          user: u,
          amount:dias,
          type:6,
          date: new Date(),
      }));

      await LogPanelGM.bulkCreate(originRecordsPanel, { transaction:t });

      //LOG reward:
      const originRecords = updatedUserGamePowers.map(user => ({
          user:user.name,
          origen:6,
          recompensa:dias,
          tipo_recompensa: 6,
          fecha: new Date(),
        }));

      await LogRewardsUser.bulkCreate(originRecords, { transaction:t });


      await t.commit();
      console.log("[GM Panel]".green,' Exito'.green);
      return {
        success: true,
        code: '000',
        message:'Se ha otorgado correctamente '+ String(dias)+' día(s) de Power User a los usuarios',
      };
    
    }
      catch (error) {
        await t.rollback();
        console.log("!![GM Panel]".red,' Error exception'.red);
        console.log(error);
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
          console.log("!![GM Panel]".red,' Sesión antigua'.red);
          return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
        }
  
        //Verificar si es GM otra vez:
        const existGM = await UsersPanel.findOne({
          attributes:['id'],
          where:{
            user: user,
            [Op.or]: [{ type: 0 }, { type: 9 }, { type: 2 },{type:4}],
          },
          transaction: t,
        });
  
        if(!existGM){
          await t.rollback();
          console.log("!![GM Panel]".red,' Ya no es GM'.red);
          return {
            success: false,
            code: '001',
            message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
          };
        
        }
  
        // Actualizar el nivel y experiencia de personajes
        await CharacterInfo.update(
            { level:level.lv, exp:level.ex },
            { where: { id: personajes}, transaction: t }
          );
  
        //Insertar en LOG
        await LogPanelGM.create(
          {
            userAction:user,
            action: 'Cambiar nivel de personajes',
            user:JSON.stringify(personajes),
            amount:level.lv,
            type:7,
            date: new Date(),
          },
          {
            transaction: t, // Asociar la transacción con esta operación
          }
        );

        await LogPanelGM.create(
          {
            userAction:user,
            action: 'Cambiar experiencia de personajes',
            user:JSON.stringify(personajes),
            amount:level.ex,
            type:8,
            date: new Date(),
          },
          {
            transaction: t, // Asociar la transacción con esta operación
          }
        );
  
        await t.commit();
        console.log("[GM Panel]".green,' Exito'.green);
        return {
          success: true,
          code: '000',
          message:'Se ha cambiado el nivel y experiencia de los personajes seleccionados de manera exitosa',
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
        console.log("[GM Panel]".green,' Success Login'.green);
        return { _u: user, auth:token, code: '000',message:'Has iniciado sesión correctamente',success:true };
      } else {
        // Si las credenciales son incorrectas, retornar 3 (credenciales incorrectas)
        await t.rollback();
        console.log("!![GM Panel]".red,' Credenciales incorrectas'.red);
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
        console.log("[GM Panel]".green,' Success Logout'.green);
        return {sucess:true, code:'000',message:'Cerrando sesión...'}
      }
    } catch (error) {
      // Si hay un error, realiza un rollback de la transacción
      await t.rollback();
      throw error;
    }
  }

  async setLevelChUser(user,token,personaje,username,level,exp) {
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
        console.log("!![GM Panel]".red,' Sesión antigua'.red);
        return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      //Verificar si es GM otra vez:
      const existGM = await UsersPanel.findOne({
        attributes:['id'],
        where:{
          user: user,
          [Op.or]: [{ type: 0 }, { type: 9 }, { type: 2 },{type:4}],
        },
        transaction: t,
      });

      if(!existGM){
        await t.rollback();
        console.log("!![GM Panel]".red,' Ya no es GM'.red);
        return {
          success: false,
          code: '001',
          message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
        };
      
      }

       // 3) Obtener el id interno de usuario por su username
      const userGameInfo = await UserGameInfo.findOne({
        attributes: ['id'],
        where: { name: username },
        transaction: t,
      });
      
      if (!userGameInfo) {
        await t.rollback();
        return { success: false, code: '003', message: 'Usuario de juego no encontrado.' };
      }

         // 4) Verificar que el personaje pertenece a ese usuario
      const personajeUser = await CharacterInfo.findOne({
        where: {
          id: personaje,
          userid: userGameInfo.id,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!personajeUser) {
        await t.rollback();
        console.log("![GM Panel]".red,' Error: El personaje no pertenece a este usuario'.red);
        return {
          success: false,
          code: '004',
          message: 'El personaje no pertenece a este usuario.',
        };
      }



      //Insertar en LOG
      await LogPanelGM.create(
        {
          userAction:user,
          action: 'Cambiar nivel de personaje',
          user:personaje,
          amount:level,
          type:7,
          date: new Date(),
        },
        {
          transaction: t, // Asociar la transacción con esta operación
        }
      );

      await LogPanelGM.create(
        {
          userAction:user,
          action: 'Cambiar experiencia de personaje',
          user:personaje,
          amount:exp,
          type:8,
          date: new Date(),
        },
        {
          transaction: t, // Asociar la transacción con esta operación
        }
      );
      
      // 6) Actualizar nivel y experiencia
      personajeUser.level = level;
      personajeUser.exp = exp;
      await personajeUser.save({ transaction: t });

      // 7) Obtener el nombre para el mensaje
      const personajeName = personajeUser.name;

      await t.commit();
      console.log("[GM Panel]".green,' Exito'.green);
      return {
        success: true,
        code: '000',
        message: `El personaje "${personajeName}" fue actualizado a nivel ${level} y ${exp} de experiencia.`,
      };

  } catch (error) {
      await t.rollback();
      throw new Error('Error al cambiar de nivelS');
  }
}

}

export default new GMPanelService();