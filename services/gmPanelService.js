
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
import UserItemInfo from '../models/userItemInfoModel.js';
import ItemLoan from '../models/itemLoanModel.js';
import LogItemLoan from '../models/logItemLoanModel.js';
import ItemTraceLog from '../models/itemTraceLogModel.js';
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
import { calculatePowerUse, getRemainingPowerTime, setClassName } from '../utils/prizesUtils.js';
import LogRewardsUser from '../models/logRewardUserModel.js';
import LogStream from '../models/logStreamsModel.js';
import LogExchange from '../models/logExchanges.js';
import TempCupon from '../models/tempCupones.js';
import Streamer from '../models/streamersModel.js';
import EventPoint from '../models/eventPointsModel.js';
import StreamPlatform from '../models/streamsPlatformsModel.js';
import Anuncio from '../models/anunciosModel.js';

import fs from 'fs/promises'; // Importar módulo de promesas para ESM
import path from 'path';
// import { v4 as uuidv4 } from 'uuid';
import { enviarMensajeACliente, obtenerClientesActivos } from '../socket/socketServer.mjs';
import FileManager from '../models/fileManagerModel.js';
import { generateRandomCoupon, getSerialFromFile } from '../utils/utils.js';
import { generateUniqueItemCode } from '../utils/itemLoanUtils.js';
import UserCredits from '../models/Trades/userCreditsModel.js';
import TradeChats from '../models/Trades/tradeChatsModel.js';
import TradeActions from '../models/Trades/tradeActionsModel.js';
import Marketplace from '../models/Trades/marketPlaceModel.js';
import TempUserItemInfo from '../models/Trades/tempUserItemInfoModel.js';
import ItemImage from '../models/itemImagesModel.js';
import User from '../models/userModel.js';
import PendingPresents from '../models/pendingPresentsModel.js';
import PaymentMethods from '../models/Trades/paymentMethodsModel.js';
import CharacterInfoLog from '../models/characterInfoLogModel.js';
import couponCache from '../modules/coupons/coupon.cache.js';
import WebUser from '../models/webUsersModel.js';
import marketService from './marketService.js';
import publicDataCache, {
  PUBLIC_CACHE_KEYS,
  PUBLIC_CACHE_TTL,
} from '../modules/public/publicData.cache.js';
import ConfigParameters from '../models/configParametersModel.js';
import TipoParametro from '../models/tipoParametroModel.js';
import ClaseParametro from '../models/claseParametroModel.js';
import configParameterCache from '../modules/events/configParameter.cache.js';
import recargasPackCache from '../modules/gm/recargasPack.cache.js';
import logTablesCache from '../modules/logs/logTables.cache.js';
import TypePrize from '../models/typePrizesModel.js';
import TypeOrigenReward from '../models/typeOrigenRewardModel.js';
import TypeEvents from '../models/typeEventsModel.js';
import TypeLogsGM from '../models/typeLogsGMModel.js';
import TypeLogsStreamers from '../models/typeLogsStreamersModel.js';
import ItemTraceOrigin from '../models/itemTraceOriginModel.js';
import ItemTraceAction from '../models/itemTraceActionModel.js';
import { ITEM_TRACE_ACTIONS, ITEM_TRACE_ORIGINS } from '../utils/itemTraceConstants.js';
import {
  buildUniqueAccountItemReason,
  checkUniqueAccountItemAvailability,
  isUniqueAccountItem,
} from '../utils/uniqueAccountItems.js';

const SUPER_GM_TYPE = 9;
const PACK_RECHARGE_GM_TYPES = [0, 2, 4, SUPER_GM_TYPE];

const LOG_MODEL_MAP = {
  TempCupon,
  Cupon,
  LogExchange,
  LogPanelGM,
  LogRewardsUser,
  LogStream,
  LogItemLoan,
  ItemTraceLog,
};

const LOG_FILTER_SOURCE_MAP = {
  typePrizes: TypePrize,
  typeOrigenReward: TypeOrigenReward,
  typeEvents: TypeEvents,
  typeLogsGM: TypeLogsGM,
  typeLogsStreamers: TypeLogsStreamers,
  itemTraceOrigins: ItemTraceOrigin,
  itemTraceActions: ItemTraceAction,
};

const LOG_METADATA_CACHE_TTL_MS = 5 * 60 * 1000;
const logSourceOptionsCache = new Map();
let logTablesMetadataCache = null;
let logTablesMetadataCachedAt = 0;

const normalizeLogFilters = (filters) => {
  if (!filters) return [];
  if (Array.isArray(filters)) return filters;

  if (typeof filters === 'string') {
    try {
      const parsed = JSON.parse(filters);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
};

const normalizeLogPageSize = (pageSize) => {
  const parsed = Number(pageSize);
  if (!Number.isFinite(parsed)) return 25;
  return Math.min(Math.max(parsed, 5), 100);
};

const normalizeLogPage = (page) => {
  const parsed = Number(page);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(parsed, 0);
};

const parseValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

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

            const [characters, cashList, activeLoanRows] = await Promise.all([
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
              ItemLoan.findAll({
                attributes: [
                  'userid',
                  [Sequelize.fn('COUNT', Sequelize.col('id')), 'active_loans'],
                ],
                where: {
                  userid: {
                    [Op.in]: userIds
                  },
                  status: 1,
                },
                group: ['userid'],
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

            const activeLoansMap = {};
            for (const row of activeLoanRows) {
              activeLoansMap[row.userid] = Number(row.active_loans || 0);
            }

            // Usuarios enriquecidos
            const fullUsers = matchedUsers.map(u => ({
              id: u.id,
              name: u.name,
              personajes: charactersMap[u.id] || [],
              gold: u.gold,
              cash: cashMap[u.name] || 0,
              ep: u.clanpoint || 0,
              activeLoans: activeLoansMap[u.id] || 0,
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
          publicDataCache.invalidate(PUBLIC_CACHE_KEYS.ANNOUNCEMENTS);
          
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

     async validateMarketplaceAdminAccess(user, token, transaction) {
        const sessionToken = await TokenSession.findOne({
            attributes: ['token'],
            where: {
                token,
                id: user,
            },
            transaction,
        });

        if (!sessionToken) {
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
            transaction,
        });

        if (!existGM) {
            return {
                success: false,
                code: '001',
                message: 'Usted no puede gestionar publicaciones de marketplace porque ya no es GM.'
            };
        }

        return null;
     }

     async buildMarketPublicationsWithoutChatRows({ page = 1, pageSize = 20, filters = {}, transaction, paginate = true }) {
        const currentPage = Number(page) > 0 ? Number(page) : 1;
        const currentPageSize = Number(pageSize) > 0 ? Number(pageSize) : 20;
        const safeFilters = filters || {};
        const filterMarketId = safeFilters.market_id ? Number(safeFilters.market_id) : null;
        const filterSeller = (safeFilters.usuario || safeFilters.vendedor)
            ? String(safeFilters.usuario || safeFilters.vendedor).trim().toLowerCase()
            : '';
        const filterItem = safeFilters.item ? String(safeFilters.item).trim().toLowerCase() : '';

        const activeChats = await TradeChats.findAll({
            attributes: ['trade_id'],
            where: {
                status: {
                    [Op.in]: ['ACTIVE', 'COMPLETED']
                }
            },
            raw: true,
            transaction,
        });

        const busyTradeIds = [...new Set(
            activeChats
                .map((chat) => Number(chat.trade_id))
                .filter((id) => Number.isInteger(id) && id > 0)
        )];

        const marketWhere = { estado: 1 };

        if (filterMarketId) {
            marketWhere.id = filterMarketId;
        } else if (busyTradeIds.length) {
            marketWhere.id = { [Op.notIn]: busyTradeIds };
        }

        const marketRows = await Marketplace.findAll({
            where: marketWhere,
            order: [['fecha', 'DESC'], ['id', 'DESC']],
            transaction,
        });

        const tempIds = [...new Set(
            marketRows
                .map((item) => Number(item.itemid))
                .filter((id) => Number.isInteger(id) && id > 0)
        )];

        const tempRows = tempIds.length
            ? await TempUserItemInfo.findAll({
                where: { id: { [Op.in]: tempIds } },
                transaction,
            })
            : [];

        const tempMap = tempRows.reduce((acc, item) => {
            acc[item.id] = item;
            return acc;
        }, {});

        const itemIds = [...new Set(
            tempRows
                .map((item) => Number(item.itemid))
                .filter((id) => Number.isInteger(id) && id > 0)
        )];

        const sellerApodos = [...new Set(marketRows.map((item) => item.vendedor).filter(Boolean))];

        const [itemRows, imageRows, paymentRows, sellerRows] = await Promise.all([
            itemIds.length
                ? ItemInfo.findAll({ where: { id: { [Op.in]: itemIds } }, transaction })
                : [],
            itemIds.length
                ? ItemImage.findAll({ where: { item: { [Op.in]: itemIds } }, transaction })
                : [],
            PaymentMethods.findAll({ attributes: ['id', 'name', 'color', 'icon', 'type'], transaction }),
            sellerApodos.length
                ? User.findAll({
                    attributes: ['id', 'apodo'],
                    where: {
                        apodo: {
                            [Op.in]: sellerApodos
                        }
                    },
                    transaction,
                })
                : [],
        ]);

        const itemMap = itemRows.reduce((acc, item) => {
            acc[item.id] = item;
            return acc;
        }, {});

        const imageMap = imageRows.reduce((acc, item) => {
            acc[item.item] = item.image;
            return acc;
        }, {});

        const paymentMap = paymentRows.reduce((acc, item) => {
            acc[item.id] = item;
            return acc;
        }, {});

        const sellerMap = sellerRows.reduce((acc, item) => {
            acc[item.apodo] = item;
            return acc;
        }, {});

        let formatted = await Promise.all(marketRows.map(async (market) => {
            const marketData = market.toJSON();
            const temp = tempMap[market.itemid] || null;
            const itemInfo = temp ? itemMap[temp.itemid] : null;
            const sellerInfo = sellerMap[marketData.vendedor] || null;
            const className = itemInfo ? setClassName(itemInfo.Class) : '';
            const itemName = itemInfo ? `${itemInfo.name}${className}` : 'Desconocido';
            const frozenTemporal = Number(temp?.istemporal || 0) === 1;
            const frozenDays = Math.max(0, Number(temp?.dias) || 0);
            const limitTime = Number(temp?.limittime || 0);
            const isTemporal = frozenTemporal || limitTime > 0;
            const remainingPowerTime = !frozenTemporal && isTemporal
                ? await getRemainingPowerTime(limitTime)
                : { days: 0 };
            const payment = paymentMap[market.medio_pago] || null;

            return {
                market_id: marketData.id,
                vendedor: sellerInfo?.id || marketData.vendedor,
                vendedor_apodo: marketData.vendedor,
                vendedor_usuario: sellerInfo?.id || marketData.vendedor,
                precio: marketData.precio,
                medio_pago: marketData.medio_pago,
                fecha: marketData.fecha,
                itemid: temp?.itemid || null,
                temp_item_id: temp?.id || marketData.itemid,
                item_name: itemName,
                item_image: temp ? imageMap[temp.itemid] || null : null,
                uniqueitemcode: temp?.uniqueitemcode || null,
                isTemporal,
                remainingDays: frozenTemporal ? frozenDays : Math.max(0, Number(remainingPowerTime.days) || 0),
                payment: payment ? payment.toJSON() : null,
            };
        }));

        if (filterSeller) {
            formatted = formatted.filter((item) =>
                String(item.vendedor_usuario || '').toLowerCase().includes(filterSeller)
            );
        }

        if (filterItem) {
            formatted = formatted.filter((item) =>
                String(item.item_name || '').toLowerCase().includes(filterItem) ||
                String(item.itemid || '').includes(filterItem)
            );
        }

        const totalRecords = formatted.length;
        const offset = (currentPage - 1) * currentPageSize;
        const rows = paginate ? formatted.slice(offset, offset + currentPageSize) : formatted;

        return {
            publications: rows,
            pagination: {
                totalRecords,
                page: currentPage,
                pageSize: currentPageSize,
                totalPages: Math.ceil(totalRecords / currentPageSize),
            }
        };
     }

     async getMarketPublicationsWithoutChat(user, token, page = 1, pageSize = 20, filters = {}) {
        const t = await sequelize.transaction();

        try {
            const accessError = await this.validateMarketplaceAdminAccess(user, token, t);

            if (accessError) {
                await t.rollback();
                return accessError;
            }

            const result = await this.buildMarketPublicationsWithoutChatRows({
                page,
                pageSize,
                filters,
                transaction: t,
            });

            await t.commit();

            return {
                success: true,
                code: '000',
                message: 'ok',
                ...result,
            };
        } catch (error) {
            try {
                await t.rollback();
            } catch (_) {}

            console.error('Error en getMarketPublicationsWithoutChat:', error);
            return { success: false, code: '999', message: 'Error interno al obtener publicaciones.' };
        }
     }

     async cancelMarketPublication(user, token, marketId) {
        const numericMarketId = Number(marketId);

        if (!Number.isInteger(numericMarketId) || numericMarketId <= 0) {
            return { success: false, code: '200', message: 'Publicacion invalida.' };
        }

        const t = await sequelize.transaction();

        try {
            const accessError = await this.validateMarketplaceAdminAccess(user, token, t);

            if (accessError) {
                await t.rollback();
                return accessError;
            }

            const marketItem = await Marketplace.findOne({
                where: { id: numericMarketId },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (!marketItem) {
                await t.rollback();
                return { success: false, code: '200', message: 'Publicacion no encontrada.' };
            }

            if (Number(marketItem.estado) !== 1) {
                await t.rollback();
                return { success: false, code: '200', message: 'La publicacion ya no esta activa o tiene un chat en proceso.' };
            }

            const activeChat = await TradeChats.findOne({
                attributes: ['id'],
                where: {
                    trade_id: numericMarketId,
                    status: {
                        [Op.in]: ['ACTIVE', 'COMPLETED']
                    }
                },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (activeChat) {
                await t.rollback();
                return { success: false, code: '200', message: 'La publicacion tiene un chat activo o completado.' };
            }

            const seller = marketItem.vendedor;
            await t.commit();

            const returned = await marketService.returnItem(seller, null, numericMarketId, 3, undefined, true, {
                actor: user,
                reason: `Item retornado por cancelacion de publicacion marketplace #${numericMarketId}`,
            });

            if (!returned.success) {
                return {
                    success: false,
                    code: returned.code || '200',
                    message: returned.code === '201'
                        ? 'El vendedor no tiene espacio disponible en su inventario.'
                        : returned.message || 'No se pudo retornar la publicacion.',
                };
            }

            await LogPanelGM.create({
                userAction: user,
                action: 'Cancelar publicacion marketplace',
                user: numericMarketId,
                amount: 0,
                type: 21,
                date: new Date(),
            });

            return {
                success: true,
                code: '000',
                message: 'Publicacion cancelada y item retornado al vendedor.',
                publication_id: numericMarketId,
            };
        } catch (error) {
            try {
                await t.rollback();
            } catch (_) {}

            console.error('Error en cancelMarketPublication:', error);
            return { success: false, code: '999', message: 'Error interno al cancelar publicacion.' };
        }
     }

     async cancelMarketPublications(user, token, marketIds = [], filters = {}, cancelFiltered = false) {
        let idsToCancel = [];

        if (cancelFiltered) {
            const t = await sequelize.transaction();

            try {
                const accessError = await this.validateMarketplaceAdminAccess(user, token, t);

                if (accessError) {
                    await t.rollback();
                    return accessError;
                }

                const result = await this.buildMarketPublicationsWithoutChatRows({
                    page: 1,
                    pageSize: 1,
                    filters,
                    transaction: t,
                    paginate: false,
                });

                idsToCancel = result.publications.map((item) => item.market_id);
                await t.commit();
            } catch (error) {
                try {
                    await t.rollback();
                } catch (_) {}

                console.error('Error al preparar cancelacion de publicaciones:', error);
                return { success: false, code: '999', message: 'Error interno al preparar publicaciones.' };
            }
        } else {
            idsToCancel = Array.isArray(marketIds)
                ? marketIds
                    .map((id) => Number(id))
                    .filter((id) => Number.isInteger(id) && id > 0)
                : [];
        }

        idsToCancel = [...new Set(idsToCancel)];

        if (!idsToCancel.length) {
            return {
                success: false,
                code: '200',
                message: 'No hay publicaciones para cancelar con los filtros indicados.',
                publications_success: [],
                publications_werror: []
            };
        }

        const publicationsSuccess = [];
        const publicationsWithError = [];

        for (const marketId of idsToCancel) {
            const response = await this.cancelMarketPublication(user, token, marketId);

            if (response?.code === '000') {
                publicationsSuccess.push(marketId);
            } else {
                publicationsWithError.push({
                    market_id: marketId,
                    message: response?.message || 'No se pudo cancelar la publicacion.'
                });
            }
        }

        return {
            success: true,
            code: '000',
            message: 'Proceso de cancelacion de publicaciones finalizado.',
            publications_success: publicationsSuccess,
            publications_werror: publicationsWithError
        };
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
                order: [['id', 'DESC']],
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
          publicDataCache.invalidate(PUBLIC_CACHE_KEYS.STREAMERS);
          
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
          attributes:['id', 'type'],
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
        publicDataCache.invalidate(PUBLIC_CACHE_KEYS.STREAMERS);
        
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

      async getLogSourceOptions(source) {
        const SourceModel = LOG_FILTER_SOURCE_MAP[source];

        if (!SourceModel) {
          return [];
        }

        const cachedOptions = logSourceOptionsCache.get(source);

        if (cachedOptions && Date.now() - cachedOptions.cachedAt < LOG_METADATA_CACHE_TTL_MS) {
          return cachedOptions.options.map((option) => ({ ...option }));
        }

        const rows = await SourceModel.findAll({
          attributes: ['id', 'tipo'],
          order: [['id', 'ASC']],
          raw: true,
        });

        const options = rows.map((row) => ({
          value: Number(row.id),
          label: row.tipo,
        }));

        logSourceOptionsCache.set(source, {
          options,
          cachedAt: Date.now(),
        });

        return options.map((option) => ({ ...option }));
      }

      async getLogTablesMetadata() {
        if (logTablesMetadataCache && Date.now() - logTablesMetadataCachedAt < LOG_METADATA_CACHE_TTL_MS) {
          return logTablesMetadataCache.map((table) => ({
            ...table,
            defaultSort: { ...table.defaultSort },
            columns: table.columns.map((column) => ({
              ...column,
              options: [...(column.options || [])],
            })),
          }));
        }

        const tables = await logTablesCache.getAll();
        const sources = [...new Set(
          tables.flatMap((table) => table.columns.map((column) => column.source).filter(Boolean))
        )];
        const sourceOptionEntries = await Promise.all(
          sources.map(async (source) => [source, await this.getLogSourceOptions(source)])
        );
        const sourceOptions = Object.fromEntries(sourceOptionEntries);

        logTablesMetadataCache = tables.map((table) => ({
          ...table,
          columns: table.columns.map((column) => ({
            ...column,
            options: column.source ? sourceOptions[column.source] || [] : [],
          })),
        }));
        logTablesMetadataCachedAt = Date.now();

        return logTablesMetadataCache.map((table) => ({
          ...table,
          defaultSort: { ...table.defaultSort },
          columns: table.columns.map((column) => ({
            ...column,
            options: [...(column.options || [])],
          })),
        }));
      }

      async getCouponGeneratorMap(couponTickets) {
        const cleanTickets = [...new Set(
          (couponTickets || [])
            .map((ticket) => String(ticket || '').trim())
            .filter((ticket) => ticket)
        )];

        if (cleanTickets.length === 0) {
          return {};
        }

        const [gmRows, streamerRows] = await Promise.all([
          LogPanelGM.findAll({
            attributes: ['userAction', 'cupon', 'date'],
            where: {
              cupon: { [Op.in]: cleanTickets },
              type: 3,
            },
            order: [['date', 'DESC']],
            raw: true,
          }),
          LogStream.findAll({
            attributes: ['user', 'cupon', 'date'],
            where: {
              cupon: { [Op.in]: cleanTickets },
            },
            order: [['date', 'DESC']],
            raw: true,
          }),
        ]);

        const generatorRows = [
          ...gmRows.map((row) => ({
            generator: row.userAction,
            cupon: row.cupon,
            date: row.date,
          })),
          ...streamerRows.map((row) => ({
            generator: row.user,
            cupon: row.cupon,
            date: row.date,
          })),
        ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

        return generatorRows.reduce((map, row) => {
          const coupon = String(row.cupon || '');

          if (coupon && !map[coupon]) {
            map[coupon] = row.generator || '-';
          }

          return map;
        }, {});
      }

      getCouponGeneratorLiteral() {
        return Sequelize.literal(`(
          COALESCE(
            (
              SELECT lg.userAction
              FROM logpanelgm AS lg
              WHERE lg.cupon = \`cupon\`.\`ticket\` AND lg.type = 3
              ORDER BY lg.date DESC
              LIMIT 1
            ),
            (
              SELECT ls.user
              FROM logstreams AS ls
              WHERE ls.cupon = \`cupon\`.\`ticket\`
              ORDER BY ls.date DESC
              LIMIT 1
            )
          )
        )`);
      }

      findLogColumn(table, columnName) {
        return table.columns.find((column) => (
          column.key === columnName || column.field === columnName
        ));
      }

      getFilterForColumn(table, filters, column) {
        if (!column) return null;

        return normalizeLogFilters(filters).find((filter) => (
          filter.column === column.key
          || filter.column === column.field
          || filter.field === column.key
          || filter.field === column.field
        )) || null;
      }

      addCouponTicketConstraint(where, tickets) {
        const cleanTickets = [...new Set(
          (tickets || [])
            .map((ticket) => String(ticket || '').trim())
            .filter((ticket) => ticket)
        )];
        const ticketConstraint = { [Op.in]: cleanTickets.length > 0 ? cleanTickets : ['__NO_COUPON_MATCH__'] };

        if (where.ticket) {
          where[Op.and] = [
            ...(where[Op.and] || []),
            { ticket: where.ticket },
            { ticket: ticketConstraint },
          ];
          delete where.ticket;
          return;
        }

        where.ticket = ticketConstraint;
      }

      addNumberInConstraint(where, field, values) {
        const cleanValues = [...new Set(
          (values || [])
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
        )];
        const nextConstraint = { [Op.in]: cleanValues.length > 0 ? cleanValues : [-1] };

        if (where[field]) {
          where[Op.and] = [
            ...(where[Op.and] || []),
            { [field]: where[field] },
            { [field]: nextConstraint },
          ];
          delete where[field];
          return;
        }

        where[field] = nextConstraint;
      }

      async getLoanUserMap(userIds) {
        const cleanIds = [...new Set(
          (userIds || [])
            .map((userId) => Number(userId))
            .filter((userId) => Number.isFinite(userId))
        )];

        if (cleanIds.length === 0) {
          return {};
        }

        const rows = await UserGameInfo.findAll({
          attributes: ['id', 'name'],
          where: {
            id: { [Op.in]: cleanIds },
          },
          raw: true,
        });

        return Object.fromEntries(rows.map((row) => [String(row.id), row.name]));
      }

      getLoanUserNameLiteral() {
        return Sequelize.literal(`(
          SELECT ug.name
          FROM usergameinfo AS ug
          WHERE ug.id = \`log_item_loans\`.\`userid\`
          LIMIT 1
        )`);
      }

      async applyComputedLogFilters(table, filters, where) {
        if (table.key === 'coupons-generated') {
          const adminColumn = table.columns.find((column) => column.computed === 'couponGenerator');
          const adminFilter = this.getFilterForColumn(table, filters, adminColumn);
          const adminValue = String(adminFilter?.value || '').trim();

          if (!adminValue) return where;

          const generatorCondition = adminFilter.operator === 'equals' || adminFilter.exact === true
            ? adminValue
            : { [Op.like]: `%${adminValue}%` };
          const [gmRows, streamerRows] = await Promise.all([
            LogPanelGM.findAll({
              attributes: ['cupon'],
              where: {
                type: 3,
                userAction: generatorCondition,
              },
              raw: true,
            }),
            LogStream.findAll({
              attributes: ['cupon'],
              where: {
                user: generatorCondition,
              },
              raw: true,
            }),
          ]);

          this.addCouponTicketConstraint(where, [
            ...gmRows.map((row) => row.cupon),
            ...streamerRows.map((row) => row.cupon),
          ]);
          return where;
        }

        if (table.key === 'item-loans') {
          const userColumn = table.columns.find((column) => column.computed === 'loanUser');
          const userFilter = this.getFilterForColumn(table, filters, userColumn);
          const userValue = String(userFilter?.value || '').trim();

          if (!userValue) return where;

          const userCondition = userFilter.operator === 'equals' || userFilter.exact === true
            ? userValue
            : { [Op.like]: `%${userValue}%` };
          const userRows = await UserGameInfo.findAll({
            attributes: ['id'],
            where: {
              name: userCondition,
            },
            raw: true,
          });

          this.addNumberInConstraint(where, 'userid', userRows.map((row) => row.id));
          return where;
        }

        return where;
      }

      buildLogOrder(table, sortColumn, sortField, sortDirection) {
        if (table.key === 'coupons-generated' && sortColumn?.computed === 'couponGenerator') {
          return [[this.getCouponGeneratorLiteral(), sortDirection], ['id', 'DESC']];
        }

        if (table.key === 'item-loans' && sortColumn?.computed === 'loanUser') {
          return [[this.getLoanUserNameLiteral(), sortDirection], ['id', 'DESC']];
        }

        return [[sortField, sortDirection]];
      }

      buildLogWhere(table, filters) {
        const where = {};
        const columnsByKey = new Map();

        table.columns.forEach((column) => {
          columnsByKey.set(column.key, column);
          if (column.field) {
            columnsByKey.set(column.field, column);
          }
        });

        normalizeLogFilters(filters).forEach((filter) => {
          const column = columnsByKey.get(filter.column) || columnsByKey.get(filter.field);

          if (!column || !column.filter || column.computed || column.type === 'actions') return;

          const field = column.field;

          switch (column.filter) {
            case 'number': {
              const min = filter.min !== '' && filter.min !== null && filter.min !== undefined ? Number(filter.min) : null;
              const max = filter.max !== '' && filter.max !== null && filter.max !== undefined ? Number(filter.max) : null;
              const value = filter.value !== '' && filter.value !== null && filter.value !== undefined ? Number(filter.value) : null;

              if (Number.isFinite(min) && Number.isFinite(max)) {
                where[field] = { [Op.between]: [min, max] };
              } else if (Number.isFinite(min)) {
                where[field] = { [Op.gte]: min };
              } else if (Number.isFinite(max)) {
                where[field] = { [Op.lte]: max };
              } else if (Number.isFinite(value)) {
                where[field] = value;
              }
              break;
            }
            case 'type': {
              const values = Array.isArray(filter.values) ? filter.values : [];
              const parsedValues = values
                .map((value) => Number(value))
                .filter((value) => Number.isFinite(value));

              if (parsedValues.length > 0) {
                where[field] = { [Op.in]: parsedValues };
              }
              break;
            }
            case 'date': {
              const from = parseValidDate(filter.from);
              const to = parseValidDate(filter.to);

              if (from && to) {
                where[field] = { [Op.between]: [from, to] };
              } else if (from) {
                where[field] = { [Op.gte]: from };
              } else if (to) {
                where[field] = { [Op.lte]: to };
              }
              break;
            }
            case 'text':
            default: {
              const value = String(filter.value || '').trim();

              if (value) {
                where[field] = filter.operator === 'equals' || filter.exact === true
                  ? value
                  : { [Op.like]: `%${value}%` };
              }
              break;
            }
          }
        });

        return where;
      }

      async formatLogRows(table, rows) {
        const needsCouponGenerator = table.columns.some((column) => column.computed === 'couponGenerator');
        const needsLoanUser = table.columns.some((column) => column.computed === 'loanUser');
        const sources = [...new Set(table.columns.map((column) => column.source).filter(Boolean))];
        const [couponGeneratorMap, loanUserMap, sourceOptionEntries] = await Promise.all([
          needsCouponGenerator ? this.getCouponGeneratorMap(rows.map((row) => row.ticket)) : Promise.resolve({}),
          needsLoanUser ? this.getLoanUserMap(rows.map((row) => row.userid)) : Promise.resolve({}),
          Promise.all(sources.map(async (source) => {
            const options = await this.getLogSourceOptions(source);
            return [
              source,
              Object.fromEntries(options.map((option) => [String(option.value), option.label])),
            ];
          })),
        ]);
        const sourceOptions = Object.fromEntries(sourceOptionEntries);

        return rows.map((row) => {
          const formatted = {};

          table.columns.forEach((column) => {
            if (column.type === 'actions') {
              formatted[column.key] = {
                action: column.action,
              };
              return;
            }

            if (column.computed === 'couponGenerator') {
              formatted[column.key] = couponGeneratorMap[String(row.ticket || '')] || '-';
              return;
            }

            if (column.computed === 'loanUser') {
              const userId = row.userid;
              formatted[column.key] = loanUserMap[String(userId)] || (userId ? `#${userId}` : '-');
              return;
            }

            const value = row[column.field];
            formatted[column.key] = column.source
              ? sourceOptions[column.source]?.[String(value)] || '-'
              : value ?? '-';
          });

          return formatted;
        });
      }

      async getLogs(user, token, query = {}) {
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

          const tables = await this.getLogTablesMetadata();
          const defaultTableKey = tables.find((table) => table.visible !== false)?.key || tables[0]?.key;
          const selectedTable = await logTablesCache.getByKey(query.table || defaultTableKey);

          if (!selectedTable) {
            return { success: true, code: '000', message: 'ok', tables: [], rows: [], total: 0, page: 0, pageSize: 25 };
          }

          const Model = LOG_MODEL_MAP[selectedTable.model];

          if (!Model) {
            return { success: false, code: '003', message: 'La tabla de logs no esta configurada correctamente.' };
          }

          const page = normalizeLogPage(query.page);
          const pageSize = normalizeLogPageSize(query.pageSize);
          const filters = normalizeLogFilters(query.filters);
          const where = this.buildLogWhere(selectedTable, filters);
          await this.applyComputedLogFilters(selectedTable, filters, where);
          const sortColumn = selectedTable.columns.find(
            (column) => column.sortable !== false && (column.key === query.sortBy || column.field === query.sortBy)
          );
          const sortField = sortColumn?.field || selectedTable.defaultSort.field;
          const sortDirection = String(query.sortDirection || selectedTable.defaultSort.direction).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
          const order = this.buildLogOrder(selectedTable, sortColumn, sortField, sortDirection);
          const computedDependencies = selectedTable.columns.some((column) => column.computed === 'loanUser')
            ? ['userid']
            : [];
          const attributes = [...new Set([
            ...selectedTable.columns
              .filter((column) => !column.computed && column.type !== 'actions')
              .map((column) => column.field),
            ...computedDependencies,
          ])];

          const result = await Model.findAndCountAll({
            attributes,
            where,
            order,
            limit: pageSize,
            offset: page * pageSize,
            raw: true,
          });

          const rows = await this.formatLogRows(selectedTable, result.rows);

          return {
            success: true,
            code: '000',
            message: 'ok',
            tables,
            table: selectedTable.key,
            rows,
            total: result.count,
            page,
            pageSize,
            sortBy: sortColumn?.key || selectedTable.defaultSort.field,
            sortDirection,
            filters,
            logs: [rows],
            lgn: tables.map((table) => table.label),
            fltlogs: tables.map((table) => table.columns.map((column) => column.filter)),
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
            type: SUPER_GM_TYPE,
          },
          transaction: t,
        });

        if(!existGM){
          await t.rollback();
          console.log("!![GM Panel]".red,' Recarga manual no autorizada'.red);
          return {
            success: false,
            code: '403',
            message: 'Solo un GM tipo 9 puede usar recargas manuales o descuentos. Usa recarga por paquete.'
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
                  clanpoint: {
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

  async getRecargasPack(user, token) {
    try {
      const sessionToken = await TokenSession.findOne({
        attributes: ['token'],
        where: {
          token,
          id: user,
        },
      });

      if (!sessionToken) {
        return {
          success: false,
          code: '002',
          message: 'Token invalido o tienes una sesion iniciada en otro navegador...'
        };
      }

      const existGM = await UsersPanel.findOne({
        attributes: ['id', 'type'],
        where: {
          user,
          type: {
            [Op.in]: PACK_RECHARGE_GM_TYPES,
          },
        },
      });

      if (!existGM) {
        return {
          success: false,
          code: '001',
          message: 'Usted no puede consultar paquetes de recarga porque ya no es GM.'
        };
      }

      await recargasPackCache.ensureLoaded();

      const packs = recargasPackCache.getAll();
      const doublePackActive = await this.isConfigParameterEnabled('flag_double_pack');

      return {
        success: true,
        code: '000',
        packs,
        doublePackActive,
      };
    } catch (error) {
      console.error('Error al obtener paquetes de recarga:', error);
      return {
        success: false,
        code: '500',
        message: 'Error al obtener paquetes de recarga.'
      };
    }
  }

  async getConfigParameters(user, token) {
    try {
      const sessionToken = await TokenSession.findOne({
        attributes: ['token'],
        where: {
          token,
          id: user,
        },
      });

      if (!sessionToken) {
        return {
          success: false,
          code: '002',
          message: 'Token invalido o tienes una sesion iniciada en otro navegador...'
        };
      }

      const existGM = await UsersPanel.findOne({
        attributes: ['id', 'type'],
        where: {
          user,
          type: SUPER_GM_TYPE,
        },
      });

      if (!existGM) {
        return {
          success: false,
          code: '403',
          message: 'Solo un GM tipo 9 puede administrar parametros.'
        };
      }

      await configParameterCache.ensureLoaded();

      const [parameterTypes, parameterClasses] = await Promise.all([
        TipoParametro.findAll({
          attributes: ['id', 'nombre', 'description'],
          order: [['id', 'ASC']],
          raw: true,
        }),
        ClaseParametro.findAll({
          attributes: ['id', 'nombre', 'description'],
          order: [['id', 'ASC']],
          raw: true,
        }),
      ]);

      return {
        success: true,
        code: '000',
        parameters: configParameterCache.getParameters(),
        parameterTypes,
        parameterClasses,
      };
    } catch (error) {
      console.error('Error al obtener parametros:', error);
      return {
        success: false,
        code: '500',
        message: 'Error al obtener parametros.'
      };
    }
  }

  normalizeParameterValue(value, clase) {
    const classType = Number(clase);

    if (classType === 0) {
      const normalized = value === true || value === 1 || value === '1' || value === 'true';
      return normalized ? '1' : '0';
    }

    if (classType === 1) {
      const numberValue = Number(value);

      if (!Number.isFinite(numberValue)) {
        return null;
      }

      return String(numberValue);
    }

    if (classType === 3) {
      try {
        const parsedValue = typeof value === 'string' ? JSON.parse(value) : value;
        return JSON.stringify(parsedValue);
      } catch (error) {
        return null;
      }
    }

    if (value === null || value === undefined) {
      return '';
    }

    return String(value);
  }

  serializeConfigParameter(parameter) {
    return {
      name: parameter.name,
      description: parameter.description || '',
      value: parameter.value,
      isparameter: Number(parameter.isparameter ?? 0),
      tipo: Number(parameter.tipo ?? 0),
      clase: Number(parameter.clase ?? 2),
    };
  }

  async isConfigParameterEnabled(name) {
    await configParameterCache.ensureLoaded();

    const value = configParameterCache.getValue(name, '0');
    return value === true ||
      value === 1 ||
      value === '1' ||
      String(value).toLowerCase() === 'true';
  }

  async updateConfigParameter(token, data, user, isDataIntegrityValid, paramsString, req) {
    const t = await sequelize.transaction();
    let committed = false;

    try {
      const verifyPacketEqual = (isDataIntegrityValid);
      const banInfo = await verifyPacketAndBan(user, user, paramsString, verifyPacketEqual, t, req);

      if (banInfo) {
        await t.rollback();
        return banInfo;
      }

      await TrackingPacket.create(
        {
          packet: paramsString,
          user,
          fecha_uso: new Date(),
        },
        { transaction: t }
      );

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
        attributes: ['id', 'type'],
        where: {
          user,
          type: SUPER_GM_TYPE,
        },
        transaction: t,
      });

      if (!existGM) {
        await t.rollback();
        return {
          success: false,
          code: '403',
          message: 'No estas autorizado para modificar parametros.'
        };
      }

      const name = String(data?.name || '').trim();

      if (!name) {
        await t.rollback();
        return {
          success: false,
          code: '003',
          message: 'Debe indicar un parametro valido.'
        };
      }

      const parameter = await ConfigParameters.findOne({
        where: {
          name,
          isparameter: 1,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!parameter) {
        await t.rollback();
        return {
          success: false,
          code: '004',
          message: 'El parametro no existe o no esta habilitado para edicion.'
        };
      }

      const previousValue = parameter.value;
      const nextValue = this.normalizeParameterValue(data?.value, parameter.clase);

      if (nextValue === null) {
        await t.rollback();
        return {
          success: false,
          code: '003',
          message: 'El valor ingresado no coincide con la clase del parametro.'
        };
      }

      parameter.value = nextValue;
      await parameter.save({ transaction: t });

      await LogPanelGM.create({
        userAction: user,
        action: 'Modificar parametro',
        user: name,
        amount: 0,
        type: 24,
        date: new Date(),
      }, { transaction: t });

      await t.commit();
      committed = true;

      configParameterCache.addOrUpdate(parameter);

      return {
        success: true,
        code: '000',
        message: 'Parametro actualizado correctamente.',
        parameter: {
          ...this.serializeConfigParameter(parameter),
        },
        previousValue,
      };
    } catch (error) {
      if (!committed) {
        await t.rollback();
      }
      console.error('Error al modificar parametro:', error);
      throw new Error('Error al modificar parametro');
    }
  }

  async updateConfigParameters(token, data, user, isDataIntegrityValid, paramsString, req) {
    const t = await sequelize.transaction();
    let committed = false;

    try {
      const verifyPacketEqual = (isDataIntegrityValid);
      const banInfo = await verifyPacketAndBan(user, user, paramsString, verifyPacketEqual, t, req);

      if (banInfo) {
        await t.rollback();
        return banInfo;
      }

      await TrackingPacket.create(
        {
          packet: paramsString,
          user,
          fecha_uso: new Date(),
        },
        { transaction: t }
      );

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
        attributes: ['id', 'type'],
        where: {
          user,
          type: SUPER_GM_TYPE,
        },
        transaction: t,
      });

      if (!existGM) {
        await t.rollback();
        return {
          success: false,
          code: '403',
          message: 'Solo un GM tipo 9 puede modificar parametros.'
        };
      }

      const requestedUpdates = Array.isArray(data?.parameters) ? data.parameters : [];
      const updatesByName = new Map();

      for (const item of requestedUpdates) {
        const name = String(item?.name || '').trim();

        if (name) {
          updatesByName.set(name, {
            name,
            value: item?.value,
          });
        }
      }

      const updates = [...updatesByName.values()];
      const names = updates.map((item) => item.name);

      if (updates.length === 0) {
        await t.rollback();
        return {
          success: false,
          code: '003',
          message: 'No hay parametros validos para guardar.'
        };
      }

      const parameters = await ConfigParameters.findAll({
        where: {
          name: {
            [Op.in]: names,
          },
          isparameter: 1,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const parametersByName = new Map(parameters.map((parameter) => [parameter.name, parameter]));
      const missingNames = names.filter((name) => !parametersByName.has(name));

      if (missingNames.length > 0) {
        await t.rollback();
        return {
          success: false,
          code: '004',
          message: `No se encontraron parametros habilitados: ${missingNames.join(', ')}.`
        };
      }

      const savedParameters = [];
      const changedParameters = [];
      const logRows = [];

      for (const update of updates) {
        const parameter = parametersByName.get(update.name);
        const nextValue = this.normalizeParameterValue(update.value, parameter.clase);

        if (nextValue === null) {
          await t.rollback();
          return {
            success: false,
            code: '003',
            message: `El valor ingresado para ${parameter.description || parameter.name} no coincide con la clase del parametro.`
          };
        }

        if (String(nextValue ?? '') === String(parameter.value ?? '')) {
          savedParameters.push(parameter);
          continue;
        }

        parameter.value = nextValue;
        await parameter.save({ transaction: t });
        savedParameters.push(parameter);
        changedParameters.push(parameter);

        logRows.push({
          userAction: user,
          action: 'Modificar parametro',
          user: parameter.name,
          amount: 0,
          type: 24,
          date: new Date(),
        });
      }

      if (logRows.length > 0) {
        await LogPanelGM.bulkCreate(logRows, { transaction: t });
      }

      await t.commit();
      committed = true;

      if (changedParameters.length > 0) {
        await configParameterCache.loadFromDatabase();
      }

      return {
        success: true,
        code: '000',
        message: changedParameters.length > 0
          ? `${changedParameters.length} parametro${changedParameters.length === 1 ? '' : 's'} actualizado${changedParameters.length === 1 ? '' : 's'} correctamente.`
          : 'No habia cambios pendientes para guardar.',
        parameters: savedParameters.map((parameter) => this.serializeConfigParameter(parameter)),
      };
    } catch (error) {
      if (!committed) {
        await t.rollback();
      }
      console.error('Error al modificar parametros:', error);
      throw new Error('Error al modificar parametros');
    }
  }

  async recargaPack(token, data, user, isDataIntegrityValid, paramsString, req) {
    const t = await sequelize.transaction();

    try {
      const verifyPacketEqual = (isDataIntegrityValid);
      const banInfo = await verifyPacketAndBan(user, user, paramsString, verifyPacketEqual, t, req);

      if (banInfo) {
        await t.rollback();
        return banInfo;
      }

      await TrackingPacket.create(
        {
          packet: paramsString,
          user,
          fecha_uso: new Date(),
        },
        { transaction: t }
      );

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
        console.log("!![GM Panel]".red, ' Sesion antigua'.red);
        return {
          success: false,
          code: '002',
          message: 'Token invalido o tienes una sesion iniciada en otro navegador...'
        };
      }

      const existGM = await UsersPanel.findOne({
        attributes: ['id', 'type'],
        where: {
          user,
          type: {
            [Op.in]: PACK_RECHARGE_GM_TYPES,
          },
        },
        transaction: t,
      });

      if (!existGM) {
        await t.rollback();
        console.log("!![GM Panel]".red, ' Recarga por paquete no autorizada'.red);
        return {
          success: false,
          code: '001',
          message: 'Usted no puede realizar recargas porque ya no es GM, esta sesion sera cerrada...'
        };
      }

      const packId = Number(data.pid || data.packId || data.id);
      const users = Array.isArray(data._lu) ? data._lu : [];

      if (!Number.isInteger(packId) || packId <= 0) {
        await t.rollback();
        return {
          success: false,
          code: '003',
          message: 'Debe seleccionar un paquete de recarga valido.'
        };
      }

      if (users.length === 0) {
        await t.rollback();
        return {
          success: false,
          code: '003',
          message: 'Debe seleccionar al menos un usuario para recargar.'
        };
      }

      await recargasPackCache.ensureLoaded();

      const pack = recargasPackCache.getById(packId);

      if (!pack) {
        await t.rollback();
        return {
          success: false,
          code: '004',
          message: 'El paquete de recarga seleccionado no existe.'
        };
      }

      const doublePackActive = await this.isConfigParameterEnabled('flag_double_pack');
      const packMultiplier = doublePackActive ? 2 : 1;
      const baseCash = Number(pack.cash || 0);
      const baseOro = Number(pack.oro || 0);
      const baseEventPoints = Number(pack.puntos || 0);
      const cash = baseCash * packMultiplier;
      const oro = baseOro * packMultiplier;
      const eventPoints = baseEventPoints * packMultiplier;
      const packActionSuffix = doublePackActive ? ' x2' : '';

      if (cash <= 0 && oro <= 0 && eventPoints <= 0) {
        await t.rollback();
        return {
          success: false,
          code: '003',
          message: 'El paquete seleccionado no tiene montos configurados.'
        };
      }

      const usersNoGold = [];
      const usersNoCash = [];
      const usersNoPoints = [];

      for (const u of users) {
        const targetUser = String(u?.name || '').trim();

        if (!targetUser) {
          continue;
        }

        const userGame = await UserGameInfo.findOne({
          attributes: ['id', 'gold', 'clanpoint'],
          where: { name: targetUser },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        const userCash = await Cash.findOne({
          attributes: ['id', 'cash'],
          where: { id: targetUser },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (cash > 0 && !userCash) {
          usersNoCash.push(targetUser);
        }

        if (oro > 0 && !userGame) {
          usersNoGold.push(targetUser);
        }

        if (eventPoints > 0 && !userGame) {
          usersNoPoints.push(targetUser);
        }

        if ((cash > 0 && !userCash) || ((oro > 0 || eventPoints > 0) && !userGame)) {
          continue;
        }

        if (cash > 0) {
          const beforeCash = Number(userCash.cash || 0);

          await Cash.increment(
            'cash',
            { by: cash, where: { id: targetUser }, transaction: t }
          );

          await LogRewardsUser.create({
            user: targetUser,
            origen: 2,
            recompensa: cash,
            tipo_recompensa: 2,
            last_pr: beforeCash,
            curr_pr: beforeCash + cash,
            fecha: new Date(),
          }, { transaction: t });

          await LogPanelGM.create({
            userAction: user,
            action: `Recarga Pack #${pack.id}${packActionSuffix} Cash`,
            user: targetUser,
            amount: cash,
            type: 2,
            date: new Date(),
          }, { transaction: t });
        }

        if (oro > 0) {
          const beforeOro = Number(userGame.gold || 0);

          await UserGameInfo.increment(
            'gold',
            { by: oro, where: { name: targetUser }, transaction: t }
          );

          await LogRewardsUser.create({
            user: targetUser,
            origen: 2,
            recompensa: oro,
            tipo_recompensa: 1,
            last_pr: beforeOro,
            curr_pr: beforeOro + oro,
            fecha: new Date(),
          }, { transaction: t });

          await LogPanelGM.create({
            userAction: user,
            action: `Recarga Pack #${pack.id}${packActionSuffix} Gold`,
            user: targetUser,
            amount: oro,
            type: 1,
            date: new Date(),
          }, { transaction: t });
        }

        if (eventPoints > 0) {
          const beforePoints = Number(userGame.clanpoint || 0);

          await UserGameInfo.increment(
            'clanpoint',
            { by: eventPoints, where: { name: targetUser }, transaction: t }
          );

          await LogRewardsUser.create({
            user: targetUser,
            origen: 2,
            recompensa: eventPoints,
            tipo_recompensa: 13,
            last_pr: beforePoints,
            curr_pr: beforePoints + eventPoints,
            fecha: new Date(),
          }, { transaction: t });

          await LogPanelGM.create({
            userAction: user,
            action: `Recarga Pack #${pack.id}${packActionSuffix} Puntos de Evento`,
            user: targetUser,
            amount: eventPoints,
            type: 11,
            date: new Date(),
          }, { transaction: t });
        }
      }

      if (cash > 0 && usersNoCash.length > 0) {
        await t.rollback();
        return {
          success: false,
          code: '003',
          message: 'Usuario(s) ' + JSON.stringify(usersNoCash) + ' no encontrado [CASH]'
        };
      }

      if (oro > 0 && usersNoGold.length > 0) {
        await t.rollback();
        return {
          success: false,
          code: '002',
          message: 'Usuario(s) ' + JSON.stringify(usersNoGold) + ' no encontrado [GOLD]'
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

      console.log("[GM Panel]".green, ' Recarga pack exitosa'.green);
      return {
        success: true,
        code: '000',
        message: `Pack #${pack.id} recargado correctamente`,
        doublePackActive,
        pack: {
          ...pack,
          cash,
          oro,
          puntos: eventPoints,
          originalCash: baseCash,
          originalOro: baseOro,
          originalPuntos: baseEventPoints,
          multiplier: packMultiplier,
        },
      };
    } catch (error) {
      await t.rollback();
      console.error('Error al recargar paquete:', error);
      throw new Error('Error al recargar paquete');
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
      publicDataCache.invalidate(PUBLIC_CACHE_KEYS.ANNOUNCEMENTS);
      
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

  async validateSuperGMSession(user, token, transaction = null) {
    const transactionOptions = transaction ? { transaction } : {};

    const sessionToken = await TokenSession.findOne({
      attributes: ['token'],
      where: {
        token,
        id: user,
      },
      ...transactionOptions,
    });

    if (!sessionToken) {
      return {
        success: false,
        code: '002',
        message: 'Token invalido o tienes una sesion iniciada en otro navegador...'
      };
    }

    const existGM = await UsersPanel.findOne({
      attributes: ['id', 'type'],
      where: {
        user,
        type: SUPER_GM_TYPE,
        ban: 0,
      },
      ...transactionOptions,
    });

    if (!existGM) {
      return {
        success: false,
        code: '403',
        message: 'Solo un GM tipo 9 puede administrar prestamos de items.'
      };
    }

    return null;
  }

  normalizePositiveIntegerList(values) {
    const list = Array.isArray(values) ? values : [];

    return [...new Set(
      list
        .map((value) => {
          const rawValue = value && typeof value === 'object'
            ? value.id ?? value.userid ?? value.userId ?? value.itemid ?? value.itemId
            : value;
          const parsedValue = Number(rawValue);

          return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
        })
        .filter((value) => value !== null)
    )];
  }

  normalizeLoanPageSize(pageSize) {
    const parsedPageSize = Number(pageSize);

    if (!Number.isFinite(parsedPageSize)) {
      return 25;
    }

    return Math.min(Math.max(parsedPageSize, 5), 100);
  }

  async buildLoanUniqueItemCode(userId, itemId, transaction) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const uniqueitemcode = generateUniqueItemCode({ userId, itemId });

      const [existingItem, existingLoan] = await Promise.all([
        UserItemInfo.findOne({
          attributes: ['id'],
          where: { uniqueitemcode },
          transaction,
        }),
        ItemLoan.findOne({
          attributes: ['id'],
          where: { uniqueitemcode },
          transaction,
        }),
      ]);

      if (!existingItem && !existingLoan) {
        return uniqueitemcode;
      }
    }

    throw new Error('No se pudo generar un codigo unico para el item.');
  }

  async getLoanItems(user, token, options = {}) {
    try {
      const authError = await this.validateSuperGMSession(user, token);

      if (authError) {
        return authError;
      }

      const search = String(options?.search || '').trim().toLowerCase();
      const limitValue = Number(options?.limit);
      const limit = Number.isFinite(limitValue)
        ? Math.min(Math.max(limitValue, 10), 200)
        : 0;

      const catalogItems = await publicDataCache.getOrLoad(
        PUBLIC_CACHE_KEYS.LOAN_ITEMS,
        PUBLIC_CACHE_TTL.VLONG,
        () => ItemInfo.findAll({
          attributes: [
            'id',
            'name',
            'type',
            'Class',
            'level',
            'gold',
            'cash',
            'hit1',
            'hit2',
            'hit3',
            'hit4',
            'chit',
            'ap',
            'hp',
            'maxcp',
            'power',
          ],
          order: [['id', 'ASC']],
          raw: true,
        })
      );

      const numericSearch = Number(search);
      const items = catalogItems
        .filter((item) => {
          if (!search) {
            return true;
          }

          const name = String(item.name || '').toLowerCase();
          const matchesName = name.includes(search);
          const matchesId = Number.isInteger(numericSearch) && Number(item.id) === numericSearch;

          return matchesName || matchesId;
        })
        .slice(0, limit > 0 ? limit : undefined);

      return {
        success: true,
        code: '000',
        items,
        cache: {
          scope: 'iteminfo',
          ttlMs: PUBLIC_CACHE_TTL.VLONG,
        },
      };
    } catch (error) {
      console.error('Error al obtener items para prestamos:', error);
      return {
        success: false,
        code: '500',
        message: 'Error al obtener items para prestamos.'
      };
    }
  }

  async getItemLoans(user, token, options = {}) {
    try {
      const authError = await this.validateSuperGMSession(user, token);

      if (authError) {
        return authError;
      }

      const page = Math.max(Number(options?.page) || 0, 0);
      const pageSize = this.normalizeLoanPageSize(options?.pageSize);
      const offset = page * pageSize;
      const statusValue = options?.status;
      const search = String(options?.search || '').trim();
      const where = {};

      if (statusValue !== undefined && statusValue !== null && statusValue !== '' && statusValue !== 'all') {
        const parsedStatus = Number(statusValue);

        if ([0, 1].includes(parsedStatus)) {
          where.status = parsedStatus;
        }
      }

      if (search) {
        const userSearchConditions = [
          {
            name: {
              [Op.like]: `%${search}%`,
            },
          },
        ];
        const numericSearch = Number(search);

        if (Number.isInteger(numericSearch) && numericSearch > 0) {
          userSearchConditions.push({ id: numericSearch });
        }

        const matchedUsers = await UserGameInfo.findAll({
          attributes: ['id'],
          where: {
            [Op.or]: userSearchConditions,
          },
          raw: true,
        });

        const matchedUserIds = matchedUsers.map((item) => Number(item.id));

        if (matchedUserIds.length === 0) {
          return {
            success: true,
            code: '000',
            loans: [],
            total: 0,
            page,
            pageSize,
            stats: {
              active: await ItemLoan.count({ where: { status: 1 } }),
              inactive: await ItemLoan.count({ where: { status: 0 } }),
            },
            userSummary: [],
          };
        }

        where.userid = {
          [Op.in]: matchedUserIds,
        };
      }

      const { rows, count } = await ItemLoan.findAndCountAll({
        where,
        order: [
          ['loaned_at', 'DESC'],
          ['id', 'DESC'],
        ],
        limit: pageSize,
        offset,
        raw: true,
      });

      const userIds = [...new Set(rows.map((row) => Number(row.userid)).filter(Boolean))];
      const itemIds = [...new Set(rows.map((row) => Number(row.itemid)).filter(Boolean))];

      const [usersInfo, itemsInfo, activeCount, inactiveCount, summaryRows] = await Promise.all([
        userIds.length > 0
          ? UserGameInfo.findAll({
              attributes: ['id', 'name'],
              where: {
                id: {
                  [Op.in]: userIds,
                },
              },
              raw: true,
            })
          : [],
        itemIds.length > 0
          ? ItemInfo.findAll({
              attributes: ['id', 'name', 'type', 'Class', 'level'],
              where: {
                id: {
                  [Op.in]: itemIds,
                },
              },
              raw: true,
            })
          : [],
        ItemLoan.count({ where: { status: 1 } }),
        ItemLoan.count({ where: { status: 0 } }),
        ItemLoan.findAll({
          attributes: [
            'userid',
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'items_count'],
          ],
          where: {
            status: 1,
          },
          group: ['userid'],
          order: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'DESC']],
          limit: 20,
          raw: true,
        }),
      ]);

      const usersMap = new Map(usersInfo.map((item) => [Number(item.id), item]));
      const itemsMap = new Map(itemsInfo.map((item) => [Number(item.id), item]));
      const missingSummaryUserIds = summaryRows
        .map((item) => Number(item.userid))
        .filter((userid) => userid && !usersMap.has(userid));

      if (missingSummaryUserIds.length > 0) {
        const summaryUsers = await UserGameInfo.findAll({
          attributes: ['id', 'name'],
          where: {
            id: {
              [Op.in]: missingSummaryUserIds,
            },
          },
          raw: true,
        });

        summaryUsers.forEach((item) => usersMap.set(Number(item.id), item));
      }

      const loans = rows.map((loan) => {
        const userInfo = usersMap.get(Number(loan.userid));
        const itemInfo = itemsMap.get(Number(loan.itemid));

        return {
          ...loan,
          user_name: userInfo?.name || String(loan.userid),
          item_name: itemInfo?.name || String(loan.itemid),
          item_type: itemInfo?.type,
          item_class: itemInfo?.Class,
          item_level: itemInfo?.level,
        };
      });

      return {
        success: true,
        code: '000',
        loans,
        total: count,
        page,
        pageSize,
        stats: {
          active: activeCount,
          inactive: inactiveCount,
        },
        userSummary: summaryRows.map((item) => {
          const userInfo = usersMap.get(Number(item.userid));

          return {
            userid: Number(item.userid),
            user_name: userInfo?.name || String(item.userid),
            items_count: Number(item.items_count || 0),
          };
        }),
      };
    } catch (error) {
      console.error('Error al obtener prestamos de items:', error);
      return {
        success: false,
        code: '500',
        message: 'Error al obtener prestamos de items.'
      };
    }
  }

  async grantItemLoans(token, data, user, isDataIntegrityValid, paramsString, req) {
    const t = await sequelize.transaction();
    let committed = false;

    try {
      const verifyPacketEqual = isDataIntegrityValid;
      const banInfo = await verifyPacketAndBan(user, user, paramsString, verifyPacketEqual, t, req);

      if (banInfo) {
        await t.rollback();
        return banInfo;
      }

      await TrackingPacket.create(
        {
          packet: paramsString,
          user,
          fecha_uso: new Date(),
        },
        { transaction: t }
      );

      const authError = await this.validateSuperGMSession(user, token, t);

      if (authError) {
        await t.rollback();
        return authError;
      }

      const userIds = this.normalizePositiveIntegerList(data?.users || data?._lu || data?.userIds);
      const itemIds = this.normalizePositiveIntegerList(data?.itemIds || data?.items);

      if (userIds.length === 0) {
        await t.rollback();
        return {
          success: false,
          code: '003',
          message: 'Debe seleccionar al menos un usuario.'
        };
      }

      if (itemIds.length === 0) {
        await t.rollback();
        return {
          success: false,
          code: '003',
          message: 'Debe seleccionar al menos un item.'
        };
      }

      if (userIds.length > 50 || itemIds.length > 30) {
        await t.rollback();
        return {
          success: false,
          code: '003',
          message: 'La solicitud supera el limite permitido para prestamos masivos.'
        };
      }

      const [targetUsers, itemInfos] = await Promise.all([
        UserGameInfo.findAll({
          attributes: ['id', 'name', 'bag'],
          where: {
            id: {
              [Op.in]: userIds,
            },
            ban: 0,
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        }),
        ItemInfo.findAll({
          attributes: ['id', 'name'],
          where: {
            id: {
              [Op.in]: itemIds,
            },
          },
          transaction: t,
          raw: true,
        }),
      ]);

      const usersMap = new Map(targetUsers.map((item) => [Number(item.id), item]));
      const itemsMap = new Map(itemInfos.map((item) => [Number(item.id), item]));
      const missingUsers = userIds.filter((id) => !usersMap.has(id));
      const missingItems = itemIds.filter((id) => !itemsMap.has(id));

      if (missingItems.length > 0) {
        await t.rollback();
        return {
          success: false,
          code: '004',
          message: `Items no encontrados: ${missingItems.join(', ')}.`
        };
      }

      const orderedUsers = userIds.map((id) => usersMap.get(id));
      const orderedItems = itemIds.map((id) => itemsMap.get(id));
      const loanPlanByUserId = new Map();
      const errorUsers = missingUsers.map((id) => ({
        userid: id,
        user_name: String(id),
        reason: 'Usuario no encontrado o baneado.',
      }));
      const usersReadyToLoan = [];

      for (const targetUser of orderedUsers) {
        if (!targetUser) {
          continue;
        }

        const distinctSlots = await UserItemInfo.findAll({
          attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('slot')), 'slot']],
          where: {
            userid: targetUser.id,
            characterid: 0,
          },
          raw: true,
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        const occupiedSlots = distinctSlots.map((slotRow) => Number(slotRow.slot));
        const bagCount = Math.max(Number(targetUser.bag || 1), 1);
        const maxSlotIndex = bagCount * 30 - 1;
        const freeSlots = [];
        const uniqueItemIds = orderedItems
          .map((item) => Number(item.id))
          .filter((itemId) => isUniqueAccountItem(itemId));

        for (let slot = 0; slot <= maxSlotIndex; slot++) {
          if (!occupiedSlots.includes(slot)) {
            freeSlots.push(slot);
          }
        }

        const [existingUniqueItems, pendingUniqueItems] = uniqueItemIds.length > 0
          ? await Promise.all([
              UserItemInfo.findAll({
                attributes: ['itemid'],
                where: {
                  userid: targetUser.id,
                  itemid: {
                    [Op.in]: uniqueItemIds,
                  },
                },
                raw: true,
                transaction: t,
                lock: t.LOCK.UPDATE,
              }),
              PendingPresents.findAll({
                attributes: ['present_id'],
                where: {
                  user_id: targetUser.id,
                  present_id: {
                    [Op.in]: uniqueItemIds,
                  },
                },
                raw: true,
                transaction: t,
                lock: t.LOCK.UPDATE,
              }),
            ])
          : [[], []];

        const existingUniqueItemIds = new Set([
          ...existingUniqueItems.map((item) => Number(item.itemid)),
          ...pendingUniqueItems.map((item) => Number(item.present_id)),
        ]);
        const plannedUniqueItemIds = new Set();
        const loanPlan = [];
        let nextFreeSlotIndex = 0;

        for (const item of orderedItems) {
          const itemId = Number(item.id);
          const itemLabel = item.name || `Item ${itemId}`;

          if (isUniqueAccountItem(itemId)) {
            let uniqueErrorReason = null;

            if (existingUniqueItemIds.has(itemId) || plannedUniqueItemIds.has(itemId)) {
              uniqueErrorReason = buildUniqueAccountItemReason(itemLabel);
            } else {
              const uniqueAvailability = await checkUniqueAccountItemAvailability({
                userGameId: targetUser.id,
                itemId,
                itemName: itemLabel,
                transaction: t,
                actionLabel: 'prestar',
              });

              if (!uniqueAvailability.allowed) {
                uniqueErrorReason = uniqueAvailability.reason;
              }
            }

            if (uniqueErrorReason) {
              errorUsers.push({
                userid: Number(targetUser.id),
                user_name: targetUser.name,
                itemid: itemId,
                item_name: itemLabel,
                reason: uniqueErrorReason,
              });
              continue;
            }
          }

          const freeSlot = freeSlots[nextFreeSlotIndex];

          if (freeSlot === undefined) {
            errorUsers.push({
              userid: Number(targetUser.id),
              user_name: targetUser.name,
              itemid: itemId,
              item_name: itemLabel,
              reason: 'No tiene slots suficientes para recibir este item.',
            });
            continue;
          }

          nextFreeSlotIndex += 1;

          if (isUniqueAccountItem(itemId)) {
            plannedUniqueItemIds.add(itemId);
          }

          loanPlan.push({
            item,
            slot: freeSlot,
          });
        }

        if (loanPlan.length > 0) {
          loanPlanByUserId.set(Number(targetUser.id), loanPlan);
          usersReadyToLoan.push(targetUser);
        }
      }

      const now = new Date();
      const createdLoans = [];
      const successUsersMap = new Map();

      for (const targetUser of usersReadyToLoan) {
        const loanPlan = loanPlanByUserId.get(Number(targetUser.id)) || [];

        for (const planItem of loanPlan) {
          const item = planItem.item;
          const uniqueitemcode = await this.buildLoanUniqueItemCode(targetUser.id, item.id, t);

          const userItem = await UserItemInfo.create(
            {
              userid: targetUser.id,
              characterid: 0,
              itemid: item.id,
              item_sn: '8000',
              sn_type: 3,
              level: 1,
              limittime: 0,
              slot: planItem.slot,
              exp: 0,
              uniqueitemcode,
            },
            { transaction: t }
          );

          const loan = await ItemLoan.create(
            {
              userid: targetUser.id,
              itemid: item.id,
              useriteminfo_id: userItem.id,
              uniqueitemcode,
              status: 1,
              loaned_at: now,
              returned_at: null,
            },
            { transaction: t }
          );

          await LogItemLoan.create(
            {
              loan_id: loan.id,
              gm_user: user,
              action: 'Prestar item',
              userid: targetUser.id,
              itemid: item.id,
              useriteminfo_id: userItem.id,
              uniqueitemcode,
              status: 1,
              date: now,
              detail: null,
            },
            { transaction: t }
          );

          await ItemTraceLog.create(
            {
              uniqueitemcode,
              itemid: item.id,
              origin_id: ITEM_TRACE_ORIGINS.LOAN,
              action_id: ITEM_TRACE_ACTIONS.LOAN_GRANT,
              from_user: user,
              to_user: String(targetUser.id),
              origin_ref_id: loan.id,
              temp_useriteminfo_id: null,
              useriteminfo_id: userItem.id,
              detail: `Prestado por ${user} a ${targetUser.name}`,
              date: now,
            },
            { transaction: t }
          );

          createdLoans.push({
            id: loan.id,
            userid: targetUser.id,
            user_name: targetUser.name,
            itemid: item.id,
            item_name: item.name,
            useriteminfo_id: userItem.id,
            uniqueitemcode,
            status: 1,
            loaned_at: now,
          });

          if (!successUsersMap.has(Number(targetUser.id))) {
            successUsersMap.set(Number(targetUser.id), {
              userid: Number(targetUser.id),
              user_name: targetUser.name,
              items_count: 0,
              items: [],
            });
          }

          const successUser = successUsersMap.get(Number(targetUser.id));
          successUser.items_count += 1;
          successUser.items.push({
            loan_id: loan.id,
            itemid: item.id,
            item_name: item.name,
            uniqueitemcode,
          });
        }
      }

      await t.commit();
      committed = true;

      const successUsers = [...successUsersMap.values()];
      const hasLoans = createdLoans.length > 0;

      return {
        success: hasLoans,
        code: hasLoans ? '000' : '200',
        message: hasLoans
          ? `${createdLoans.length} item(s) prestado(s) correctamente. ${errorUsers.length} usuario(s) con error.`
          : 'No se presto ningun item. Revisa los usuarios con error.',
        loans: createdLoans,
        successUsers,
        errorUsers,
      };
    } catch (error) {
      if (!committed) {
        await t.rollback();
      }

      console.error('Error al prestar items:', error);
      throw new Error('Error al prestar items');
    }
  }

  async returnItemLoan(token, data, user, isDataIntegrityValid, paramsString, req) {
    const t = await sequelize.transaction();
    let committed = false;

    try {
      const verifyPacketEqual = isDataIntegrityValid;
      const banInfo = await verifyPacketAndBan(user, user, paramsString, verifyPacketEqual, t, req);

      if (banInfo) {
        await t.rollback();
        return banInfo;
      }

      await TrackingPacket.create(
        {
          packet: paramsString,
          user,
          fecha_uso: new Date(),
        },
        { transaction: t }
      );

      const authError = await this.validateSuperGMSession(user, token, t);

      if (authError) {
        await t.rollback();
        return authError;
      }

      const loanId = Number(data?.loanId || data?.id);
      const uniqueitemcode = String(data?.uniqueitemcode || data?.code || '').trim();

      if ((!Number.isInteger(loanId) || loanId <= 0) && !uniqueitemcode) {
        await t.rollback();
        return {
          success: false,
          code: '003',
          message: 'Debe indicar el prestamo a retirar.'
        };
      }

      const whereLoan = Number.isInteger(loanId) && loanId > 0
        ? { id: loanId, status: 1 }
        : { uniqueitemcode, status: 1 };

      const loan = await ItemLoan.findOne({
        where: whereLoan,
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!loan) {
        await t.rollback();
        return {
          success: false,
          code: '004',
          message: 'El prestamo no existe o ya fue retirado.'
        };
      }

      let removedRows = 0;

      if (loan.useriteminfo_id) {
        removedRows = await UserItemInfo.destroy({
          where: {
            id: loan.useriteminfo_id,
            uniqueitemcode: loan.uniqueitemcode,
          },
          transaction: t,
        });
      }

      if (removedRows === 0) {
        removedRows = await UserItemInfo.destroy({
          where: {
            userid: loan.userid,
            itemid: loan.itemid,
            uniqueitemcode: loan.uniqueitemcode,
          },
          transaction: t,
        });
      }

      const now = new Date();

      loan.status = 0;
      loan.returned_at = now;
      await loan.save({ transaction: t });

      await LogItemLoan.create(
        {
          loan_id: loan.id,
          gm_user: user,
          action: 'Retirar item',
          userid: loan.userid,
          itemid: loan.itemid,
          useriteminfo_id: loan.useriteminfo_id,
          uniqueitemcode: loan.uniqueitemcode,
          status: 0,
          date: now,
          detail: removedRows > 0 ? null : 'No se encontro el item en useriteminfo al retirarlo.',
        },
        { transaction: t }
      );

      await ItemTraceLog.create(
        {
          uniqueitemcode: loan.uniqueitemcode,
          itemid: loan.itemid,
          origin_id: ITEM_TRACE_ORIGINS.LOAN,
          action_id: ITEM_TRACE_ACTIONS.LOAN_RETURN,
          from_user: String(loan.userid),
          to_user: user,
          origin_ref_id: loan.id,
          temp_useriteminfo_id: null,
          useriteminfo_id: loan.useriteminfo_id,
          detail: removedRows > 0
            ? `Prestamo retirado por ${user}`
            : `Prestamo retirado por ${user}; no se encontro el item en useriteminfo.`,
          date: now,
        },
        { transaction: t }
      );

      await t.commit();
      committed = true;

      return {
        success: true,
        code: '000',
        message: removedRows > 0
          ? 'Item retirado correctamente.'
          : 'Prestamo marcado como retirado. No se encontro el item en useriteminfo.',
        loan: {
          id: loan.id,
          userid: loan.userid,
          itemid: loan.itemid,
          useriteminfo_id: loan.useriteminfo_id,
          uniqueitemcode: loan.uniqueitemcode,
          status: 0,
          returned_at: now,
        },
      };
    } catch (error) {
      if (!committed) {
        await t.rollback();
      }

      console.error('Error al retirar item prestado:', error);
      throw new Error('Error al retirar item prestado');
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
