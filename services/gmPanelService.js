
import { Sequelize,Op } from 'sequelize';
import sequelize from '../config/database.js';
import { EncryptFunction, verifyPacketAndBan } from '../utils/securityUtils.js';
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
import { generateRandomCoupon, getSerialFromFile } from '../utils/utils.js';
import UserCredits from '../models/Trades/userCreditsModel.js';
import TradeChats from '../models/Trades/tradeChatsModel.js';
import TradeActions from '../models/Trades/tradeActionsModel.js';
import User from '../models/userModel.js';
import PaymentMethods from '../models/Trades/paymentMethodsModel.js';
import CharacterInfoLog from '../models/characterInfoLogModel.js';
import couponCache from '../modules/coupons/coupon.cache.js';
import WebUser from '../models/webUsersModel.js';
import marketService from './marketService.js';


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

      async getUsersToBanMulti(user, token, terms = [], searchType = 'user') {
          try {
            // Validar token
            const sessionToken = await TokenSession.findOne({
              attributes: ['token'],
              where: {
                token: token,
                id: user,
              },
            });

            if (!sessionToken) {
              console.log("!![GM Panel]".red, ' Sesión antigua'.red);
              return {
                success: false,
                code: '002',
                message: 'Token inválido o tienes una sesión iniciada en otro navegador...'
              };
            }

            // Normalizar términos
            const cleanTerms = Array.isArray(terms)
              ? [...new Set(
                  terms
                    .map(t => String(t || '').trim())
                    .filter(t => t !== '')
                )]
              : [];

            if (cleanTerms.length === 0) {
              return {
                success: true,
                code: '000',
                message: 'ok',
                results: [],
              };
            }

            let matchedUsers = [];

            if (searchType === 'user') {
              // Buscar usuarios por nombre
              const whereConditions = cleanTerms.map(term => ({
                name: {
                  [Op.like]: `%${term}%`
                }
              }));

              matchedUsers = await UserGameInfo.findAll({
                where: {
                  ban: 0,
                  [Op.or]: whereConditions,
                },
                attributes: ['id', 'name', 'gold', 'clanpoint'],
                order: [['id', 'ASC']],
                raw: true,
              });
            } else {
              // Buscar por personaje
              const whereConditions = cleanTerms.map(term => ({
                name: {
                  [Op.like]: `%${term}%`
                }
              }));

              const matchedCharacters = await CharacterInfo.findAll({
                where: {
                  [Op.or]: whereConditions,
                },
                attributes: ['userid', 'name'],
                raw: true,
              });

              const uniqueUserIds = [...new Set(matchedCharacters.map(c => c.userid))];

              if (uniqueUserIds.length === 0) {
                return {
                  success: true,
                  code: '000',
                  message: 'ok',
                  results: cleanTerms.map(term => ({
                    term,
                    matches: [],
                  })),
                };
              }

              matchedUsers = await UserGameInfo.findAll({
                where: {
                  ban: 0,
                  id: {
                    [Op.in]: uniqueUserIds
                  }
                },
                attributes: ['id', 'name', 'gold', 'clanpoint'],
                order: [['id', 'ASC']],
                raw: true,
              });
            }

            if (matchedUsers.length === 0) {
              return {
                success: true,
                code: '000',
                message: 'ok',
                results: cleanTerms.map(term => ({
                  term,
                  matches: [],
                })),
              };
            }

            // Traer personajes y cash en lote
            const userIds = matchedUsers.map(u => u.id);
            const userNames = matchedUsers.map(u => u.name);

            const [characters, cashList] = await Promise.all([
              CharacterInfo.findAll({
                where: {
                  userid: {
                    [Op.in]: userIds
                  }
                },
                attributes: ['userid', 'name'],
                raw: true,
              }),
              Cash.findAll({
                where: {
                  id: {
                    [Op.in]: userNames
                  }
                },
                attributes: ['id', 'cash'],
                raw: true,
              }),
            ]);

            // Maps
            const charactersMap = {};
            for (const character of characters) {
              if (!charactersMap[character.userid]) {
                charactersMap[character.userid] = [];
              }
              charactersMap[character.userid].push(character.name);
            }

            const cashMap = {};
            for (const cash of cashList) {
              cashMap[cash.id] = cash.cash;
            }

            // Usuarios enriquecidos
            const fullUsers = matchedUsers.map(u => ({
              id: u.id,
              name: u.name,
              personajes: charactersMap[u.id] || [],
              gold: u.gold,
              cash: cashMap[u.name] || 0,
              ep: u.clanpoint || 0,
            }));

            // Agrupar por término, como tu frontend espera
            const results = cleanTerms.map(term => {
              const lowerTerm = term.toLowerCase();

              let matches = [];

              if (searchType === 'user') {
                matches = fullUsers.filter(u =>
                  u.name.toLowerCase().includes(lowerTerm)
                );
              } else {
                matches = fullUsers.filter(u =>
                  u.personajes.some(p =>
                    p.toLowerCase().includes(lowerTerm)
                  )
                );
              }

              return {
                term,
                matches,
              };
            });

            return {
              success: true,
              code: '000',
              message: 'ok',
              results,
            };

          } catch (error) {
            console.error('Error en multibúsqueda de usuarios:', error);
            throw new Error('Error interno del servidor');
          }
        }

      async getUserstoBan(user, token, page = 1, pageSize = 10, search = '', searchType = 'user') {
        try {
          page = Number(page) || 1;
          pageSize = Number(pageSize) || 10;

          if (page < 1) page = 1;
          if (pageSize < 1) pageSize = 10;

          const offset = (page - 1) * pageSize;
          const searchValue = (search || '').trim();

          // Verificar token
          const sessionToken = await TokenSession.findOne({
            attributes: ['token'],
            where: {
              token: token,
              id: user,
            },
          });

          if (!sessionToken) {
            console.log("!![GM Panel]".red, ' Sesión antigua'.red);
            return {
              success: false,
              code: '002',
              message: 'Token inválido o tienes una sesión iniciada en otro navegador...'
            };
          }

          // Filtro base
          const whereUser = {
            ban: 0,
          };

          // Si busca por usuario, filtramos directo en UserGameInfo
          if (searchValue && searchType === 'user') {
            whereUser.name = {
              [Op.like]: `%${searchValue}%`
            };
          }

          // Si busca por personaje, primero buscamos los userid relacionados
          if (searchValue && searchType === 'character') {
            const matchingCharacters = await CharacterInfo.findAll({
              attributes: ['userid'],
              where: {
                name: {
                  [Op.like]: `%${searchValue}%`
                }
              },
              group: ['userid'],
              raw: true,
            });

            const userIds = matchingCharacters.map(c => c.userid);

            if (userIds.length === 0) {
              return {
                success: true,
                code: '000',
                message: 'ok',
                data: [],
                total: 0,
                page,
                pageSize,
              };
            }

            whereUser.id = {
              [Op.in]: userIds
            };
          }

          // Total de usuarios filtrados
          const total = await UserGameInfo.count({
            where: whereUser,
          });

          // Traer solo la página actual
          const users = await UserGameInfo.findAll({
            where: whereUser,
            attributes: ['id', 'name', 'gold', 'clanpoint'],
            order: [['id', 'ASC']],
            limit: pageSize,
            offset,
            raw: true,
          });

          if (users.length === 0) {
            return {
              success: true,
              code: '000',
              message: 'ok',
              data: [],
              total,
              page,
              pageSize,
            };
          }

          // Obtener personajes y cash en lote
          const userIds = users.map(u => u.id);
          const userNames = users.map(u => u.name);

          const [characters, cashList] = await Promise.all([
            CharacterInfo.findAll({
              where: {
                userid: {
                  [Op.in]: userIds
                }
              },
              attributes: ['userid', 'name'],
              raw: true,
            }),
            Cash.findAll({
              where: {
                id: {
                  [Op.in]: userNames
                }
              },
              attributes: ['id', 'cash'],
              raw: true,
            }),
          ]);

          // Map personajes por userid
          const charactersMap = {};
          for (const character of characters) {
            if (!charactersMap[character.userid]) {
              charactersMap[character.userid] = [];
            }
            charactersMap[character.userid].push(character.name);
          }

          // Map cash por nombre de usuario
          const cashMap = {};
          for (const cash of cashList) {
            cashMap[cash.id] = cash.cash;
          }

          // Resultado final
          const usersWithCharacters = users.map(u => ({
            id: u.id,
            name: u.name,
            personajes: charactersMap[u.id] || [],
            gold: u.gold,
            cash: cashMap[u.name] || 0,
            ep: u.clanpoint || 0,
          }));

          return {
            success: true,
            code: '000',
            message: 'ok',
            data: usersWithCharacters,
            total,
            page,
            pageSize,
          };

        } catch (error) {
          console.error('Error al obtener usuarios:', error);
          throw new Error('Error interno del servidor');
        }
      }
      async getUsersNotActivated(user, token, page = 1, pageSize = 10, search = '', searchType = 'user') {
        try {
          page = Number(page) || 1;
          pageSize = Number(pageSize) || 10;

          if (page < 1) page = 1;
          if (pageSize < 1) pageSize = 10;

          const offset = (page - 1) * pageSize;
          const searchValue = (search || '').trim();

          const sessionToken = await TokenSession.findOne({
            attributes: ['token'],
            where: {
              token,
              id: user,
            },
          });

          if (!sessionToken) {
            console.log("!![GM Panel]".red, 'Sesión antigua'.red);

            return {
              success: false,
              code: '002',
              message: 'Token inválido o tienes una sesión iniciada en otro navegador...',
            };
          }

          /*
          1. Obtener todos los webusers
          */
          const webUsers = await WebUser.findAll({
            attributes: ['user', 'password'],
            order: [['user', 'ASC']],
            raw: true,
          });

          if (webUsers.length === 0) {
            return {
              success: true,
              code: '000',
              message: 'ok',
              data: [],
              total: 0,
              page,
              pageSize,
            };
          }

          const webUsernames = webUsers.map((w) => w.user);

          /*
          2. Obtener users reales relacionados
          */
          const realUsers = await User.findAll({
            where: {
              id: {
                [Op.in]: webUsernames,
              },
            },
            attributes: ['id', 'password', 'e_mail', 'phone'],
            raw: true,
          });

          const realUsersMap = {};
          for (const u of realUsers) {
            realUsersMap[u.id] = u;
          }

          /*
          3. Construir lista completa de no activados
          */
          const notActivatedUsers = [];

          for (const webUser of webUsers) {
            const realUser = realUsersMap[webUser.user];

            if (!realUser) continue;

            const passwordEncrypt = await EncryptFunction(
              webUser.password.toLowerCase()
            );

            if (passwordEncrypt !== realUser.password) {
              notActivatedUsers.push({
                user: realUser.id,
                email: realUser.e_mail,
                phone: realUser.phone,
              });
            }
          }

          /*
          4. Aplicar búsqueda sobre lista ya filtrada
          */
          let filteredUsers = notActivatedUsers;

          if (searchValue && searchType === 'user') {
            const lowerSearch = searchValue.toLowerCase();

            filteredUsers = filteredUsers.filter((u) =>
              String(u.user).toLowerCase().includes(lowerSearch)
            );
          }

          if (searchValue && searchType === 'character') {
            const notActivatedUserIds = notActivatedUsers.map((u) => u.user);

            if (notActivatedUserIds.length === 0) {
              return {
                success: true,
                code: '000',
                message: 'ok',
                data: [],
                total: 0,
                page,
                pageSize,
              };
            }

            const matchingCharacters = await CharacterInfo.findAll({
              attributes: ['userid'],
              where: {
                userid: {
                  [Op.in]: notActivatedUserIds,
                },
                name: {
                  [Op.like]: `%${searchValue}%`,
                },
              },
              group: ['userid'],
              raw: true,
            });

            const matchingUserIds = new Set(
              matchingCharacters.map((c) => c.userid)
            );

            filteredUsers = filteredUsers.filter((u) =>
              matchingUserIds.has(u.user)
            );
          }

          /*
          5. Paginación final
          */
          const total = filteredUsers.length;
          const paginatedUsers = filteredUsers.slice(offset, offset + pageSize);

          return {
            success: true,
            code: '000',
            message: 'ok',
            data: paginatedUsers,
            total,
            page,
            pageSize,
          };

        } catch (error) {
          console.error('Error al obtener usuarios no activados:', error);
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

     async cancelChats(user, token, action, chatIds = [], filters = {}, cancelFiltered = false, skipReturnPoints = false) {
        const t = await sequelize.transaction();

        try {
            const sessionToken = await TokenSession.findOne({
                attributes: ['token'],
                where: {
                    token,
                    id: user,
                },
                transaction: t,
            });

            if (!sessionToken) {
                await t.rollback();
                return {
                    success: false,
                    code: '002',
                    message: 'Token invalido o tienes una sesion iniciada en otro navegador...'
                };
            }

            const existGM = await UsersPanel.findOne({
                attributes: ['id'],
                where: {
                    user,
                    [Op.or]: [{ type: 0 }, { type: 9 }, { type: 4 }],
                },
                transaction: t,
            });

            if (!existGM) {
                await t.rollback();
                return {
                    success: false,
                    code: '001',
                    message: 'Usted no puede cancelar chats porque ya no es GM.'
                };
            }

            let idsToCancel = [];

            if (cancelFiltered) {
                const safeFilters = filters || {};
                const filterChatId = safeFilters.chat_id ? Number(safeFilters.chat_id) : null;
                const filterLastAction = safeFilters.last_action ? String(safeFilters.last_action).trim() : null;
                const filterPaymentMethodId = safeFilters.payment_method_id ? Number(safeFilters.payment_method_id) : null;
                const filterPaymentMethodType = safeFilters.payment_method_type
                    ? String(safeFilters.payment_method_type).trim()
                    : null;
                const filterRealNameSeller = safeFilters.real_name_seller
                    ? String(safeFilters.real_name_seller).trim().toLowerCase()
                    : null;
                const filterRealNameBuyer = safeFilters.real_name_buyer
                    ? String(safeFilters.real_name_buyer).trim().toLowerCase()
                    : null;

                const tradeChatsWhere = {};

                if (filterChatId) {
                    tradeChatsWhere.id = filterChatId;
                }

                if (filterPaymentMethodId) {
                    tradeChatsWhere.payment_method_id = filterPaymentMethodId;
                }

                const chats = await TradeChats.findAll({
                    where: tradeChatsWhere,
                    order: [['id', 'DESC']],
                    transaction: t
                });

                if (chats.length) {
                    const chatIdsForLookup = chats.map((chat) => chat.id);
                    const paymentMethodIds = [...new Set(chats.map((chat) => chat.payment_method_id).filter(Boolean))];
                    const nicknames = [...new Set([
                        ...chats.map((chat) => chat.buyer).filter(Boolean),
                        ...chats.map((chat) => chat.seller).filter(Boolean)
                    ])];

                    const allActions = await TradeActions.findAll({
                        where: { chat_id: chatIdsForLookup },
                        order: [['created_at', 'DESC'], ['id', 'DESC']],
                        transaction: t
                    });

                    const lastActionMap = {};
                    for (const item of allActions) {
                        if (!lastActionMap[item.chat_id]) {
                            lastActionMap[item.chat_id] = item;
                        }
                    }

                    const users = await User.findAll({
                        where: {
                            apodo: {
                                [Op.in]: nicknames
                            }
                        },
                        attributes: ['id', 'apodo'],
                        transaction: t
                    });

                    const userMap = users.reduce((acc, item) => {
                        acc[item.apodo] = {
                            id: item.id,
                            real_name: item.id
                        };
                        return acc;
                    }, {});

                    const paymentMethods = await PaymentMethods.findAll({
                        where: {
                            id: {
                                [Op.in]: paymentMethodIds
                            }
                        },
                        attributes: ['id', 'name', 'color', 'type', 'icon'],
                        transaction: t
                    });

                    const paymentMap = paymentMethods.reduce((acc, item) => {
                        acc[item.id] = item;
                        return acc;
                    }, {});

                    let formatted = chats.map((chat) => {
                        const lastActionObj = lastActionMap[chat.id] || null;
                        const lastAction = lastActionObj ? lastActionObj.action : 'CREATE_TRADE';
                        const sellerInfo = userMap[chat.seller] || null;
                        const buyerInfo = userMap[chat.buyer] || null;
                        const paymentInfo = paymentMap[chat.payment_method_id] || null;

                        return {
                            chat_id: chat.id,
                            last_action: lastAction,
                            real_name_seller: sellerInfo?.real_name || chat.seller,
                            real_name_buyer: buyerInfo?.real_name || chat.buyer,
                            payment_method: paymentInfo ? {
                                id: paymentInfo.id,
                                type: paymentInfo.type
                            } : null
                        };
                    });

                    if (filterLastAction) {
                        formatted = formatted.filter((chat) => chat.last_action === filterLastAction);
                    }

                    if (filterPaymentMethodType) {
                        formatted = formatted.filter((chat) => chat.payment_method?.type === filterPaymentMethodType);
                    }

                    if (filterRealNameSeller) {
                        formatted = formatted.filter((chat) =>
                            (chat.real_name_seller || '').toLowerCase().includes(filterRealNameSeller)
                        );
                    }

                    if (filterRealNameBuyer) {
                        formatted = formatted.filter((chat) =>
                            (chat.real_name_buyer || '').toLowerCase().includes(filterRealNameBuyer)
                        );
                    }

                    idsToCancel = formatted.map((chat) => chat.chat_id);
                }
            } else {
                idsToCancel = Array.isArray(chatIds)
                    ? chatIds
                        .map((id) => Number(id))
                        .filter((id) => Number.isInteger(id) && id > 0)
                    : [];
            }

            idsToCancel = [...new Set(idsToCancel)];

            await t.commit();

            if (!idsToCancel.length) {
                return {
                    success: false,
                    code: '200',
                    message: 'No hay chats para cancelar con los filtros indicados.',
                    chats_success: [],
                    chats_werror: []
                };
            }

            const chatsSuccess = [];
            const chatsWithError = [];

            for (const chatId of idsToCancel) {
                const response = await marketService.cancelChatFromPanel({
                    chat_id: chatId,
                    user,
                    action,
                    token,
                    panelUser: user,
                    skipReturnPoints
                });

                if (response?.code === '000') {
                    chatsSuccess.push(chatId);
                } else {
                    chatsWithError.push({
                        chat_id: chatId,
                        message: response?.message || 'No se pudo cancelar el chat.'
                    });
                }
            }

            return {
                success: true,
                code: '000',
                message: 'Proceso de cancelacion finalizado.',
                chats_success: chatsSuccess,
                chats_werror: chatsWithError
            };
        } catch (error) {
            try {
                await t.rollback();
            } catch (_) {}

            console.error('Error en cancelChats:', error);
            return { success: false, code: '999', message: 'Error interno del servidor.' };
        }
     }

     async getAllChats(user, token, page = 1, pageSize = 20, filters = {}) {
        const t = await sequelize.transaction();

        try {
            const currentPage = Number(page) > 0 ? Number(page) : 1;
            const currentPageSize = Number(pageSize) > 0 ? Number(pageSize) : 20;
            const offset = (currentPage - 1) * currentPageSize;

            const sessionToken = await TokenSession.findOne({
                attributes: ['token'],
                where: {
                    token: token,
                    id: user,
                },
                transaction: t,
            });

            if (!sessionToken) {
                await t.rollback();
                return {
                    success: false,
                    code: '002',
                    message: 'Token inválido o tienes una sesión iniciada en otro navegador...'
                };
            }

            const existGM = await UsersPanel.findOne({
                attributes: ['id'],
                where: {
                    user: user,
                    [Op.or]: [{ type: 0 }, { type: 9 }, { type: 4 }],
                },
                transaction: t,
            });

            if (!existGM) {
                await t.rollback();
                return {
                    success: false,
                    code: '001',
                    message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
                };
            }

            const safeFilters = filters || {};
            const filterChatId = safeFilters.chat_id ? Number(safeFilters.chat_id) : null;
            const filterLastAction = safeFilters.last_action ? String(safeFilters.last_action).trim() : null;
            const filterPaymentMethodId = safeFilters.payment_method_id ? Number(safeFilters.payment_method_id) : null;
            const filterPaymentMethodType = safeFilters.payment_method_type
                ? String(safeFilters.payment_method_type).trim()
                : null;
            const filterRealNameSeller = safeFilters.real_name_seller
                ? String(safeFilters.real_name_seller).trim().toLowerCase()
                : null;
            const filterRealNameBuyer = safeFilters.real_name_buyer
                ? String(safeFilters.real_name_buyer).trim().toLowerCase()
                : null;

            const tradeChatsWhere = {};
            if (filterChatId) {
                tradeChatsWhere.id = filterChatId;
            }
            if (filterPaymentMethodId) {
                tradeChatsWhere.payment_method_id = filterPaymentMethodId;
            }

            const chats = await TradeChats.findAll({
                where: tradeChatsWhere,
                order: [['id', 'DESC']],
                transaction: t
            });

            if (!chats.length) {
                await t.commit();
                return {
                    success: true,
                    code: "000",
                    chats: [],
                    pagination: {
                        page: currentPage,
                        pageSize: currentPageSize,
                        totalRecords: 0,
                        totalPages: 0
                    }
                };
            }

            const chatIds = chats.map(c => c.id);
            const paymentMethodIds = [...new Set(chats.map(c => c.payment_method_id).filter(Boolean))];
            const nicknames = [...new Set([
                ...chats.map(c => c.buyer).filter(Boolean),
                ...chats.map(c => c.seller).filter(Boolean)
            ])];

            const allActions = await TradeActions.findAll({
                where: { chat_id: chatIds },
                order: [['created_at', 'DESC'], ['id', 'DESC']],
                transaction: t
            });

            const lastActionMap = {};
            for (const action of allActions) {
                if (!lastActionMap[action.chat_id]) {
                    lastActionMap[action.chat_id] = action;
                }
            }

            const users = await User.findAll({
                where: {
                    apodo: {
                        [Op.in]: nicknames
                    }
                },
                attributes: ['id', 'apodo'],
                transaction: t
            });

            const userMap = users.reduce((acc, item) => {
                acc[item.apodo] = {
                    id: item.id,
                    real_name: item.id
                };
                return acc;
            }, {});

            const paymentMethods = await PaymentMethods.findAll({
                where: {
                    id: {
                        [Op.in]: paymentMethodIds
                    }
                },
                attributes: ['id', 'name', 'color', 'type', 'icon'],
                transaction: t
            });

            const paymentMap = paymentMethods.reduce((acc, item) => {
                acc[item.id] = item;
                return acc;
            }, {});

            await t.commit();

           let formatted = chats.map(chat => {

            const lastActionObj = lastActionMap[chat.id] || null;
            const lastAction = lastActionObj ? lastActionObj.action : 'CREATE_TRADE';

            // ❌ EXCLUIR CREATE_TRADE
            // if (lastAction === 'CREATE_TRADE') {
            //     return null;
            // }

            const sellerInfo = userMap[chat.seller] || null;
            const buyerInfo = userMap[chat.buyer] || null;
            const paymentInfo = paymentMap[chat.payment_method_id] || null;

            // 🏷️ LABEL AMIGABLE
            let actionLabel = '';
            let stateColor = 'gray';

            switch (lastAction) {
                case 'CREATE_TRADE':
                    actionLabel = 'Chat iniciado';
                    stateColor = '#7ab65c';
                    break;

                case 'CONFIRM_PAYMENT':
                    actionLabel = 'Pago confirmado';
                    stateColor = '#3c8664';
                    break;

                case 'RELEASE_ITEM':
                    actionLabel = 'Item liberado';
                    stateColor = '#4d79a8';
                    break;

                case 'END_CHAT':
                    actionLabel = 'Chat finalizado';
                    stateColor = '#70253d';
                    break;

                case 'CANCEL_CHAT_RETURN':
                    actionLabel = 'Cancelado (retorno)';
                    stateColor = '#9c1a1a';
                    break;

                case 'CANCEL_CHAT_REPOST':
                    actionLabel = 'Cancelado (republicado)';
                    stateColor = '#e03c3c';
                    break;

                default:
                    actionLabel = lastAction;
                    stateColor = 'gray';
                    break;
            }

            const isActive =
                lastAction !== 'CANCEL_CHAT_RETURN' &&
                lastAction !== 'CANCEL_CHAT_REPOST' &&
                lastAction !== 'END_CHAT';

            return {
                chat_id: chat.id,
                seller: chat.seller,
                buyer: chat.buyer,

                real_name_seller: sellerInfo?.real_name || chat.seller,
                real_name_buyer: buyerInfo?.real_name || chat.buyer,

                seller_id: sellerInfo?.id || null,
                buyer_id: buyerInfo?.id || null,

                status: chat.status,
                created_at: chat.created_at,

                // 🔥 IMPORTANTE
                last_action: lastAction,
                last_action_label: actionLabel,
                last_action_date: lastActionObj?.created_at || null,

                is_active: isActive,
                state_color: stateColor,

                payment_method: paymentInfo ? {
                    id: paymentInfo.id,
                    name: paymentInfo.name,
                    color: paymentInfo.color,
                    type: paymentInfo.type,
                    icon: paymentInfo.icon
                } : null
            };
        })
        .filter(x => x !== null);

            if (filterLastAction) {
                formatted = formatted.filter(x => x.last_action === filterLastAction);
            }

            if (filterPaymentMethodType) {
                formatted = formatted.filter(x => x.payment_method?.type === filterPaymentMethodType);
            }

            if (filterRealNameSeller) {
                formatted = formatted.filter(x =>
                    (x.real_name_seller || '').toLowerCase().includes(filterRealNameSeller)
                );
            }

            if (filterRealNameBuyer) {
                formatted = formatted.filter(x =>
                    (x.real_name_buyer || '').toLowerCase().includes(filterRealNameBuyer)
                );
            }

            formatted.sort((a, b) => {
                if (a.is_active !== b.is_active) {
                    return a.is_active ? -1 : 1;
                }

                const dateA = a.last_action_date
                    ? new Date(a.last_action_date)
                    : new Date(a.created_at);

                const dateB = b.last_action_date
                    ? new Date(b.last_action_date)
                    : new Date(b.created_at);

                return dateB - dateA;
            });

            const totalRecords = formatted.length;
            const totalPages = Math.ceil(totalRecords / currentPageSize);
            const paginated = formatted.slice(offset, offset + currentPageSize);

            return {
                success: true,
                code: "000",
                chats: paginated,
                pagination: {
                    page: currentPage,
                    pageSize: currentPageSize,
                    totalRecords,
                    totalPages
                },
                filters_applied: {
                    chat_id: filterChatId,
                    last_action: filterLastAction,
                    payment_method_id: filterPaymentMethodId,
                    payment_method_type: filterPaymentMethodType,
                    real_name_seller: filterRealNameSeller,
                    real_name_buyer: filterRealNameBuyer
                }
            };

        } catch (error) {
            console.error("❌ Error en getAllChats:", error);
            try {
                await t.rollback();
            } catch (_) {}
            return { success: false, code: "999", message: "Error interno del servidor." };
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
                UserName: u.name, // Ajustar el campo apropiado de la tabla "banlist"
                Reason: reason,
                // userAction: user,
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
    async activateUsers(user, token, users) {
      const t = await sequelize.transaction();

      try {
        const sessionToken = await TokenSession.findOne({
          attributes: ['token'],
          where: {
            token,
            id: user,
          },
          transaction: t,
        });

        if (!sessionToken) {
          await t.rollback();
          return {
            success: false,
            code: '002',
            message: 'Token inválido o tienes una sesión iniciada en otro navegador...'
          };
        }

        const existGM = await UsersPanel.findOne({
          attributes: ['id'],
          where: {
            user,
            [Op.or]: [{ type: 0 }, { type: 9 }, { type: 4 }, { type: 2 }],
          },
          transaction: t,
        });

        if (!existGM) {
          await t.rollback();
          return {
            success: false,
            code: '001',
            message: 'No tienes permisos para realizar esta acción.'
          };
        }

        if (!Array.isArray(users) || users.length === 0) {
          await t.rollback();
          return {
            success: false,
            code: '400',
            message: 'No se enviaron usuarios para activar.'
          };
        }

        const results = [
          {
            success: true,
            message: 'Usuarios activados',
            users: [],
          },
          {
            success: false,
            message: 'Usuarios no activados',
            users: [],
          },
        ];

        for (const item of users) {
          const userId = typeof item === 'string' ? item : item.user;

          if (!userId) continue;

          const webUser = await WebUser.findOne({
            where: { user: userId },
            attributes: ['user', 'password'],
            transaction: t,
            raw: true,
          });

          if (!webUser) {
            results[1].users.push({
              user: userId,
              reason: 'No existe en webusers.',
            });
            continue;
          }

          const passwordEncrypt = await EncryptFunction(
            webUser.password.toLowerCase()
          );

          const [updated] = await User.update(
            {
              password: passwordEncrypt,
            },
            {
              where: {
                id: userId,
              },
              transaction: t,
            }
          );

          if (updated > 0) {
            await LogPanelGM.create(
              {
                userAction: user,
                action: 'Activación de usuario',
                user: userId,
                amount: 0,
                type: 23,
                date: new Date(),
              },
              {
                transaction: t,
              }
            );

            results[0].users.push({
              user: userId,
            });
          } else {
            results[1].users.push({
              user: userId,
              reason: 'No existe en user.',
            });
          }
        }

        await t.commit();

        return {
          success: true,
          code: '000',
          message: 'Usuarios activados correctamente.',
          results,
        };

      } catch (error) {
        await t.rollback();
        console.error('Error al activar usuarios:', error);

        return {
          success: false,
          code: '500',
          message: 'Error interno del servidor.'
        };
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
        const credits = Number(data.cr);
        const users = data._lu;
        const tipo = data.trx;

        //Verificar si es GM otra vez:
        const existGM = await UsersPanel.findOne({
          attributes:['id'],
          where:{
            user: user,
            [Op.or]: [{ type: 0 }, { type: 9 },{type:4},{type:2}],
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
         var usersNoCredits = [];

        var lowOro = [];
        var lowCash = [];
        var lowEventPoints = [];
        var lowCredits = [];

        var bfCash = 0;
        var bfOro = 0;
        var bfPointEv = 0;
        var bfCred = 0;

        var afCash = 0;
        var afOro = 0;
        var afPointEv = 0;
        var afCred = 0;

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
          } else{
            bfOro = userGold.gold;
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
          } else{
             bfCash = userCash.cash;
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
          }else{
            bfPointEv = userEventPoints.clanpoint;
          }

          const userCredits = await UserCredits.findOne({
            // attributes: ['Points'],
            where: {
              user: u.name, // Cambia esto para usar el nombre de usuario correcto
            },
            transaction: t,
            // lock: t.LOCK.UPDATE,
          });

          if(!userCredits){
            usersNoCredits.push(u.name);
          }else{
            bfCred = userCredits.credits;
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
              last_pr: bfCash,
              curr_pr: tipo === 1 ? (bfCash + cash): (bfCash - cash),
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
              last_pr: bfOro,
              curr_pr: tipo === 1 ? (bfOro + oro): (bfOro - oro),
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
                last_pr: bfPointEv,
              curr_pr: tipo === 1 ? (bfPointEv + eventPoints): (bfPointEv - eventPoints),
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

          if(credits>0){

            if(tipo === 1){   
              // console.log(eventPoints);
              await UserCredits.increment(
                'credits',
                { by: credits, where: { user: u.name  }, transaction: t }
              );
              // console.log(2123);
            } else {
              //Descuento...
              const ec = await UserCredits.findOne({
                where: {
                  user: u.name, // Cambia esto para usar el nombre de usuario correcto
                  credits: {
                    [Op.lte]: (credits-1), // Verifica que gold sea menor o igual a 4999
                  },
                },
                transaction: t, // Asociar la transacción con esta consulta
              });

              if (ec) {
                lowCredits.push(u.name);
              } else{
                await UserCredits.decrement(
                  'credits',
                  { by: credits, where: { user: u.name  }, transaction: t }
                );
              }
            }

            await LogRewardsUser.create({  
              user:u.name,
              origen:tipo === 1 ? 2 : 3,
              recompensa:tipo === 1 ? credits: (credits*-1),
              tipo_recompensa: 21,
                last_pr: bfCred,
              curr_pr: tipo === 1 ? (bfCred + credits): (bfCred - credits),
              fecha: new Date(), 
            }, { transaction:t });

            await LogPanelGM.create(
              {
                userAction:user,
                action: tipo === 1 ? 'Recarga de créditos' : 'Descuento de créditos',
                user: u.name,
                amount: credits,
                type:  tipo === 1 ? 19 : 20,
                date: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );
          }

        }

        // 🔥 VALIDACIONES SOLO SI SE USÓ EL CAMPO

        if (oro > 0 && lowOro.length > 0) {
          await t.rollback();
          return {
            success: false,
            code: '002',
            message: 'Los siguientes usuario(s) ' + JSON.stringify(lowOro) + ' no tienen Gold suficiente'
          };
        }

        if (cash > 0 && lowCash.length > 0) {
          await t.rollback();
          return {
            success: false,
            code: '002',
            message: 'Los siguientes usuario(s) ' + JSON.stringify(lowCash) + ' no tienen Cash suficiente'
          };
        }

        if (credits > 0 && lowCredits.length > 0) {
          await t.rollback();
          return {
            success: false,
            code: '002',
            message: 'Los siguientes usuario(s) ' + JSON.stringify(lowCredits) + ' no tienen créditos suficiente'
          };
        }

        if (eventPoints > 0 && lowEventPoints.length > 0) {
          await t.rollback();
          return {
            success: false,
            code: '002',
            message: 'Los siguientes usuario(s) ' + JSON.stringify(lowEventPoints) + ' no tienen puntos suficientes'
          };
        }

        // ❗ VALIDAR EXISTENCIA SOLO SI SE USA

        if (oro > 0 && usersNoGold.length > 0) {
          await t.rollback();
          return {
            success: false,
            code: '002',
            message: 'Usuario(s) ' + JSON.stringify(usersNoGold) + ' no encontrado [GOLD]'
          };
        }

        if (credits > 0 && usersNoCredits.length > 0) {
          await t.rollback();
          return {
            success: false,
            code: '002',
            message: 'Usuario(s) ' + JSON.stringify(usersNoCredits) + ' no encontrado [CREDITS]'
          };
        }

        if (cash > 0 && usersNoCash.length > 0) {
          await t.rollback();
          return {
            success: false,
            code: '003',
            message: 'Usuario(s) ' + JSON.stringify(usersNoCash) + ' no encontrado [CASH]'
          };
        }

        if (eventPoints > 0 && usersNoPoints.length > 0) {
          await t.rollback();
          return {
            success: false,
            code: '003',
            message: 'Usuario(s) ' + JSON.stringify(usersNoPoints) + ' no encontrado [EVENT POINTS]'
          };
        }
        

        await t.commit();
        
        console.log("[GM Panel]".green,' Exito'.green);
        return {
          success: true,
          code: '000',
          message:tipo === 1 ?  'Recarga exitosa' : 'Descuento exitoso'
        };
      
      }
      catch (error) {
          await t.rollback();
          console.log(error);
          throw new Error('Error al recargar');
      }
  }

  async setCupon(token, data, user, isDataIntegrityValid, paramsString, req) {
    const t = await sequelize.transaction();

    try {
      const verifyPacketEqual = (isDataIntegrityValid);
      const banInfo = await verifyPacketAndBan(user, user, paramsString, verifyPacketEqual, t, req);

      if (banInfo) {
        await t.rollback();
        return banInfo;
      }

      const trx = await sequelize.transaction();

      await TrackingPacket.create({
        packet: paramsString,
        user: user,
        fecha_uso: new Date(),
      }, { transaction: trx });

      await trx.commit();

      const sessionToken = await TokenSession.findOne({
        attributes: ['token'],
        where: { token: token, id: user },
        transaction: t,
      });

      if (!sessionToken) {
        await t.rollback();
        return { success: false, code: '002', message: 'Token inválido...' };
      }

      const name = data._pn;
      const limit = Number(data.lm);
      const type = Number(data._tc);
      const prize = parseInt(data._prc, 10);
      const qty = Number(data.qty) || 1;

      const existGM = await UsersPanel.findOne({
        attributes:['id'],
        where:{
          user: user,
          [Op.or]: [{ type: 0 }, { type: 9 }, { type: 2 }, { type: 4 }],
        },
        transaction: t,
      });

      if (!existGM) {
        await t.rollback();
        return { success: false, code: '001', message: 'Ya no es GM' };
      }

      // validar item
      if (type === 0) {
        const itemData = await ItemInfo.findOne({
          attributes: ['type'],
          where: { id: prize },
          transaction: t,
        });

        if (!itemData) {
          await t.rollback();
          return { success: false, code: '003', message:'Item no existe' };
        }
      }

      // 🔥 generar cupones
      const generatedCoupons = [];

      for (let i = 0; i < qty; i++) {
        generatedCoupons.push(generateRandomCoupon());
      }

      // 🔥 insert masivo
      await Cupon.bulkCreate(
        generatedCoupons.map(c => ({
          name_prize: name,
          limite: limit,
          ticket: c,
          type: type,
          id_prize: prize,
          uri: '',
        })),
        { transaction: t }
      );

      // 🔥 logs
      await LogPanelGM.bulkCreate(
        generatedCoupons.map(c => ({
          userAction: user,
          action: 'Generar Cupón',
          cupon: c,
          type: 3,
          date: new Date(),
        })),
        { transaction: t }
      );

      await t.commit();

      // actualizar cache en memoria
      generatedCoupons.forEach((couponCode) => {
        couponCache.addOrUpdate({
          ticket: couponCode,
          name_prize: name,
          limite: limit,
          users: 0,
          type: type,
          id_prize: prize,
          uri: '',
        });
      });

      return {
        success: true,
        code: '000',
        message: `Se generaron ${generatedCoupons.length} cupones correctamente`,
        coupons: generatedCoupons
      };

    } catch (error) {
      await t.rollback();
      console.log(error)
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
            cupon: name, // nombre original del archivo subido
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
            [Op.or]: [{ type: 0 }, { type: 9 }, { type: 2 },{type:4},{type:2}],
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
        attributes: ['id','name'],
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
          action: 'Reset de personaje',
          user:userGameInfo.name,
          amount:personaje,
          type:22,
          date: new Date(),
        },
        {
          transaction: t, // Asociar la transacción con esta operación
        }
      );

      const RESET_COST = 3000;

      const statsToReset = [
        'hit1',
        'hit2',
        'hit3',
        'hit4',
        'chit',
        'hp',
        'ap',
        'attackspeed',
        'speed',
        'maxcp',
      ];

      const totalStats = statsToReset.reduce((total, stat) => {
        return total + Number(personajeUser[stat] || 0);
      }, 0);

      if (totalStats <= 0) {
        await t.rollback();
        return {
          success: false,
          code: '005',
          message: 'El personaje no tiene stats para resetear.',
        };
      }

      // Buscar cash del usuario con lock
      const userCash = await Cash.findOne({
        where: {
          id: userGameInfo.name,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!userCash) {
        await t.rollback();
        return {
          success: false,
          code: '006',
          message: 'No se encontró información de cash para este usuario.',
        };
      }

      // 1) Obtener cash antes de descontar
      const prevCash = Number(userCash.cash || 0);

      // 1) Validar cash
      if (prevCash < RESET_COST) {
        await t.rollback();
        return {
          success: false,
          code: '007',
          message: 'No tiene suficiente cash para realizar el reset.',
        };
      }

      // 2) Calcular cash después del descuento
      const actualCash = prevCash - RESET_COST;

      // 1) Crear nuevo log ANTES del descuento
      const characterLog = await CharacterInfoLog.create({
        player_name: personajeUser.name,
        userid: userGameInfo.id,
        account_name: userGameInfo.name,
        total_sum: totalStats,
        prevcash: prevCash,
        actualcash: prevCash,
        created_at: new Date(),
      });

      // 2) Descontar cash CON transaction
      userCash.cash = actualCash;
      await userCash.save({ transaction: t });

      // 3) Sumar totalStats a levelpoint y resetear stats CON transaction
      personajeUser.levelpoint = Number(personajeUser.levelpoint || 0) + totalStats;

      statsToReset.forEach((stat) => {
        personajeUser[stat] = 0;
      });

      await personajeUser.save({ transaction: t });

      // 4) Actualizar ESE MISMO LOG dentro de la transacción
      characterLog.actualcash = actualCash;

      await characterLog.save({ transaction: t });

      // 7) Obtener el nombre para el mensaje
      const personajeName = personajeUser.name;

      await t.commit();

      console.log("[GM Panel]".green, ' Exito'.green);

      return {
        success: true,
        code: '000',
        message: `Los stats del personaje "${personajeName}" fueron reseteados.`,
      };

  } catch (error) {
      await t.rollback();
      throw new Error('Error al cambiar de nivelS');
  }
}

}

export default new GMPanelService();
