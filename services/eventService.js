import Ticket from '../models/ticketsModel.js';
import Cash from '../models/cashModel.js';
import UserGameInfo from '../models/userGameInfoModel.js';
import PendingPresents from '../models/pendingPresentsModel.js';
import TempPrize from '../models/tempPrizes.js'
import PrizesGame from '../models/prizesGamesModel.js';
import { Sequelize, Op, fn, col } from 'sequelize';
import sequelize from '../config/database.js';
import { verifyPacketAndBan } from '../utils/securityUtils.js';
import { encrypt,generateKey } from '../helpers/encryption.js';
import TicketOro from '../models/ticketsOroModel.js';
import User from '../models/userModel.js';
import UserItemInfo from '../models/userItemInfoModel.js';
import TempCupon from '../models/tempCupones.js';
import Cupon from '../models/cuponesModel.js';
import { calculatePowerUse, getAmountItem } from '../utils/prizesUtils.js';
import TokenSession from '../models/tokenSessionModel.js';
//import EventTickets from '../models/eventTicketsModel.js';
import TicketsMode from '../models/ticketsModeModel.js';
import ItemInfo from '../models/itemInfoModel.js';
import UserPoisons from '../models/userPoisonsModel.js';
import GameAuth from '../models/gameAuthModel.js';
import { generateRandomToken } from '../utils/authUtils.js';
import PumpkinsAuth from '../models/calabazasAuthModel.js';
import HotslotAuth from '../models/hotSlotAuthModel.js';
import SetItem from '../models/setItemsModel.js';
import Evento from '../models/eventosModel.js';
import LogRewardsUser from '../models/logRewardUserModel.js';
import gamesService from './gamesService.js';
import CharacterInfo from '../models/characterInfo.js';
import EventLevelCharacter from '../models/eventLevelChModel.js';
import Matches from '../models/matchesModel.js';
import TrackingPacket from '../models/trackingPacketModel.js';
import EventPoint from '../models/eventPointsModel.js';
import colors from "colors";
import EventsReview from '../models/eventsReviewModel.js';
import UserAsset from '../models/userAssetsModel.js';
import AssetPrice from '../models/assetsPriceModel.js';
import ConfigParameters from '../models/configParametersModel.js';
import Game4SpendingTracker from '../models/game4SpendingTrackerModel.js';
import Game4SpecialPrizeWin from '../models/game4SpecialPrizeWinModel.js';
import ValentinCards from '../models/Events/valentinCardsModel.js';
import couponCache from '../modules/coupons/coupon.cache.js';
import tempCouponCache from '../modules/coupons/tempCoupon.cache.js';
import EventTestUser from '../models/eventTestUserModel.js';
import publicDataCache, {
  PUBLIC_CACHE_KEYS,
  PUBLIC_CACHE_TTL,
} from '../modules/public/publicData.cache.js';
import prizeGameCache from '../modules/events/prizeGame.cache.js';
import eventTestUserCache from '../modules/events/eventTestUser.cache.js';
import configParameterCache from '../modules/events/configParameter.cache.js';
import game4SpecialPrizeUserCache from '../modules/events/game4SpecialPrizeUser.cache.js';
import { checkUniqueAccountItemAvailability } from '../utils/uniqueAccountItems.js';

const getDatabaseErrorCode = (error) => (
  error?.parent?.code ||
  error?.original?.code ||
  error?.code ||
  null
);

const isDatabaseConnectionError = (error) => {
  const name = error?.name || '';
  const code = getDatabaseErrorCode(error);

  return [
    'SequelizeConnectionError',
    'SequelizeConnectionRefusedError',
    'SequelizeHostNotFoundError',
    'SequelizeHostNotReachableError',
    'SequelizeAccessDeniedError',
    'SequelizeConnectionTimedOutError',
  ].includes(name) || [
    'ECONNREFUSED',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'ETIMEDOUT',
    'PROTOCOL_CONNECTION_LOST',
  ].includes(code);
};

const classifyCouponRedeemError = (error) => {
  const name = error?.name || '';
  const code = getDatabaseErrorCode(error);
  const message = String(error?.message || '').toLowerCase();

  if (isDatabaseConnectionError(error)) {
    return {
      success: false,
      code: '503',
      errorType: 'DATABASE_CONNECTION_ERROR',
      retryable: true,
      message: 'No se pudo conectar con la base de datos para canjear el cupon. Intenta nuevamente en unos minutos.',
      detail: code,
    };
  }

  if (name === 'SequelizeTimeoutError' || message.includes('timeout')) {
    return {
      success: false,
      code: '504',
      errorType: 'DATABASE_TIMEOUT',
      retryable: true,
      message: 'La base de datos tardo demasiado en responder al canje. Intenta nuevamente.',
      detail: code,
    };
  }

  if (code === 'ER_LOCK_DEADLOCK' || code === 'ER_LOCK_WAIT_TIMEOUT') {
    return {
      success: false,
      code: '409',
      errorType: 'DATABASE_LOCK',
      retryable: true,
      message: 'El canje se cruzo con otra solicitud simultanea. Intenta nuevamente en unos segundos.',
      detail: code,
    };
  }

  if (name === 'SequelizeUniqueConstraintError') {
    return {
      success: false,
      code: '409',
      errorType: 'DUPLICATE_REDEEM',
      retryable: false,
      message: 'El canje ya aparece registrado. Actualiza tu cuenta y revisa si el premio fue entregado.',
      detail: code,
    };
  }

  if (name === 'SequelizeForeignKeyConstraintError') {
    return {
      success: false,
      code: '500',
      errorType: 'DATABASE_REFERENCE_ERROR',
      retryable: false,
      message: 'No se pudo registrar el premio por una referencia interna invalida. Contacta a soporte.',
      detail: code,
    };
  }

  if (name.startsWith('Sequelize')) {
    return {
      success: false,
      code: '500',
      errorType: 'DATABASE_ERROR',
      retryable: true,
      message: 'La base de datos no pudo completar el canje. Intenta nuevamente o contacta a soporte.',
      detail: code,
    };
  }

  return {
    success: false,
    code: '500',
    errorType: 'COUPON_REDEEM_ERROR',
    retryable: true,
    message: 'El servidor no pudo completar el canje del cupon. Intenta nuevamente o contacta a soporte.',
    detail: code,
  };
};

const rollbackCouponTransaction = async (transaction) => {
  if (!transaction || transaction.finished) return;

  try {
    await transaction.rollback();
  } catch (rollbackError) {
    console.error('Error al revertir la transaccion del cupon:', rollbackError);
  }
};

const validateEventAccess = async (gameActive, type, user) => {
  if (!gameActive) {
    return {
      success: false,
      response: {
        success: false,
        code: '999',
        message: 'Este evento ya ha concluido. ¡Por favor, actualice la página!',
      },
    };
  }

  const isTestMode = Number(gameActive.mode) === 0;

  if (!isTestMode) {
    return {
      success: true,
      isTestMode: false,
    };
  }

  if (!eventTestUserCache.loaded) {
    await eventTestUserCache.loadFromDatabase();
  }

  if (!eventTestUserCache.has(type, user)) {
    return {
      success: false,
      response: {
        success: false,
        code: '999',
        message: 'Este evento está en modo test y no tienes acceso.',
      },
    };
  }

  return {
    success: true,
    isTestMode: true,
  };
};

const withTestModeParam = (params = {}, isTestMode = false) => (
  isTestMode
    ? { ...params, _testMode: true }
    : params
);

const GAME_4_SPEND_CONFIG = {
  1: {
    asset: 3,
    limitParameter: 'game_4_spend_limit_cash',
    fallbackLimit: 60000,
    fallbackTicketValue: 400,
  },
  3: {
    asset: 5,
    limitParameter: 'game_4_spend_limit_points',
    fallbackLimit: 7500,
    fallbackTicketValue: 50,
  },
};

const GAME_4_SPECIAL_PRIZE_CONFIG_NAME = 'game_4_special_box6_prize_ids';
const GAME_4_LAST_BOX_CLASS = 5;
const GAME_4_TICKET_PRICE_CACHE_TTL_MS = 5 * 60 * 1000;
const game4TicketPriceCache = new Map();

class EventService {
  getGame4SpendConfig(modality) {
    return GAME_4_SPEND_CONFIG[Number(modality)] || null;
  }

  async getNumberConfigParameter(name, fallback, transaction) {
    await configParameterCache.ensureLoaded();

    const value = Number(configParameterCache.getValue(name, fallback));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  async getJsonConfigParameter(name, fallback = []) {
    await configParameterCache.ensureLoaded();

    const rawValue = configParameterCache.getValue(name, null);

    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return fallback;
    }

    try {
      return JSON.parse(rawValue);
    } catch (_) {
      return fallback;
    }
  }

  async getGame4TicketPrice(modality, transaction) {
    const spendConfig = this.getGame4SpendConfig(modality);

    if (!spendConfig) {
      return null;
    }

    const cacheKey = String(spendConfig.asset);
    const cachedPrice = game4TicketPriceCache.get(cacheKey);

    if (cachedPrice && cachedPrice.expiresAt > Date.now()) {
      return cachedPrice.price;
    }

    const assetPrice = await AssetPrice.findOne({
      attributes: ['price'],
      where: { asset: spendConfig.asset },
    });

    const price = Number(assetPrice?.price);
    const resolvedPrice = Number.isFinite(price) && price > 0 ? price : spendConfig.fallbackTicketValue;

    game4TicketPriceCache.set(cacheKey, {
      price: resolvedPrice,
      expiresAt: Date.now() + GAME_4_TICKET_PRICE_CACHE_TTL_MS,
    });

    return resolvedPrice;
  }

  async getGame4SpendTracker(user, modality, transaction) {
    const normalizedModality = Number(modality);

    let tracker = await Game4SpendingTracker.findOne({
      where: {
        user,
        modalidad: normalizedModality,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!tracker) {
      const now = new Date();
      tracker = await Game4SpendingTracker.create(
        {
          user,
          modalidad: normalizedModality,
          spent_amount: 0,
          created_at: now,
          updated_at: now,
        },
        {
          transaction,
        }
      );
    }

    return tracker;
  }

  async getGame4SpentAmount(user, modality, transaction) {
    const normalizedModality = Number(modality);

    const tracker = await Game4SpendingTracker.findOne({
      attributes: ['spent_amount'],
      where: {
        user,
        modalidad: normalizedModality,
      },
      transaction,
    });

    return Number(tracker?.spent_amount || 0);
  }

  async addGame4Spend(user, modality, transaction) {
    const spendConfig = this.getGame4SpendConfig(modality);

    if (!spendConfig) {
      return null;
    }

    const tracker = await this.getGame4SpendTracker(user, modality, transaction);
    const ticketPrice = await this.getGame4TicketPrice(modality, transaction);
    tracker.spent_amount = Number(tracker.spent_amount || 0) + Number(ticketPrice || 0);
    tracker.updated_at = new Date();

    await tracker.save({ transaction });
    return tracker;
  }

  async isGame4SpendGuaranteeActive(user, modality, transaction) {
    const spendConfig = this.getGame4SpendConfig(modality);

    if (!spendConfig) {
      return false;
    }

    const spentAmount = await this.getGame4SpentAmount(user, modality, transaction);
    const spendLimit = await this.getNumberConfigParameter(
      spendConfig.limitParameter,
      spendConfig.fallbackLimit,
      transaction
    );

    return spentAmount >= spendLimit;
  }

  async resetGame4Spend(user, modality, matchId, transaction) {
    const spendConfig = this.getGame4SpendConfig(modality);

    if (!spendConfig) {
      return;
    }

    await this.getGame4SpendTracker(user, modality, transaction);

    const now = new Date();
    await Game4SpendingTracker.update(
      {
        spent_amount: 0,
        last_win_match_id: matchId,
        last_win_at: now,
        updated_at: now,
      },
      {
        where: { user },
        transaction,
      }
    );
  }

  async getGame4SpecialPrizeIds(transaction) {
    await configParameterCache.ensureLoaded();

    const rawValue = String(configParameterCache.getValue(GAME_4_SPECIAL_PRIZE_CONFIG_NAME, '') || '').trim();

    if (!rawValue) {
      return [];
    }

    let parsedValue = [];

    try {
      parsedValue = rawValue.startsWith('[')
        ? JSON.parse(rawValue)
        : rawValue.split(',');
    } catch (_) {
      parsedValue = [];
    }

    return [...new Set(
      parsedValue
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    )];
  }

  async getGame4BeneficiaryPrize(user, currentPrizes, specialPrizeIds, transaction) {
    if (!specialPrizeIds.length || !Array.isArray(currentPrizes) || !currentPrizes.length) {
      return null;
    }

    if (!await game4SpecialPrizeUserCache.has(user)) {
      return null;
    }

    await prizeGameCache.ensureLoaded();

    const prizeMap = new Map();

    for (const prizeId of specialPrizeIds) {
      const prize = prizeGameCache.getById(prizeId);

      if (prize && Number(prize.type_game) === 4 && Number(prize.clase) === GAME_4_LAST_BOX_CLASS) {
        prizeMap.set(Number(prize.id), {
          id: prize.id,
          orderPrize: prize.orderPrize,
          clase: prize.clase === null ? GAME_4_LAST_BOX_CLASS : Number(prize.clase),
          name: prize.name,
          url: prize.url,
          prob: Number(prize.probability || 0),
        });
      }
    }

    for (const prize of currentPrizes) {
      const prizeId = Number(prize.id);

      if (specialPrizeIds.includes(prizeId) && !prizeMap.has(prizeId)) {
        prizeMap.set(prizeId, prize);
      }
    }

    const candidatePrizeIds = specialPrizeIds.filter((prizeId) => prizeMap.has(prizeId));

    if (!candidatePrizeIds.length) {
      return null;
    }

    const winRows = await Game4SpecialPrizeWin.findAll({
      attributes: ['prizegame_id', 'wins'],
      where: {
        user,
        prizegame_id: {
          [Op.in]: candidatePrizeIds,
        },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const winsByPrize = winRows.reduce((acc, row) => {
      acc.set(Number(row.prizegame_id), Number(row.wins || 0));
      return acc;
    }, new Map());

    const pendingPrizeIds = candidatePrizeIds.filter((prizeId) => Number(winsByPrize.get(prizeId) || 0) === 0);

    if (!pendingPrizeIds.length) {
      return null;
    }

    const hasAnyConfiguredWin = candidatePrizeIds.some((prizeId) => Number(winsByPrize.get(prizeId) || 0) > 0);

    if (!hasAnyConfiguredWin) {
      const previousBox6Wins = await Matches.count({
        where: {
          user,
          game: 4,
          picked: '6',
        },
        transaction,
      });

      if (Number(previousBox6Wins || 0) > 0) {
        const randomIndex = Math.floor(Math.random() * pendingPrizeIds.length);
        return prizeMap.get(pendingPrizeIds[randomIndex]);
      }

      return null;
    }

    return prizeMap.get(pendingPrizeIds[0]);
  }

  async registerGame4SpecialPrizeWin(user, prizeGameId, matchId, specialPrizeIds, transaction) {
    const normalizedPrizeGameId = Number(prizeGameId);

    if (!specialPrizeIds.includes(normalizedPrizeGameId)) {
      return;
    }

    if (!await game4SpecialPrizeUserCache.has(user)) {
      return;
    }

    const now = new Date();
    let winRow = await Game4SpecialPrizeWin.findOne({
      where: {
        user,
        prizegame_id: normalizedPrizeGameId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!winRow) {
      await Game4SpecialPrizeWin.create(
        {
          user,
          prizegame_id: normalizedPrizeGameId,
          wins: 1,
          last_match_id: matchId,
          last_won_at: now,
          created_at: now,
          updated_at: now,
        },
        { transaction }
      );
      return;
    }

    winRow.wins = Number(winRow.wins || 0) + 1;
    winRow.last_match_id = matchId;
    winRow.last_won_at = now;
    winRow.updated_at = now;
    await winRow.save({ transaction });
  }

  async verifyUserTickets(userId) {
    try {
      const userTicket = await Ticket.findOne({
      attributes: ['tickets'],
          where: {
              id: userId,
          },
      });

      return userTicket ? (userTicket.tickets >= 1 ? '000' : '100') : null;
    } catch (error) {
      console.error('Error al verificar los tickets del usuario:', error);
      throw new Error('Error en el servidor');
    }
  }

  async getTickets(userId) {
    try {
      const userTicket = await Ticket.findOne({
      attributes: ['tickets','id'],
          where: {
              id: userId,
          },
      });

      const userTicketOro = await TicketOro.findOne({
        attributes: ['tickets','id'],
            where: {
                id: userId,
            },
        });
  

      return userTicket && userTicketOro ? {userTicket,userTicketOro} : null;
    } catch (error) {
      console.error('Error al obtener la cantidad de tickets:', error);
      throw new Error('Error en el servidor');
    }
  }

 /* async getTicketsEvents(userId,event) {
    try {
      const userTicket = await EventTickets.findOne({
      attributes: ['tickets','user'],
          where: {
              user: userId,
              event: event,
          },
      });

      return userTicket ? {tickets: userTicket.tickets} : {tickets:0};
    } catch (error) {
      console.error('Error al obtener la cantidad de tickets:', error);
      throw new Error('Error en el servidor');
    }
  }*/

  async decreaseTickets(token,typet,user,isDataIntegrityValid,paramsString, req) {
    const t = await sequelize.transaction();
    try {
      // Verificar el paquete utilizando la clase PacketVerifier

      const verifyPacketEqual = (isDataIntegrityValid);// && (userId === userId2) && ((ticketCount+operator) === resOp) && (ticketCount === ticketCount2) && (key1 === key2);
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
        return { success: false, code: '005', message: 'Token inválido o sesión antigua para este evento...' };
      }
      
      var type;

      switch (typet) {
        case 'topdm33':
          type = 2;
          break;
        case 'gmypd64':
          type = 1;
          break;
        default:
          break;
      }

      switch (type) {
        case 1:

          const userTicketsGold = await TicketOro.findOne({
            attributes: ['tickets'],
            where: {
              id: user,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          // Revertir la transacción en caso de error
          if(!userTicketsGold || userTicketsGold.tickets < 1){
            await t.rollback();
            return { success: false, code: '001', message:`No tiene tickets suficientes para usarlos en este evento. Refresca la página...` };
          }

           // Decrementar el ticket del usuario
           await TicketOro.decrement('tickets', {
            by: 1,
            where: {
              id: user,
            },
            transaction: t, // Asociar la transacción con esta operación
          });

          const NewUserTicketsGold = await TicketOro.findOne({
            attributes: ['tickets'],
            where: {
              id: user,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });


          await t.commit();

          return NewUserTicketsGold ? {success:true,code: '000',nto: NewUserTicketsGold.tickets} : {success:true,code: '000',nto:0};
          
          break;
        case 2:
          
          const userTickets = await Ticket.findOne({
            attributes: ['tickets'],
            where: {
              id: user,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          // Revertir la transacción en caso de error
          if(!userTickets || userTickets.tickets < 1){
            await t.rollback();
            return { success: false, code: '001', message:`No tiene tickets suficientes para jugar en este evento. Refresca la página...` };
          }

          // Decrementar el ticket del usuario
          await Ticket.decrement('tickets', {
            by: 1,
            where: {
              id: user,
            },
            transaction: t, // Asociar la transacción con esta operación
          });

          const NewUserTickets = await Ticket.findOne({
            attributes: ['tickets'],
            where: {
              id: user,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });


          await t.commit();

          return NewUserTickets ? {success:true,code: '000',ntc:NewUserTickets.tickets} : {success:true,code: '000',ntc:0};
          break;
      
        default:
          await t.rollback();
            return { success: false, code: '002', message:`No existe este tipo de tickets` };
          break;
      }

    } catch (error) {
      await t.rollback();
      console.error('Error al obtener la cantidad de tickets:', error);
      throw new Error('Error en el servidor');
    }
  }

  async setPartida(authGame,token,type,index,user,estado,isDataIntegrityValid,paramsString,modality, req) {
    const t = await sequelize.transaction();
    try {
      // Verificar el paquete utilizando la clase PacketVerifier

      const verifyPacketEqual = (isDataIntegrityValid);// && (userId === userId2) && ((ticketCount+operator) === resOp) && (ticketCount === ticketCount2) && (key1 === key2);
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
        return { success: false, code: '100', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      const gameActive = await Evento.findOne({
        attributes: ['id', 'mode'],
        where: {
          id: type,
          show: 1,
          estado: 1,
        },
        raw: true,
        transaction: t,
      });

      const eventAccess = await validateEventAccess(gameActive, type, user);

      if (!eventAccess.success) {
        await t.rollback();
        return eventAccess.response;
      }

      const isTestMode = eventAccess.isTestMode;

      // var const

      const goldPrizes = [];

      switch (estado) {
        case 0:
          // Eliminar partida:
          await Matches.update(
            type === 4 ? { estado: 0, status: 0 } : { estado: 0 }, //cambiar a codigo_base
            { where: { user: user, estado:1, game:type },
              transaction: t 
            },
          );

          await t.commit();
          return {success:true,code:'000'}

          break;
      
        case 1:
          // Crear o actualizar partida:
          const matchFound = await Matches.findOne({
            where: {
              user:user,
              estado:1,
              game: type,
            },
            transaction: t, // Asociar la transacción con esta consulta
            lock: t.LOCK.UPDATE,
          });
          //console.log('AAAA');


          switch (type) {
            case 4:
              // Verifico token...
              const tokenCount = await GameAuth.findOne({
                attributes: ['token'],
                where: {
                  token: authGame,
                  user: user,
                  type_game:type
                },
                transaction: t, // Asociar la transacción con esta consulta
              });

              if(!tokenCount){
                await t.rollback(); // Revertir la transacción en caso de error
                return { success: false, code: '301', message: 'Has abierto este juego en otra pestaña...' };
              }
              

              if(!matchFound){

                var nameAsset;
                var picas;
                
                if(modality == 1){
                  picas = await UserAsset.findOne({
                    where: {
                      user: user,
                      asset:3
                    },
                    transaction:t, // Asociar la transacción con esta consulta
                    lock: t.LOCK.UPDATE,
                  });
                  nameAsset = 'tickets de cash';
                } else if(modality == 3){
                   picas = await UserAsset.findOne({
                    where: {
                      user: user,
                      asset:5
                    },
                    transaction:t, // Asociar la transacción con esta consulta
                    lock: t.LOCK.UPDATE,
                  });
                   nameAsset = 'tickets de puntos';
                } else {
                  await t.rollback();
                  return { success: false, code: '001', message: 'Modalidad no válida para buscaminas' };
                }
                

                if(!isTestMode && (!picas || picas.amount < 1)){
                  await t.rollback(); // Revertir la transacción en caso de error
                  return { success: false, code: '001', message:`No tienes ${nameAsset} suficientes para jugar al buscaminas` };
                }

                // console.log(handleGetAssets)

               // Decrementar picas solo en eventos reales.
                if (!isTestMode) {
                  picas.amount -= 1;
                  await picas.save({transaction:t});
                  await this.addGame4Spend(user, modality, t);
                }
                // Creo una nueva partida...

                await Matches.create(
                  {
                    user: user,
                    partida: JSON.stringify([...Array(20).fill({ premio: null, presionada: false })]),
                    premios_obtenidos:JSON.stringify([]),
                    picked:String(0),
                    nombres:JSON.stringify([]),
                    modalidad: modality,
                    game:type,
                  },
                  {
                    transaction: t, // Asociar la transacción con esta operación
                  }
                );

                await t.commit();
                return {success:true,code:'000'};
              }

              // Actualizo partida...

              //Verificar cantidad de tickets gastados:
              // const numGames = await Matches.findAll({
              //   //attributes: [[Sequelize.fn('COUNT', Sequelize.literal('DISTINCT slot')), 'slots']],
              //   //group: ['name'],
              //   where: {
              //     user: user,
              //     game: 3,
              //   },
              //   transaction: t, // Asociar la transacción con esta consulta
              // });

              // const numWins = await TempPrize.findAll({
              //   //attributes: [[Sequelize.fn('COUNT', Sequelize.literal('DISTINCT slot')), 'slots']],
              //   //group: ['name'],
              //   where: {
              //     user: user,
              //     game: 3,
              //     prize: 8007, //Toro
              //   },
              //   transaction: t, // Asociar la transacción con esta consulta
              // });


              //console.log(numGames.length);
              //console.log(numWins.length);

              const probs = await this.getJsonConfigParameter(
                matchFound.modalidad == 1 ? 'game_4_probs' : 'game_4_probs_2',
                []
              );
              const probabilidades = Array.isArray(probs) ? probs : [];
                // probabilidades.push(1, 1, 1, 1,1,1);
              // } else{
                // probabilidades.push(1, 0.98, 0.80, 0.60,0.40,0.15);
              // }
              
              //console.log(probabilidades);
              //const probabilidades = [1, 1, 1, 1,1,1];

              //const index = 0; //luego vendra del front es la calabaza presionada por defecto 0

              const setcalabazas = JSON.parse(matchFound.partida);
              const setpremios = JSON.parse(matchFound.premios_obtenidos);
              const setnombres = JSON.parse(matchFound.nombres);


              if(setcalabazas[index].presionada){
                  await t.rollback(); // Revertir la transacción en caso de error
                  return { success: false, code: '001', message:`Ya le has dado click a esta caja` };
              }

               if(Number(matchFound.picked) === 6){
                  await t.rollback(); // Revertir la transacción en caso de error
                  return { success: false, code: '001', message:`Ya llegaste al máximo de cajas a romper` };
              }

              let nuevasCalabazas = [...setcalabazas];
              let nuevosPremios = [...setpremios];
              let nuevosNombres = [...setnombres];
              const spendGuaranteeActive = !isTestMode
                ? await this.isGame4SpendGuaranteeActive(user, matchFound.modalidad, t)
                : false;

              if (spendGuaranteeActive || Math.random() < probabilidades[Number(matchFound.picked)]){
                const dataPr = await this.getAllPrizes(type,t);
                const prizesByClass = dataPr.reduce((acc, prize) => {
                  const prizeClass = prize.clase === null ? 0 : Number(prize.clase);

                  const newItem = {
                    id: prize.id,
                    orderPrize: prize.orderPrize,
                    clase: prizeClass,
                    name: prize.name,
                    url: prize.url,
                    prob: Number(prize.probability || 0),
                  };

                  if (!acc.has(prizeClass)) {
                    acc.set(prizeClass, []);
                  }

                  acc.get(prizeClass).push(newItem);
                  return acc;
                }, new Map());
                const currentClass = Number(matchFound.picked);
                const currentPrizes = prizesByClass.get(currentClass);

                if (!currentPrizes || currentPrizes.length === 0) {
                  await t.rollback();
                  return { success: false, code: '001', message: 'No hay premios configurados para esta clase de buscaminas.' };
                }

                nuevasCalabazas[index] = {
                  ...setcalabazas[index],
                  presionada: true,
                };

                const specialPrizeIds = !isTestMode && type === 4 && currentClass === GAME_4_LAST_BOX_CLASS
                  ? await this.getGame4SpecialPrizeIds(t)
                  : [];

                let selectedPrize = await this.getGame4BeneficiaryPrize(
                  user,
                  currentPrizes,
                  specialPrizeIds,
                  t
                );

                if (!selectedPrize) {
                  const randomProb = Math.random();
                  var premioIndex;
                  let cumulativeProb = 0;

                  //console.log(prizes);

                  for (let i = 0; i < currentPrizes.length; i++) {
                    cumulativeProb += currentPrizes[i].prob;
                    if (randomProb <= cumulativeProb) {
                      premioIndex = i;
                      break;
                    }
                  }

                  if (premioIndex === undefined) {
                    premioIndex = currentPrizes.length - 1;
                  }

                  selectedPrize = currentPrizes[premioIndex];
                }

                const premio = selectedPrize.name;
                const id = selectedPrize.id;
                const premioUrl = selectedPrize.url;

                nuevasCalabazas[index].premio = premio;
                nuevosPremios = [...setpremios, id];
                nuevosNombres = [...setnombres, premio];
                nuevasCalabazas[index].premioUrl = premioUrl;
                nuevasCalabazas[index].prizeGameId = id;
                nuevasCalabazas[index].orderPrize = selectedPrize.orderPrize;
                nuevasCalabazas[index].clase = selectedPrize.clase;

                if (specialPrizeIds.length) {
                  await this.registerGame4SpecialPrizeWin(user, id, matchFound.id, specialPrizeIds, t);
                }

                //console.log('BBB');
                await Matches.update(
                  { partida: JSON.stringify(nuevasCalabazas),
                    premios_obtenidos:JSON.stringify(nuevosPremios),
                    picked:String(Number(matchFound.picked)+1),
                    nombres:JSON.stringify(nuevosNombres),
                  }, //cambiar a codigo_base
                  { where: { user: user,estado:1,game:type, },
                    transaction: t 
                  },
                );
                //console.log('CCCC');

                var ix = Number(matchFound.picked)+1;
                if (!isTestMode && ix === 6) {
                  await this.resetGame4Spend(user, matchFound.modalidad, matchFound.id, t);
                }

                console.log('Partida: '.magenta,'Ganó un premio'.green);
                await t.commit();
                return {success:true,code:'003',xc:false,_om2:nuevasCalabazas,_om3:nuevosPremios,_om4:nuevosNombres,_om5:ix,_guarantee: spendGuaranteeActive || undefined };

              } else {

                // Eliminar partida:
                await Matches.update(
                  { estado: 0, status: 0 }, //cambiar a codigo_base
                  { where: { user: user, estado:1, game:type },
                    transaction: t 
                  },
                );

                console.log('Partida: '.magenta,'Explotó una mina'.red);
                console.log('Win: '.magenta,'false'.red);
                nuevasCalabazas[index].premio = '¡Explotó!';
                nuevasCalabazas[index].premioUrl = '/pictures/extra/bomba.gif';
                var ix = Number(matchFound.picked)+1;
                await t.commit();
                return {success:true,code:'003',xc:true,_om2:nuevasCalabazas,_om3:nuevosPremios,_om4:nuevosNombres,_om5:ix };
              }

              break;
            case 5:
              //Cerrar nuevo juego...:
              // await t.rollback(); // Revertir la transacción en caso de error
              // return { success: false, code: '301', message: 'El juego ya no está disponible...' };

              // Verifico token...

              const tokenHot = await GameAuth.findOne({
                attributes: ['token'],
                where: {
                  token: authGame,
                  user: user,
                  type_game:type
                },
                transaction: t, // Asociar la transacción con esta consulta
              });

            
              if(!tokenHot){
                await t.rollback(); // Revertir la transacción en caso de error
                return { success: false, code: '301', message: 'Has abierto este juego en otra pestaña...' };
              }

              let hotProb = 0;

              
              const paramName = matchFound
                ? (matchFound.modalidad === 1 ? 'hot_slot_prob' : 'hot_slot_prob_2')
                : (modality === 1 ? 'hot_slot_prob' : 'hot_slot_prob_2');

              const probsHot = await ConfigParameters.findOne({
                where: { name: paramName },
                transaction: t,
              });

              hotProb = parseFloat(probsHot.value);

               const hotProbsNews = await ConfigParameters.findOne({
                where: { name: 'hot_probs_news' },
                transaction: t,
              });

              const parsedProbs = JSON.parse(hotProbsNews.value);

              /** New user probs */

              var isNew = false;

              const userGame = await UserGameInfo.findOne({
                      attributes: ['id'],
                      where: {
                          name: user,
                      },
                      transaction: t,
                  });

              // Sumar:
              const [sumCashItemResult] = await sequelize.query(
              `SELECT COALESCE(SUM(price), 0) AS total FROM logbuycashitem WHERE userid = ${userGame.id}`,
                  { type: sequelize.QueryTypes.SELECT, transaction: t }
              );

              // Sumar "buycash" en logbuypoweruser
              const [sumPowerUserResult] = await sequelize.query(
                  `SELECT COALESCE(SUM(buycash), 0) AS total FROM logbuypoweruser WHERE userid = ${userGame.id}`,
                  { type: sequelize.QueryTypes.SELECT, transaction: t }
              );
              const totalCashSpent = sumCashItemResult.total + sumPowerUserResult.total;

              const ticketsPlayed = await Matches.count({
                where: {
                  user: user,
                  estado: 0,
                  game: type,
                  modalidad: 1,
                },
                transaction: t,
              });

              const TICKET_COST = 900;
              const MAX_SPENT = 10000;
              const estimatedSpentByMatches = ticketsPlayed * TICKET_COST;

              if(totalCashSpent <= MAX_SPENT &&  estimatedSpentByMatches <= MAX_SPENT && modality == 1){
                  hotProb = 0.80;
                  isNew = true;
              } 
              /** New user probs END */

              console.log("Prob: "+ hotProb);
                
                let gp = await ConfigParameters.findOne({
                    where: { name: 'gold_prizes_hot' },
                    transaction:t,
                });

                if (gp && typeof gp.value === 'string') {
                  try {
                    // Parseamos la cadena de texto como JSON
                    const parsed = JSON.parse(gp.value);
                    
                    if (Array.isArray(parsed)) {
                      goldPrizes.push(...parsed);
                    } else {
                      console.error('El valor no es un array:', parsed);
                    }
                  } catch (err) {
                    console.error('Error al parsear los datos de game_4_probs:', err.message);
                  }
                }

              if(!matchFound){
                
                var nameAsset;
                var hot;
                
                if(modality == 1){
                  hot = await UserAsset.findOne({
                    where: {
                      user: user,
                      asset:3
                    },
                    transaction:t, // Asociar la transacción con esta consulta
                    lock: t.LOCK.UPDATE,
                  });
                  nameAsset = 'tickets de cash';
                } else{
                   hot = await UserAsset.findOne({
                    where: {
                      user: user,
                      asset:5
                    },
                    transaction:t, // Asociar la transacción con esta consulta
                    lock: t.LOCK.UPDATE,
                  });
                   nameAsset = 'tickets de puntos';
                }
                

                if(!isTestMode && (!hot || hot.amount < 1)){
                  await t.rollback(); // Revertir la transacción en caso de error
                  return { success: false, code: '001', message:`No tienes ${nameAsset} suficientes para jugar al buscaminas` };
                }

                // console.log(handleGetAssets)

               // Decrementar hot tickets solo en eventos reales.
                if (!isTestMode) {
                  hot.amount -= 1;
                  await hot.save({transaction:t});
                }

                if(Math.random() < hotProb){
                  //Pierdes :)
                  await t.commit();
                  return {success:true,code:'003',xc:false,message:'¡Perdiste! Mejor suerte para la próxima...' };
                } else {

                  const dataPr2 = await this.getAllPrizes(type,t);

                  const randomProb = Math.random();
                  var premioIndex;
                  let cumulativeProb = 0;
  
                  //console.log(prizes);

                  const probsToUse = isNew
                  ? parsedProbs
                  : dataPr2.map(p => p.probability);

                  console.log(probsToUse);
  
                  for (let i = 0; i < dataPr2.length; i++) {
                    cumulativeProb += probsToUse[i];
                    if (randomProb <= cumulativeProb) {
                      premioIndex = i;
                      break;
                    }
                  }

                  var newPr = [];
                  var newNo = [];
                  newPr.push(premioIndex+1);
                  newNo.push(dataPr2[premioIndex].name);

                  var valNext = false;
  
                  var message;

                  if(newPr.length === 1  && goldPrizes.includes(newPr[0]-1)){
                    valNext = true;
                    message = `Reclama tu(s) premio(s):  (${newNo.join(', ')}) o arriésgate y gira nuevamente...`;
                  } else if(newPr.length === 1 && !goldPrizes.includes(premioIndex)){
                    valNext = false;
                    message = `Reclama tu(s) premio(s):  (${newNo.join(', ')})`;
                  } else{
                    await t.rollback(); 
                    return { success: false, code: '001', message: 'No puedes obtener más premios' };
                  }

                  // Creo una nueva partida...

                  await Matches.create(
                    {
                      user: user,
                      partida: JSON.stringify([]),
                      premios_obtenidos:JSON.stringify(newPr),
                      picked:String(0),
                      nombres:JSON.stringify(newNo),
                      modalidad: modality,
                      game:type,
                    },
                    {
                      transaction: t, // Asociar la transacción con esta operación
                    }
                  );

                  await t.commit();
                  return {success:true,code:'003',xc:true,_om2:newNo,_om3:newPr,_om4:valNext,message };
                }
                
              }

              // Actualizo partida...

              const premioIn = JSON.parse(matchFound.premios_obtenidos);
              const premioName = JSON.parse(matchFound.nombres);

              let newPremios = [...premioIn];
              let newNombres = [...premioName];

              if(Math.random() < hotProb){

                // Eliminar partida:
                await Matches.update(
                  { estado: 0}, //cambiar a codigo_base
                  { where: { user: user, estado:1, game:type },
                    transaction: t 
                  },
                );

                if(premioIn.length === 1  && goldPrizes.includes(premioIn[0]-1)){
                  // retornar 400 de cash

                  // Actualizar el cash en Cash
                  // await Cash.increment(
                  //   'cash',
                  //   { by: 400, where: { id: user }, transaction: t }
                  // );

                  await t.commit();
                  // return {success:true,code:'003',xc:false,message:'Perdiste todos tus premios, pero se te retonó la mitad del valor del ticket...' };
                  return {success:true,code:'003',xc:false,message:'Perdiste todos tus premios...' };
                }

                //Pierdes :)
                await t.commit();
                return {success:true,code:'003',xc:false,message:'¡Perdiste! Mejor suerte para la próxima...' };

              } else{
                const dataPr = await this.getAllPrizes(type,t);

                const randomProb = Math.random();
                var premioIndex;
                let cumulativeProb = 0;

                //console.log(prizes);

                 const probsToUse = isNew
                  ? parsedProbs
                  : dataPr.map(p => p.probability);

                for (let i = 0; i < dataPr.length; i++) {
                  cumulativeProb += probsToUse[i];
                  if (randomProb <= cumulativeProb) {
                    premioIndex = i;
                    break;
                  }
                }
                
                var valNext = false;

                newPremios = [...premioIn, premioIndex+1];
                newNombres = [...premioName, dataPr[premioIndex].name];
                var message;

                if((premioIn.length === 1  && goldPrizes.includes(premioIn[0]-1)) ){
                  valNext = false;
                  message = `Reclama tu(s) premio(s):  (${newNombres.join(', ')})`;
                } else{
                  await t.rollback(); 
                  return { success: false, code: '001', message: 'No puedes obtener más premios' };
                }

                await Matches.update(
                  { premios_obtenidos:JSON.stringify(newPremios),
                    nombres:JSON.stringify(newNombres),
                  }, //cambiar a codigo_base
                  { where: { user: user,estado:1,game:type },
                    transaction: t 
                  },
                );

                await t.commit();
                return {success:true,code:'003',xc:true,_om2:newNombres,_om3:newPremios,_om4:valNext,message };

              }

              break;
            default:
              await t.rollback(); 
              return { success: false, code: '001', message: 'No existe este tipo de juego' };
              break;
          }

          break;
        case 2:
          
          //Obtener partida en curso
          const match = await Matches.findOne({
            // attributes: ['partida','premios_obtenidos','picked','nombres'],
            where: {
              user:user,
              estado:1,
              game: type,
            },
            transaction: t, // Asociar la transacción con esta consulta
             lock: t.LOCK.UPDATE,
          });

          const tokenGen = generateRandomToken();

          
          switch (type) {
            case 4:
              const pumpAuth = await GameAuth.findOne({
                where: {
                  user: user, // Cambia esto para usar el nombre de usuario correcto
                  type_game:type,
                },
                transaction: t, // Asociar la transacción con esta consulta
              });
    
              if(!pumpAuth){
                await GameAuth.create(
                  {
                    user: user,
                    token: tokenGen,
                    type_game:type,
                    date: new Date(),
                  },
                  {
                    transaction: t, // Asociar la transacción con esta operación
                  }
                );
              } else{
                await GameAuth.update(
                  { date: new Date(),
                    token: tokenGen,
                  },
                  {
                      where: { user: user,type_game:type },
                      transaction: t,
                  }
                );
              }

              if(!match){
                await t.commit();
                return {success:true,code:'000',_authg:tokenGen};
              }
    
              await t.commit();
              return {success:true,code:'002',_msv:match,message:'Tienes una partida en curso...',_authg:tokenGen};
              break;
            case 5:

               const slotAuth = await GameAuth.findOne({
                where: {
                  user: user, // Cambia esto para usar el nombre de usuario correcto
                  type_game:type,
                },
                transaction: t, // Asociar la transacción con esta consulta
              });
    
              if(!slotAuth){
                await GameAuth.create(
                  {
                    user: user,
                    token: tokenGen,
                    type_game:type,
                    date: new Date(),
                  },
                  {
                    transaction: t, // Asociar la transacción con esta operación
                  }
                );
              } else{
                await GameAuth.update(
                  { date: new Date(),
                    token: tokenGen,
                  },
                  {
                      where: { user: user,type_game:type },
                      transaction: t,
                  }
                );
              }

               let gp = await ConfigParameters.findOne({
                    where: { name: 'gold_prizes_hot' },
                    transaction:t,
                });

                if (gp && typeof gp.value === 'string') {
                  try {
                    // Parseamos la cadena de texto como JSON
                    const parsed = JSON.parse(gp.value);
                    
                    if (Array.isArray(parsed)) {
                      goldPrizes.push(...parsed);
                    } else {
                      console.error('El valor no es un array:', parsed);
                    }
                  } catch (err) {
                    console.error('Error al parsear los datos de game_4_probs:', err.message);
                  }
                }


              if(!match){
                await t.commit();
                return {success:true,code:'000',_authg:tokenGen};
              }

              var message;
              var valNext=false;

              var prem = JSON.parse(match.premios_obtenidos);
              var nom = JSON.parse(match.nombres);
    
              if(prem.length === 2){
                valNext = false;
                message = `Reclama tus premios prendientes:  (${nom.join(', ')})`;
              } else if(prem.length === 1 && goldPrizes.includes(prem[0]-1)){
                valNext = true;
                message = `Reclama tu premio prendiente:  (${nom.join(', ')}) o arriésgate y gira nuevamente...`;
              } else if(prem.length === 1 && !goldPrizes.includes(prem[0]-1)){
                valNext = false;
                message = `Reclama tu premio prendiente:  (${nom.join(', ')})`;
              }
    
              await t.commit();
              return {success:true,code:'002',_msv:match,message:'Tienes una partida en curso...',_authg:tokenGen,message,_om4:valNext};

              break;
            default:
              await t.rollback(); 
              return { success: false, code: '001', message: 'No existe este tipo de juego' };
              break;
          }
          
          break;
        default:
          await t.rollback();
          return {success:false,code:'001',message:'No existe esta acción para este evento...'};
          break;
      }

      //const LOPKJ=generateKey();
      //return NewUserTickets ? {success:true,code: '000',LOPKJ,OIOII: encrypt(String(NewUserTickets.tickets),LOPKJ)} : {success:true,code: '000',LOPKJ,OIOII:encrypt(String(0),LOPKJ)};
    } catch (error) {
      await t.rollback();
      console.error('Error al setear u obtener partida:', error);
      throw new Error('Error en el servidor');
    }
  }

  async verifyToken(user,token) {
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
        return { success: false, code: '001', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para jugar' };
      }

      await t.commit();
      return {success:true,code: '000'};
    } catch (error) {
      await t.rollback();
      console.error('Error al verificar token:', error);
      throw new Error('Error en el servidor');
    }
  }

  async getSlots(user) {
    try {
      const userId = await UserGameInfo.findOne({
        attributes:['id'],
        where:{
          name: user
        }
      });

      const result = await UserItemInfo.findOne({
        attributes: [[Sequelize.fn('COUNT', Sequelize.literal('DISTINCT slot')), 'slots']],
        //group: ['name'],
        where: {
          userid: userId.id,
          slot: {
            [Sequelize.Op.ne]: null,
          },
        },
      });

      return result;
    } catch (error) {
      console.error('Error al contar filas por usuario:', error);
      throw new Error('Error en el servidor');
    }
  }

  async buyTickets(pay,isDataIntegrityValid,paramsString,userId,ticketCount,token,req) {
    const t = await sequelize.transaction();
  
    try {

      // Verificar el paquete utilizando la clase PacketVerifier

      const verifyPacketEqual = (isDataIntegrityValid);
      const banInfo = await verifyPacketAndBan(userId,userId, paramsString, verifyPacketEqual, t, req);
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
          user: userId,
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
          id: userId,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if(!sessionToken){
        await t.rollback(); // Revertir la transacción en caso de error
        console.log('[ERROR]'.red,'Sesión antigua'.red);
        return { success: false, code: '005', message: 'Token inválido o sesión antigua para generar esta compra...' };
      }

      var payment;
      var typem;
      var ticketsPrice;
      var origen;
      var tiporec;

      switch (pay) {
        case '_vactdc001':
          payment = 1;
          typem = 'cash';
          ticketsPrice = 1000;
          origen = 4;
          tiporec = 3;
          console.log('Medio de pago:'.blue,'Cash'.yellow);
          break;
        case '_ncptft002':
          typem = 'oro';
          payment = 2;
          ticketsPrice = 2000;
          origen = 5;
          tiporec = 4;
          console.log('Medio de pago:'.blue,'Oro'.yellow);
          break;
        case '_epvtcg003':
          typem = 'puntos de evento';
          payment = 3;
          ticketsPrice = 20;
          origen = 8;
          tiporec = 12;
          console.log('Medio de pago:'.blue,'Puntos de evento'.yellow);
          break;
        default:
          payment = null;
          typem = 'NULL';
          ticketsPrice = 0;
          origen = 0;
          tiporec = 0;
          break;
      }

      if(payment === null){
        await t.rollback();
        console.log('[ERROR]'.red,'Medio de pago inválido'.red);
        return { success: false, code: '100', message: 'El tipo de pago seleccionado no es válido' };
      }

      var currencyAmount;
      var amount;
      // var typem = payment === 1 ? 'cash' : 'oro';

      const params = {};
      
      if(payment===1){
        currencyAmount = await Cash.findOne({
          attributes: ['cash'],
          where: {
            id: userId,
          },
          transaction: t,
        });
        amount = currencyAmount.cash;
      } else if(payment===2) {
        currencyAmount = await UserGameInfo.findOne({
          attributes: ['gold'],
          where: {
            name: userId,
          },
          transaction: t,
        });
        amount = currencyAmount.gold;
      } else{
        currencyAmount = await EventPoint.findOne({
          // attributes: ['Points'],
          where: sequelize.where(sequelize.fn('SUBSTRING_INDEX', sequelize.col('User'), ' ', 1), userId),
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        amount = currencyAmount.Points;
      }
  // console.log('a');

      // const ticketsPrice = payment === 1 ? 1000 : 2000; // Precio de un ticket en cash u oro
  
      if (!currencyAmount || amount < ticketsPrice * ticketCount) {
        await t.rollback();
        console.log('[ERROR]'.red,'Saldo insuficiente'.red);
        return { success: false, code: '001', message: `No tienes suficiente(s) ${typem} para esta compra`};
      }
  
      if(payment === 1){
        const [updatedTicketCount, updatedCash] = await Promise.all([
          Ticket.increment('tickets', { by: ticketCount, where: { id: userId }, transaction: t }),
          Cash.decrement('cash', { by: ticketsPrice * ticketCount, where: { id: userId }, transaction: t }),
        ]);

        if (updatedTicketCount[0] === 0 || updatedCash[0] === 0) {
          await t.rollback();
          return { success: false, code: '100', message: 'Error al realizar la compra de tickets de cash' };
        }
      } else if (payment === 2){
        const [updatedTicketCount, updatedCash] = await Promise.all([
          TicketOro.increment('tickets', { by: ticketCount, where: { id: userId }, transaction: t }),
          UserGameInfo.decrement('gold', { by: ticketsPrice * ticketCount, where: { name: userId }, transaction: t }),
        ]);

        if (updatedTicketCount[0] === 0 || updatedCash[0] === 0) {
          await t.rollback();
          return { success: false, code: '100', message: 'Error al realizar la compra de tickets de oro' };
        }

      } else{
        // Obtener los puntos del usuario y luego actualizarlo

        // Actualizar los puntos y guardar+
        // console.log(currencyAmount);
        currencyAmount.Points -= ticketsPrice * ticketCount;
        await currencyAmount.save({ transaction: t });
        // console.log(1);
        // Actualizar los tickets
        const updatedTicketCount = await Ticket.increment('tickets', {
          by: ticketCount,
          where: { id: userId },
          transaction: t,
        });
        // console.log(2);

        params['ep'] = currencyAmount.Points;

        if (updatedTicketCount[0] === 0 || currencyAmount.Points < 0) {
          await t.rollback();
          return { success: false, code: '100', message: 'Error al realizar la compra de giros' };
        }

      }

      await LogRewardsUser.create({  
        user:userId,
        origen:origen,
        recompensa:ticketCount,
        tipo_recompensa: tiporec,
        //origen_2: type,
        fecha: new Date(), 
      }, { transaction: t });
  
      await t.commit();

      console.log('[EXITO]'.green,'Compra exitosa'.green);

     
      return { success: true, code: '000', message: 'Se ha realizado tu compra de manera exitosa',params};
    } catch (error) {
      await t.rollback();
      throw new Error('Error al realizar la compra de tickets');
    }
  }
  

  async playGameSelector(tknGame,opcion,token,modalidad,type,isDataIntegrityValid,paramsString,userId,user2,key1,key2,przId, req) {
    let t;

    const rollbackTransaction = async () => {
      if (t && !t.finished) {
        await t.rollback();
      }
    };

    try {
      // Concatenar los parámetros en una cadena
  
      // Verificar el paquete utilizando la clase PacketVerifier

      const verifyPacketEqual = (isDataIntegrityValid) && (userId === user2) && (key1 === key2);
      /*console.log(userId);
      console.log(user2);
      console.log(orderPrize);
      console.log(idRoulette2);*/
      console.log("Re-verificación:".magenta, verifyPacketEqual ? String(verifyPacketEqual).green :  String(verifyPacketEqual).red);
      const banInfo = await verifyPacketAndBan(userId, user2, paramsString, verifyPacketEqual, null, req);
  
      if (banInfo) {
        return banInfo;
      }
  
      // Si la cadena de parámetros no existe, insertarla en trackingpacket
      await TrackingPacket.create(
        {
          packet: paramsString,
          user: userId,
          fecha_uso: new Date(),
        }
      );

      const [sessionToken, gameActive, tokenCount] = await Promise.all([
        TokenSession.findOne({
          attributes: ['token'],
          where: {
            token: token,
            id: userId,
          },
          raw: true,
        }),
        Evento.findOne({
          attributes: ['id', 'mode'],
          where: {
            id: type,
            show: 1,
            estado: 1
          },
          raw: true,
        }),
        GameAuth.findOne({
          attributes: ['token'],
          where: {
            token: tknGame,
            user: userId,
            type_game: type,
          },
          raw: true,
        }),
      ]);

      if(!sessionToken){
        console.log('Win:'.magenta,'false'.red);
        return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para jugar' };
      }

      /*
      if(userId.toLowerCase()=='joimar123'){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '005', message: 'Cierra todas las pestañas del COUNTDOWN ¡Cierra sesión y actualiza el navegador!' };
      }*/

      //Primero verificar si el juego esta en modo show :)
      const eventAccess = await validateEventAccess(gameActive, type, userId);

      if (!eventAccess.success) {
        console.log('Win:'.magenta, 'false'.red);
        return eventAccess.response;
      }

      const isTestMode = eventAccess.isTestMode;

      // Verificar token (todos los juegos sin partida):
      if(!tokenCount){
         console.log('Win:'.magenta,'false'.red);
        return { success: false, code: '999', message: 'Has abierto el juego en otra pestaña...' };
      }

      t = await sequelize.transaction();

      // Obtener todos los premios de la tabla rouletteprizes según tipo de evento:
      const GameRes = await gamesService.getPrizeByGame(type,opcion,userId,modalidad,przId,t, {
        testMode: isTestMode,
      });

      if (!GameRes) {
        await rollbackTransaction();
        console.log('Win:'.magenta,'false'.red);
        return { success: false, code: '200', message: 'No existe este tipo de juego' };
      }

      if(GameRes.code){
        await rollbackTransaction();
        console.log('Win:'.magenta,'false'.red);
        return GameRes;
      }

      let prizesGame = GameRes.all;

      if(!GameRes.win){
        console.log('Win:'.magenta,'false'.red);
        await t.commit(); // Revertir la transacción en caso de error
        return { success: false, code: '400',params: withTestModeParam(GameRes.params, isTestMode), message: GameRes.ms };
      }

      if (!prizesGame) {
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '200', message: 'No se encontró premios para este juego' };
      }

      const livePrizeUsage = await PrizesGame.findOne({
        attributes: ['limite', 'users'],
        where: {
          id: prizesGame.id,
        },
        transaction: t,
      });

      if (!livePrizeUsage) {
        await t.rollback();
        return { success: false, code: '200', message: 'No se encontró premios para este juego' };
      }

      prizesGame = {
        ...prizesGame,
        limite: Number(livePrizeUsage.limite || 0),
        users: Number(livePrizeUsage.users || 0),
      };

      // const prizesGame = allPrizes[selectedItem];
      //console.log(prizesGame);

     var typePrize = prizesGame.type;
      if (GameRes.params?.prize) {
        typePrize = Number(GameRes.params.prize.temporal) === 1 ? 5 : 0;
      }
      // var cofres; //solo para juego 5 y 6

      // Verificar si el premio excedio el limite :( :

      if (!isTestMode && (prizesGame.limite > 0 && prizesGame.users >= prizesGame.limite || prizesGame.limite == -1)){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '100', message:`El premio '${prizesGame.name}' ya ha llegado ha su límite de usuarios. Vuelve a jugar para obtener el premio :)`};
      } else if(!isTestMode && prizesGame.limite > 0 && prizesGame.users < prizesGame.limite){
        //update
        await PrizesGame.increment(
          'users',
          { by: 1, where: { id: prizesGame.id  }, transaction: t }
        );
      }

      const params = {};
// console.log('aqui no');
      // Acciones segun tipo de evento, Ruleta 0, Count 1, etc...
      switch (type) {
        /**
         * Evento de nivel
         * opcion: lvl
         * 
         */
        case 3:
          // Verificar modalidad:

          if(modalidad > 0){
            await t.rollback(); 
            return { success: false, code: '200', message: 'No existe este tipo de modalidad para este juego' };
          }

          const res = await gamesService.eventLevelVerificator(type,opcion,userId,t,prizesGame, {
            testMode: isTestMode,
          });
          // console.log(res);

          if (!res.success){
            return res;
          }

          params['_pws'] = res.po;

          break;
        //Ruleta
        case 2:
          var giros;
          //var slotsAvaible;
          var typename;
          //Acciones según modalidad:
          switch (modalidad) {
            //Cash, oro, puntos
            case 1:
            case 2:
            case 3:

              typename = 'giros';

              if (!isTestMode) {
                giros = await UserAsset.findOne({
                  // attributes: ['tickets'],
                  where: {
                    user: userId,
                    asset: modalidad === 1 ? 3 : 5
                  },
                  transaction: t, // Asociar la transacción con esta consulta
                  lock: t.LOCK.UPDATE,
                });

                if(giros && giros.amount > 0){
                  // Decrementar el ticket del usuario
                  await UserAsset.decrement('amount', {
                    by: 1,
                    where: {
                      user: userId,
                      asset: modalidad === 1 ? 3 : 5
                    },
                    transaction: t, // Asociar la transacción con esta operación
                  });
                } else{
                  await t.rollback(); 
                  return { success: false, code: '200', message: 'No tienes tickets suficientes para girar la ruleta.' };
                  break;
                }
              }

              //slotsAvaible = true;

              break;
            default:
              await t.rollback(); 
              return { success: false, code: '200', message: 'No existe este tipo de modalidad para este juego' };
              break;
          }

          // Combina los valores de params con los nuevos datos
          Object.assign(params, GameRes.params);
          break;
        //Countdown
        case 1:

          //modalidad:

          if(modalidad > 0){
            await t.rollback(); 
            return { success: false, code: '200', message: 'No existe este tipo de modalidad para este juego' };
          }
          //Verificaciones

          if (!isTestMode) {
            //Verificar tiempo de redencion

            // Obtener todos los premios de la tabla rouletteprizes según tipo de evento:
            const lastDate = await TempPrize.findOne({
              attributes: ['fecha'],
              where: {
                game: type,
                user: userId
              },
              order: [['fecha', 'DESC']],
              transaction: t, // Asociar la transacción con esta consulta
            });

            const vdat = new Date();

            if(lastDate){
              console.log("TIME : %s - %d".magenta,userId,(vdat-lastDate.fecha)/1000); //dif seg

              var timedif = (vdat-lastDate.fecha)/1000;
              var veriTime;

              // console.log(opcion);

              if(opcion === 0){
                veriTime = 290;
              } 
              // else if (opcion === 1){
              //   veriTime = 120;
              // } 
              else{
                await t.rollback(); 
                return { success: false, code: '200', message: 'No existe esta opción en el juego' };
              }
              // 5 min 300 seg
              // 3 min 180 seg

              console.log("USER TIME: ".magenta,(timedif >= veriTime));

              if(timedif < veriTime){
                await t.rollback(); 
                console.log('Win:'.magenta,'false'.red);
                return { success: false, code: '100', message: '¡Alto! Estás canjeando premios demasiado rápido. Recuerda que solo puedes canjear premios cada 5 minutos ¡Evita ser sancionado!' };
              }
            }
          }

           // Combina los valores de params con los nuevos datos
           Object.assign(params, GameRes.params);

          break;
      

          return { success: false, code: '001', message: 'No existe este tipo de juego' };
        case 6:
          const userGame = await Matches.findOne({
            // attributes: ['premios_obtenidos','picked'],
                where: {
                    user: userId,
                    game: type,
                },
                transaction: t,
                lock: t.LOCK,
            });

          // Revertir la transacción en caso de error
          if(!userGame){
            await t.rollback();
            return { success: false, code: '001', message:`No tiene el rompecabezas completo para obtener un cofre nuevo...` };
          }

          console.log(userGame.picked);
          if(JSON.parse(userGame.picked)[0] === 0){
            await t.rollback();
            return { success: false, code: '001', message:`No tiene Cofres de tipo Básico disponibles para abrir...` };
          }

          // Resta cofre:

          const cofres = JSON.parse(userGame.picked);
          const cofresResponse = [...cofres];
          cofresResponse[0] -= 1;
          //const decrementedArr = newArr.map((element) => element - 1);

          if (!isTestMode) {
            await Matches.update(
              { 
                //premios:JSON.stringify(decrementedArr),
                picked: JSON.stringify(cofresResponse),
              }, //cambiar a codigo_base
              { where: { user: userId,game:type, },
                transaction: t
              },
            );
          }

           const allPrizesFinal = prizeGameCache
            .getByGame(type)
            .sort((a, b) => Number(a.orderPrize) - Number(b.orderPrize))
            .map((prize) => ({
              name: prize.name,
              url: prize.url,
            }));

           Object.assign(params, {
              allpz:allPrizesFinal,_cf:cofresResponse
          });

          break;
        case 8:
          // console.log(prizesGame);
          params['prize'] = GameRes.params.prize;
          break;
        default:
          await t.rollback(); 
          return { success: false, code: '200', message: 'No existe este tipo de juego' };
      }
      // console.log('aqui llego');
      var resWin = await gamesService.setWinPrizes(
        type,
        typePrize,
        prizesGame,
        userId,
        t,
        params?.prize || null,
        {
          testMode: isTestMode,
        }
      );
      if(!resWin.success) return resWin;
  
      if (!isTestMode) {
        await TempPrize.create(
          {
            user: userId,
            type: typePrize,
            prize: resWin.bv ? resWin.bv : prizesGame.prize,
            game: type,
            opcion: opcion,
            fecha: new Date(),
          },
          {
            transaction: t, // Asociar la transacción con esta operación
          }
        );
      }

      console.log('Win:'.magenta,'true'.green);

      // const pr = await this.getAllPrizes(type,t);
      // _pwb:prizesGame.clase,pr
      // _pw:selectedItem

      await t.commit();
      return { success: true, code: '000', message:resWin.message,params: withTestModeParam(params, isTestMode)};
    } catch (error) {
      await rollbackTransaction(); // Revertir la transacción en caso de error
      console.error('Error al realizar la operación:', error);
      throw new Error('Error en el servidor');
    }
  }

  async redeemAllPrizesEvent(token,user,authGame,type,isDataIntegrityValid,paramsString, req) {
    const t = await sequelize.transaction(); // Iniciar una transacción

    try {
      // Concatenar los parámetros en una cadena
  
      // Verificar el paquete utilizando la clase PacketVerifier

      const verifyPacketEqual = (isDataIntegrityValid);// && (userId === user2) && ((orderPrize+operator) === res) && (orderPrize === idRoulette2) && (key1 === key2);
      /*console.log(userId);
      console.log(user2);
      console.log(orderPrize);
      console.log(idRoulette2);*/
      console.log("Redeem validate:", verifyPacketEqual);
      const banInfo = await verifyPacketAndBan(user, user, paramsString, verifyPacketEqual, t, req);
  
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
        return { success: false, code: '301', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      const gameActive = await Evento.findOne({
        attributes: ['id', 'mode'],
        where: {
          id: type,
          show: 1,
          estado: 1,
        },
        raw: true,
        transaction: t,
      });

      const eventAccess = await validateEventAccess(gameActive, type, user);

      if (!eventAccess.success) {
        await t.rollback();
        return eventAccess.response;
      }

      const isTestMode = eventAccess.isTestMode;

      //namePrizes prizes

      var prizes;
      var namesPrizes;

      switch (type) {
        case 4:

          // Verifico token...
          const tokenCount = await GameAuth.findOne({
            attributes: ['token'],
            where: {
              token: authGame,
              user: user,
              type_game:type,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          if(!tokenCount){
            await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '301', message: 'Has abierto este juego en otra pestaña...' };
          }

          //Obtener partida en curso
          const match = await Matches.findOne({
            // attributes: ['calabazas','premios','picked','nombres'],
            where: {
              user:user,
              estado:1,
              game:type,
            },
            transaction: t, // Asociar la transacción con esta consulta
            lock: t.LOCK.UPDATE,
          });

          if(!match){
            await t.rollback(); 
            return { success: false, code: '001', message: 'No tienes premios para reclamar o una partida pendiente...' };
          }

          prizes = JSON.parse(match.premios_obtenidos);
          // console.log(prizes);
          namesPrizes = JSON.parse(match.nombres);

          break;
        case 5:
           // Verifico token...
            const authSlot = await GameAuth.findOne({
            attributes: ['token'],
            where: {
              token: authGame,
              user: user,
              type_game:type,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          if(!authSlot){
            await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '301', message: 'Has abierto este juego en otra pestaña...' };
          }

          //Obtener partida en curso
          const match4 = await Matches.findOne({
            // attributes: ['calabazas','premios','picked','nombres'],
            where: {
              user:user,
              estado:1,
              game:type,
            },
            lock: t.LOCK.UPDATE,
            transaction: t, // Asociar la transacción con esta consulta
          });

          if(!match4){
            await t.rollback(); 
            return { success: false, code: '001', message: 'No tienes premios para reclamar o una partida pendiente...' };
          }

          prizes = JSON.parse(match4.premios_obtenidos);
          namesPrizes = JSON.parse(match4.nombres);
          break;
        default:
          await t.rollback(); 
          return { success: false, code: '001', message: 'No existe este tipo de juego' };
          break;
      }

      var prizesWin = [];

      //console.log(prizes);
      //console.log(type);

      for (let prizeIndex = 0; prizeIndex < prizes.length; prizeIndex++) {
        const p = prizes[prizeIndex];
        // Las partidas nuevas guardan prizesgames.id. El fallback por orderPrize
        // mantiene reclamables las partidas antiguas que ya estaban guardadas.
   
        let prizePumpkin = await PrizesGame.findOne({
          attributes: ['id', 'orderPrize', 'clase', 'type', 'prize', 'name', 'url'],
          where: {
            id: p,
            type_game: type,
          },
          raw: true,
          transaction: t, // Asociar la transacción con esta consulta
        });

        if (!prizePumpkin) {
          prizePumpkin = await PrizesGame.findOne({
            attributes: ['id', 'orderPrize', 'clase', 'type', 'prize', 'name', 'url'],
            where: {
              orderPrize: p,
              type_game: type,
            },
            order: [['id', 'ASC']],
            raw: true,
            transaction: t,
          });
        }

        const matchPrizeName = Array.isArray(namesPrizes) ? namesPrizes[prizeIndex] : null;

        if (
          type === 4 &&
          matchPrizeName &&
          prizePumpkin &&
          Number(prizePumpkin.type) === 0 &&
          prizePumpkin.name !== matchPrizeName
        ) {
          const prizeByName = await PrizesGame.findOne({
            attributes: ['id', 'orderPrize', 'clase', 'type', 'prize', 'name', 'url'],
            where: {
              type_game: type,
              type: 0,
              name: matchPrizeName,
            },
            order: [['orderPrize', 'ASC'], ['id', 'ASC']],
            raw: true,
            transaction: t,
          });

          if (prizeByName) {
            prizePumpkin = prizeByName;
          }
        }

        if (!prizePumpkin) {
          await t.rollback(); // Revertir la transacción en caso de error
          return { success: false, code: '302', message: 'No se encontró un premio para las calabazas' };
        }

        prizesWin.push({
          ...prizePumpkin,
          matchPrizeName,
        });
      }

      //var message;
      const deliveryResults = [];
      if (!isTestMode) {
        for(const pr of prizesWin){

          var typePrize = Number(pr.type);
          const res = await gamesService.setWinPrizes(
            type,
            typePrize,
            pr,
            user,
            t,
            {
              matchPrizeName: pr.matchPrizeName,
            }
          );
          if (!res.success) {
            if (!t.finished) {
              await t.rollback();
            }
            return res;
          }

          deliveryResults.push({
            prizeGameId: pr.id,
            orderPrize: pr.orderPrize,
            clase: pr.clase,
            type: typePrize,
            prize: pr.prize,
            name: pr.matchPrizeName || pr.name,
          });
        }
      }

      await Matches.update(
        type === 4 ? { estado: 0, status: 1 } : { estado: 0 },
        {
          where: { user: user, estado: 1, game: type },
          transaction: t,
        },
      );
  
      await t.commit(); // Confirmar la transacción si todas las operaciones tienen éxito
      console.log('Win: '.magenta,'true'.green);
      return { success: true, code: '000',_om4:namesPrizes, _delivery: deliveryResults, _testMode: isTestMode || undefined, message:"Felicidades :)" };
    } catch (error) {
      await t.rollback(); // Revertir la transacción en caso de error
      console.error('Error al realizar la operación:', error);
      throw new Error('Error en el servidor');
    }
  }


  async redeemCupon(paramsString,token,user,cupon,isDataIntegrityValid,ip, req) {
      // ============================================================
      // FILTRO RÁPIDO EN MEMORIA
      // Esto evita tocar BD cuando el cupón claramente no existe,
      // ya expiró, el usuario ya lo redimió o la IP llegó al límite.
      // La BD sigue siendo la verificación final dentro de la transacción.
      // ============================================================
      const localCouponCheck = couponCache.canRedeemLocal(cupon);
      if (!localCouponCheck.ok) {
        return {
          success: false,
          code: localCouponCheck.code,
          message: localCouponCheck.message,
        };
      }
  
      const localTempCouponCheck = tempCouponCache.canRedeemLocal(user, cupon, ip);
      if (!localTempCouponCheck.ok) {
        return {
          success: false,
          code: localTempCouponCheck.code,
          message: localTempCouponCheck.message,
        };
      }

      const sessionToken = await TokenSession.findOne({
        attributes: ['token'],
        where: {
          token: token,
          id: user,
        },
      });

      if (!sessionToken) {
        return { success: false, code: '300', message: 'Token invalido o tienes una sesion iniciada en otro navegador...' };
      }

      const verifyPacketEqual = isDataIntegrityValid;
      const banInfo = await verifyPacketAndBan(user, user, paramsString, verifyPacketEqual, null, req);

      if (banInfo) {
        return banInfo;
      }
  
      let t = null;
    
      try {
        t = await sequelize.transaction();
  
        // Usa una sola transaccion principal para evitar conexiones extra.
        await TrackingPacket.create(
          {
            packet: paramsString,
            user: user,
            fecha_uso: new Date(),
          },
          {
            transaction: t,
          }
        );
  
  
        // Verificacion final en BD con lock.
        const cuponPrize = await Cupon.findOne({
          where: {
            ticket: cupon,
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
    
        if (!cuponPrize) {
          await t.rollback();
          couponCache.remove(cupon);
          return { success: false, code: '004', message: 'El cupón ingresado no existe' };
        }
  
        if (cuponPrize.limite <= cuponPrize.users) {
          await t.rollback();
          couponCache.addOrUpdate(cuponPrize);
          return { success: false, code: '002', message: 'El cupón ingresado ya expiró' };
        }
  
        // Verificación final en BD por usuario.
        const userRedeem = await TempCupon.findOne({
          where: {
            user: user,
            ticket: cupon,
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
  
        if (userRedeem) {
          await t.rollback();
          tempCouponCache.addRedeem(userRedeem);
          return { success: false, code: '001', message: 'Ya canjeaste este cupón anteriormente' };
        }
  
        // Verificación final en BD por IP.
        // Usamos count en vez de findAll para traer menos datos.
        const userRedeemxIPCount = await TempCupon.count({
          where: {
            ip: ip,
            ticket: cupon,
          },
          transaction: t,
        });
  
        if (userRedeemxIPCount >= 3) {
          await t.rollback();
          return {
            success: false,
            code: '001',
            message: 'No puedes canjear este cupón más de 3 veces desde la misma IP',
          };
        }
  
        var typePrize = cuponPrize.type;
        var message;
  
        // Agregar el premio según el tipo
        switch (typePrize) {
          case 0:
            const userGameInfo = await UserGameInfo.findOne({
              attributes: ['id'],
              where: {
                name: user,
              },
              transaction: t,
            });
  
            if (!userGameInfo) {
              await t.rollback();
              return { success: false, code: '202', message: 'ID de Usuario no encontrado' };
            }

            const uniqueAvailability = await checkUniqueAccountItemAvailability({
              userGameId: userGameInfo.id,
              itemId: cuponPrize.id_prize,
              itemName: cuponPrize.name_prize || `Item ${cuponPrize.id_prize}`,
              transaction: t,
            });

            if (!uniqueAvailability.allowed) {
              await t.rollback();
              return { success: false, code: '004', message: 'El cupón ingresado no existe' };
            }
            
            await PendingPresents.create(
              {
                present_id: cuponPrize.id_prize,
                user_id: userGameInfo.id,
                added_time: new Date(),
              },
              {
                transaction: t,
              }
            );
  
            message = `Has obtenido un(a) ${cuponPrize.name_prize}`;
            break;
          case 1:
            const userGold = await UserGameInfo.findOne({
              attributes: ['id','gold'],
              where: {
                name: user,
              },
              transaction: t,
            });
  
            if (!userGold) {
              await t.rollback();
              return { success: false, code: '004', message: 'Usuario no encontrado [GOLD: Comunicar con algún administrador]' };
            }
  
            await UserGameInfo.increment(
              'gold',
              { by: cuponPrize.id_prize, where: { name: user }, transaction: t }
            );
  
            message = `Has obtenido ${cuponPrize.id_prize} de Oro`;
            break;
          case 2:
            const userCash = await Cash.findOne({
              attributes: ['cash'],
              where: {
                id: user,
              },
              transaction: t,
            });
      
            if (!userCash) {
              await t.rollback();
              return { success: false, code: '004', message: 'Usuario no encontrado [CASH: Comunicar con algún administrador]' };
            }
  
            await Cash.increment(
              'cash',
              { by: cuponPrize.id_prize, where: { id: user }, transaction: t }
            );
  
            message = `Has obtenido ${cuponPrize.id_prize} de Cash`;
            break;
          case 3:
            await Ticket.increment(
              'tickets',
              { by: cuponPrize.id_prize, where: { id: user }, transaction: t }
            );
  
            message = `Has obtenido ${cuponPrize.id_prize} ticket(s) de cash`;
            break;
          case 4:
            await TicketOro.increment(
              'tickets',
              { by: cuponPrize.id_prize, where: { id: user }, transaction: t }
            );
    
            message = `Has obtenido ${cuponPrize.id_prize} ticket(s) de oro`;
            break;
          case 5:
            const userGame = await UserGameInfo.findOne({
              attributes: ['id'],
              where: {
                name: user,
              },
              transaction: t,
            });
  
            if (!userGame) {
              await t.rollback();
              return { success: false, code: '202', message: 'ID de Usuario no encontrado' };
            }

            const uniqueTemporalAvailability = await checkUniqueAccountItemAvailability({
              userGameId: userGame.id,
              itemId: cuponPrize.id_prize,
              itemName: cuponPrize.name_prize || `Item ${cuponPrize.id_prize}`,
              transaction: t,
            });

            if (!uniqueTemporalAvailability.allowed) {
              await t.rollback();
              return { success: false, code: '004', message: 'El cupón ingresado no existe' };
            }
            
            const distinctSlots = await UserItemInfo.findAll({
              attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('slot')), 'slot']],
              where: {
                userid: userGame.id,
              },
              raw: true,
              transaction: t,
            });
  
            const distinctSlotsArray = distinctSlots.map((item) => item.slot)
            var slotFree = null;
  
            for (let i = 0; i <= 89; i++) {
              if (!distinctSlotsArray.includes(i)) {
                slotFree = i;
                break;
              }
            }
  
            if(slotFree === null){
              await t.rollback();
              return { success: false, code: '003', message: 'No tiene slots disponbiles para canjear el premio' };
            }
  
            await UserItemInfo.create(
              {
                userid: userGame.id,
                itemid: cuponPrize.id_prize,
                slot: slotFree,
                limittime: 0,
              },
              {
                transaction: t,
              }
            );
  
            message = `Has obtenido un(a) ${cuponPrize.name_prize} temporal`;
            break;
          case 13:
            const userPoints = await UserGameInfo.findOne({
              attributes: ['id','clanpoint'],
              where: {
                name: user,
              },
              transaction: t,
            });
  
            if (!userPoints) {
              await t.rollback();
              return { success: false, code: '004', message: 'Usuario no encontrado [EVENTPOINTS: Comunicar con algún administrador]' };
            }
  
            await UserGameInfo.increment(
              'clanpoint',
              { by: cuponPrize.id_prize, where: { name: user }, transaction: t }
            );
  
            message = `Has obtenido ${cuponPrize.id_prize} de Punto(s) de evento`;
            break;
          default:
            await t.rollback();
            return { success: false, code: '201', message: 'Tipo de premio no válido' };
        }
  
        cuponPrize.users += 1;
        await cuponPrize.save({ transaction: t });
  
        const tempCuponCreated = await TempCupon.create(
          {
            user: user,
            ticket: cupon,
            ip: ip,
            fecha: new Date()
          },
          {
            transaction: t,
          }
        );
  
        await LogRewardsUser.create({  
          user:user,
          origen:13,
          recompensa:cuponPrize.id_prize,
          tipo_recompensa: typePrize,
          fecha: new Date(), 
        }, { transaction: t });
  
        await t.commit();
  
        // Actualizar caches SOLO después del commit exitoso.
        couponCache.markRedeemed(cupon, cuponPrize.users);
        tempCouponCache.addRedeem(tempCuponCreated);

        // console.log('===== CACHE DE CUPONES =====');
        // console.table(couponCache.getAll());
        // console.log('============================');
  
        return { success: true, code: '000', message };
      }
      catch (error) {
          await rollbackCouponTransaction(t);
          const couponError = classifyCouponRedeemError(error);

          console.error(
            '[CouponRedeem]',
            couponError.errorType,
            couponError.detail || '',
            error
          );

          return couponError;
      }
    } 

  async getAllPrizesGames(type) {
    try {
      await prizeGameCache.ensureLoaded();

      const roulettePrizes = prizeGameCache
        .getByGame(type)
        .sort((a, b) => Number(a.id) - Number(b.id) || Number(a.orderPrize) - Number(b.orderPrize));
  
      // Función para calcular el nombre con el rango y tipo
      const calculateRandomName = (name, type) => {
        const [min, max] = name.split('-').map(Number);
        const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
        return `${randomValue} ${type === 9 ? 'de Cash' : 'de Oro'}`;
      };
  
      // Mapear y ajustar los nombres según el tipo
      const adjustedPrizes = roulettePrizes.map((prize) => {
        if (prize.type === 8 || prize.type === 9) {
          const adjustedName = calculateRandomName(prize.name, prize.type);
          return {
            ...prize,
            name: adjustedName,
          };
        }
        return prize;
      });
  
      return adjustedPrizes;
    } catch (error) {
      throw new Error('Error al obtener los premios de la ruleta');
    }
  }

  async getAllPrizes(type,t) {
    try {
      await prizeGameCache.ensureLoaded();

      const roulettePrizes = prizeGameCache
        .getByGame(type)
        .sort((a, b) => Number(a.orderPrize) - Number(b.orderPrize) || Number(a.id) - Number(b.id));
  
      // Función para calcular el nombre con el rango y tipo
      const calculateRandomName = (name, type) => {
        const [min, max] = name.split('-').map(Number);
        const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
        return `${randomValue} ${type === 9 ? 'de Cash' : 'de Oro'}`;
      };
  
      // Mapear y ajustar los nombres según el tipo
      const adjustedPrizes = roulettePrizes.map((prize) => {
        if (prize.type === 8 || prize.type === 9) {
          const adjustedName = calculateRandomName(prize.name, prize.type);
          return {
            ...prize,
            name: adjustedName,
          };
        }
        return prize;
      });
  
      return adjustedPrizes;
    } catch (error) {
      throw new Error('Error al obtener los premios de la ruleta');
    }
  }
  
  async setAuthGame(token,user,game) {
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
        return { success: false, code: '999', message: 'Token inválido o sesión antigua para este evento...' };
      }
     
      //Verificar si ya existe token en tabla:
      const countAuth = await GameAuth.findOne({
        where: {
          user: user, // Cambia esto para usar el nombre de usuario correcto
          type_game:game,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      const tokenGen = generateRandomToken();

      if(!countAuth){
        await GameAuth.create(
          {
            user: user,
            token: tokenGen,
            date: new Date(),
            type_game:game
          },
          {
            transaction: t, // Asociar la transacción con esta operación
          }
        );
      } else{
        await GameAuth.update(
          { date: new Date(),
            token: tokenGen,
          },
          {
              where: { user: user, type_game : game },
              transaction: t,
          }
      );
      }

      const match = await gamesService.findMatch(game,user,t);

      await t.commit();
      return { success: true, code: '000',_athg:tokenGen, _msv:match };
    } catch (error) {
      await t.rollback();
      console.error('Error al obtener la crear auth de juego y obtener partida:', error);
      throw new Error('Error en el servidor');
    }
  }

  async saveCarta(user,token,message,prize) {
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
        return { success: false, code: '999', message: 'Token inválido o sesión antigua para este evento...' };
      }
     
   
      // 2️⃣ Verificar si ya existe carta (CON LOCK)
      const existingCard = await ValentinCards.findOne({
        where: { user: user },
        transaction: t,
        lock: t.LOCK.UPDATE   // 🔒 FOR UPDATE
      });

      if (existingCard) {
        await t.rollback();
        return {
          success: false,
          code: '998',
          message: 'Ya has enviado una carta. Solo se permite una por usuario.'
        };
      }

      // 3️⃣ Crear carta
      await ValentinCards.create({
        user,
        message,
        prize
      }, {
        transaction: t
      });

      // 4️⃣ Commit
      await t.commit();

      return { success: true, code: '000', message:'Se ha enviado tu carta satisfactoriamente'};
    } catch (error) {
      await t.rollback();
      console.error('Error al obtener la crear auth de juego y obtener partida:', error);
      throw new Error('Error en el servidor');
    }
  }

  async getPieceAndChest(userId,token) {
    try {
      const userGame = await Matches.findOne({
      attributes: ['premios_obtenidos','picked'],
          where: {
              user: userId,
              game: 6,
          },
      });

     if(!userGame){
        return {success:true,_lp:[],_cf:0}
     } else{
        return {success:true,_lp:JSON.parse(userGame.premios_obtenidos),_cf:JSON.parse(userGame.picked)}
     }

      //return userTicket && userTicketOro ? {userTicket,userTicketOro} : null;
    } catch (error) {
      console.error('Error al obtener la cantidad de tickets:', error);
      throw new Error('Error en el servidor');
    }
  }

  async obtenerNuevaPieza(user,token,authg,modalidad,game) {
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
        return { success: false, code: '002', message: 'Token inválido o sesión antigua para este evento...' };
      }

      // Verifico token...
      const tokenCount = await GameAuth.findOne({
        attributes: ['token'],
        where: {
          token: authg,
          user: user,
          type_game:game,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if(!tokenCount){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '301', message: 'Has abierto este juego en otra pestaña...' };
      }

      var nameAsset;
      var tickets = "tickets";

      //Verificar tickets:
       if(modalidad == 1){
        tickets = await UserAsset.findOne({
          where: {
            user: user,
            asset:3
          },
          transaction:t, // Asociar la transacción con esta consulta
          lock: t.LOCK.UPDATE,
        });
        nameAsset = 'tickets de cash';
      } else if(modalidad == 3){
          tickets = await UserAsset.findOne({
          where: {
            user: user,
            asset:5
          },
          transaction:t, // Asociar la transacción con esta consulta
          lock: t.LOCK.UPDATE,
        });
          nameAsset = 'tickets de puntos';
      }
      

      if(!tickets || tickets.amount < 1){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '001', message:`No tienes ${nameAsset} suficientes para obtener nuevas piezas.` };
      }

      // Decrementar picas
      tickets.amount -= 1;
      await tickets.save({transaction:t});

      const userGame = await Matches.findOne({
        attributes: ['premios_obtenidos','picked'],
            where: {
                user: user,
                game,
            },
        });

      // 1️⃣ Probabilidades base equitativas
      const baseProbs = Array(16).fill(1 / 16);

      // 2️⃣ Obtener conteos del usuario
      let counts = Array(16).fill(0);

      if (userGame) {
          counts = JSON.parse(userGame.premios_obtenidos);
      }

      // 3️⃣ Factor de dificultad (ajústalo)
      let factor;

      if (modalidad == 1) {
        factor = 0.4; // más fácil
      } else if (modalidad == 3) {
        factor = 0.75; // más difícil
      } else {
        factor = 0.5; // default
      }

      let dynamicWeights;

      const missingPieces = counts
        .map((count, index) => count === 0 ? index : -1)
        .filter(index => index !== -1);

      if (missingPieces.length === 1) {

        const targetIndex = missingPieces[0];

        // 80% para la pieza faltante
        dynamicWeights = Array(16).fill(0);

        dynamicWeights[targetIndex] = 0.8;

        const remainingProb = 0.2 / 15;

        for (let i = 0; i < 16; i++) {
          if (i !== targetIndex) {
            dynamicWeights[i] = remainingProb;
          }
        }

      } else {
        dynamicWeights = baseProbs.map((prob, i) => {
          return prob * (1 + factor * counts[i]);
        });

        const totalWeight = dynamicWeights.reduce((a, b) => a + b, 0);
        dynamicWeights = dynamicWeights.map(w => w / totalWeight);
      }

      // 6️⃣ Selección
      const randomProb = Math.random();
      let cumulativeProb = 0;
      let selectedPiece = 0;

      for (let i = 0; i < dynamicWeights.length; i++) {
          cumulativeProb += dynamicWeights[i];
          if (randomProb <= cumulativeProb) {
              selectedPiece = i;
              break;
          }
      }
       
       var newArr;

      if(!userGame){
        newArr = Array(16).fill(0);
        newArr[selectedPiece] += 1;

        await Matches.create(
          {
            user: user,
            partida: JSON.stringify([]),
            premios_obtenidos:JSON.stringify(newArr),
            picked:JSON.stringify([0,0]),
            nombres:JSON.stringify([]),
            game,
          },
          {
            transaction: t, // Asociar la transacción con esta operación
          }
        );

      } else{
        newArr = JSON.parse(userGame.premios_obtenidos);
        newArr[selectedPiece] += 1;

        await Matches.update(
          { 
            premios_obtenidos:JSON.stringify(newArr),
          }, //cambiar a codigo_base
          { where: { user: user,game, },
            transaction: t
          },
        );
      }

      await t.commit();
      return {success:true,code:'000',_lp:newArr,message:'Obtuviste la pieza n°'+String(selectedPiece+1)}

      //return userTicket && userTicketOro ? {userTicket,userTicketOro} : null;
    } catch (error) {
      if (!t.finished) {
        await t.rollback();
      }
      console.error('Error al obtener la pieza:', error);
      throw new Error('Error en el servidor');
    }
  }

  async obtenerCofre(user,token,game,gametoken ) {
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
        return { success: false, code: '002', message: 'Token inválido o sesión antigua para este evento...' };
      }

      // Verifico token...
      const tokenCount = await GameAuth.findOne({
        attributes: ['token'],
        where: {
          token: gametoken,
          user: user,
          type_game:game,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if(!tokenCount){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '301', message: 'Has abierto este juego en otra pestaña...' };
      }

      //Verificar piezas:

      const userGame = await Matches.findOne({
        // attributes: ['premios_obtenidos','picked'],
            where: {
                user: user,
                game,
            },
            transaction:t,
            lock: t.LOCK.UPDATE,
        });
       
       var newArr;

       // Revertir la transacción en caso de error
      if(!userGame){
        await t.rollback();
        return { success: false, code: '001', message:`No tiene el rompecabezas completo para obtener un cofre nuevo...` };
      }

      newArr = JSON.parse(userGame.premios_obtenidos);

      if(!newArr.every(count => count > 0)){
        await t.rollback();
        return { success: false, code: '001', message:`No tiene el rompecabezas completo para obtener un cofre nuevo...` };
      }

        //0: cofre básico, 1: cofre osceanus
        const probs = [1,0];
        const names = ['Golden','X'];

        // Realizar el calculo de probabilidad:
        const randomProb = Math.random();
        let cumulativeProb = 0;
        let selected= 0;
  
        //console.log(allPrizes.length);
  
        for (let i = 0; i < probs.length; i++) {
          //console.log(allPrizes[i]);
          cumulativeProb += probs[i];
          if (randomProb <= cumulativeProb) {
           selected = i;
            break;
          }
        }

      // Resta piezas, aumenta un cofre:

      const cofres = JSON.parse(userGame.picked);
      cofres[selected] += 1;
      const decrementedArr = newArr.map((element) => element - 1);

      await Matches.update(
        { 
          premios_obtenidos:JSON.stringify(decrementedArr),
          picked: JSON.stringify(cofres),
        }, //cambiar a codigo_base
        { where: { user: user,game, },
          transaction: t
        },
      );

      await t.commit();
      return {success:true,code:'000',_lp:decrementedArr,_cf:cofres,message:`¡Has obtenido un Cofre ${names[selected]}!`};

      //return userTicket && userTicketOro ? {userTicket,userTicketOro} : null;
    } catch (error) {
      if (!t.finished) {
        await t.rollback();
      }
      console.error('Error al obtener la pieza:', error);
      throw new Error('Error en el servidor');
    }
  }

  async obtenerTodos() {
    try {
      return await publicDataCache.getOrLoad(PUBLIC_CACHE_KEYS.EVENTS, PUBLIC_CACHE_TTL.LONG, async () => {

      const eventos = await Evento.findAll({
        where:{
          estado:1,
        },
        order: [
          ['inicio', 'DESC'], // Ordenar los comentarios del más reciente al más antiguo
        ],
      });

      // Obtener la fecha actual
      const fechaActual = new Date();
     
      // 2. Para cada evento, obtener el promedio de puntos
      const eventosConPuntuacionYReviews = await Promise.all(
        eventos.map(async (evento) => {
          // Obtener el promedio de puntos para este evento
          const promedioPuntos = await EventsReview.findOne({
            where: {
              evento: evento.id,
            },
            attributes: [
              [fn('AVG', col('points')), 'averagePoints'] // Calculamos el promedio
            ]
          });

          // Obtener todos los reviews de este evento
          const reviews = await EventsReview.findAll({
            where: {
              evento: evento.id,
            },
            attributes: ['id', 'apodo', 'review', 'points', 'fecha'], // Solo obtenemos los campos necesarios
            order: [
              ['fecha', 'DESC'], // Ordenar los comentarios del más reciente al más antiguo
            ],
          });

          // Comprobar si la fecha de inicio del evento es dentro de la última semana
          const fechaInicio = new Date(evento.inicio); // Asegúrate de que la columna sea correcta
          const diferenciaTiempo = fechaActual - fechaInicio;
          const diasDiferencia = diferenciaTiempo / (1000 * 60 * 60 * 24); // Convertir milisegundos a días

          // Si el evento empezó hace menos de una semana, es "nuevo"
          const isNew = diasDiferencia <= 7;
      
          // Devolver el evento con el promedio de puntos y los reviews
          return {
            ...evento.toJSON(),
            pointsaverage: Number(promedioPuntos?.dataValues?.averagePoints) || 0, // Si no hay puntuación, 0
            reviews: reviews.map(review => review.toJSON()), // Convertimos los reviews a objetos JSON
            isNew,
          };
        })
      );

        return eventosConPuntuacionYReviews;
      });

      //return userTicket && userTicketOro ? {userTicket,userTicketOro} : null;
    } catch (error) {
      console.error('Error al obtener los eventos:', error);
      throw new Error('Error en el servidor');
    }
  }
  async getAllTestUsers() {
    try {
      const users = await EventTestUser.findAll({
        order: [['event', 'ASC'], ['user', 'ASC']],
        raw: true
      });

      return {
        success: true,
        code: '000',
        message: 'ok',
        data: users
      };
    } catch (error) {
      console.error('Error obteniendo usuarios test:', error);

      return {
        success: false,
        code: '500',
        message: 'Error interno del servidor'
      };
    }
  }
  async setPersonaje(user,token,character) {
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
        return { success: false, code: '999', message: 'Token inválido o sesión antigua para este evento...' };
      }

       // Verificar si el usuario ya seleccionó un personaje
       const existingEntry = await EventLevelCharacter.findOne({
        where: {
            user: user,
        },
        transaction: t,
      });

      if (existingEntry) {
          await t.rollback();
          return { success: false, code: '200', message: '¡El usuario ya ha seleccionado un personaje!' };
      
      }

      // Guardar usuario y personaje seleccionado en eventlevelcharacter
      await EventLevelCharacter.create({ user: user, characterid: character }, { transaction: t });

      // Obtener el userid desde usergameinfo
      const userGameInfo = await UserGameInfo.findOne({
        attributes: ['id'],
        where: { name: user },
        transaction:t // Añadir transacción aquí
      });

      if (!userGameInfo) {
          throw new Error('Usuario no encontrado');
      }

      const userId = userGameInfo.id;

      const characterSelected = await CharacterInfo.findOne({
        attributes: ['id', 'name', 'level', 'Class'],
        where: {
            userid: userId,
            id: character
        },
        transaction:t // Añadir transacción aquí
      });

      if (!characterSelected) {
          await t.rollback();
          return { success: false, code: '200', message: 'El personaje que has seleccionado no existe o estás intentando tomar un personaje que no te pertenece' };
      }

      const niveles = Array.from({ length: 8 }, (_, index) => {
        if (index === 19) {
            return 99;
        } else {
            return (index + 1) * 5;
        }
      });

      // console.log(levelsSuperados);
      // console.log(niveles);

      // Crear array de partida
      const modifyPartida = niveles.map(nivel => characterSelected.level >= nivel ? false : true);

      const  match = await Matches.findOne({
        attributes: ['id','partida', 'premios_obtenidos'],
        where: {
          user: user,
          game: 3, //luego enviar parametro...
          estado: 1,
        },
        transaction:t // Añadir transacción aquí
      });
      
      await Matches.update(
        { partida: JSON.stringify(modifyPartida) },
        { where: { id: match.id }, transaction:t }
      );

      const matchM = {
        mt: modifyPartida,
        _pws: JSON.parse(match.premios_obtenidos),
        new: false,
        uch:null,
        chs:characterSelected,
      };
  
      await t.commit();
      return {success:true,code:'000',_msv:matchM};

      //return userTicket && userTicketOro ? {userTicket,userTicketOro} : null;
    } catch (error) {
      if (!t.finished) {
        await t.rollback();
      }
      console.error('Error al setear personaje:', error);
      throw new Error('Error en el servidor');
    }
  }
  
}

export default new EventService();
