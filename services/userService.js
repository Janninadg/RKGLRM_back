import { Sequelize,Op } from 'sequelize';
import User from '../models/userModel.js';
import Cash from '../models/cashModel.js';
import UserGameInfo from '../models/userGameInfoModel.js';
import ClassLevelInfo from '../models/ClassLevelInfoModel.js';
import CharacterInfo from '../models/characterInfo.js';
import Banlist from '../models/banListModel.js';
import Blackout from '../models/blackoutModel.js';
import sequelize from '../config/database.js';
import { signToken, expiredDate,verifyToken } from '../utils/authUtils.js';
import TokenSession from '../models/tokenSessionModel.js';
import Ticket from '../models/ticketsModel.js';
import TicketOro from '../models/ticketsOroModel.js';
import PendingPresents from '../models/pendingPresentsModel.js'
import InitialIpUser from '../models/ipUserModel.js';
import ExchangeRate from '../models/exchangeRateModel.js';
import TrackingPacket from '../models/trackingPacketModel.js';
import { verifyPacketAndBan } from '../utils/securityUtils.js';
import LogExchange from '../models/logExchanges.js';
import TicketsMode from '../models/ticketsModeModel.js';
import UserStageInfo from '../models/userStageInfo.js';
import { calculatePowerUse } from '../utils/prizesUtils.js';
// import BarraConexion from '../models/barProgressModel.js';
import { decrypt, encrypt } from '../helpers/encryption.js';
import config from '../config/config.js';
import { setPresentsReward } from '../utils/gameUtils.js';
import LogRewardsUser from '../models/logRewardUserModel.js';

class UserService {

  async getAllUsers() {
    try {
      const users = await User.findAll();
      return users;
    } catch (error) {
      console.error('Error al obtener la lista de usuarios:', error);
      throw new Error('Error en el servidor');
    }
  }

  async getUserIdByUsername(name) {
    try {
      const user = await UserGameInfo.findOne({
        where: {
          name: name,
        },
      });

      if (user) {
        return user.id;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error al obtener id de usuario:', error);
      throw new Error('Error en el servidor');
    }
  }

  async getExchangeRate() {
    try {
      const exchange = await ExchangeRate.findOne({
        where: {
          id: 1,
        },
      });

      if (exchange) {
        return exchange.cambio;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error al obtener id de usuario:', error);
      throw new Error('Error en el servidor');
    }
  }

  async exchangeCash(key,user,token,cash,isDataIntegrityValid,paramsString, req) {
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
        return { success: false, code: '006', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

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
        return { success: false, code: '001', message: 'Usuario no encontrado [GOLD: Comunicar con algún administrador]' };
      }

      const userCash = await Cash.findOne({
        attributes: ['cash'],
        where: {
          id: user, // Cambia esto para usar el nombre de usuario correcto
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if (!userCash) {
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '002', message: 'Usuario no encontrado [CASH: Comunicar con algún administrador]' };
      }

      if(userCash.cash < cash){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '003', message: 'No cuenta con cash suficiente para realizar este intercambio' };
      }

      const userLevel = await CharacterInfo.findOne({
        attributes: ['level'],
        where: {
          userid: userGold.id, // Cambia esto para usar el nombre de usuario correcto
        },
        order: [
          ['level', 'DESC'],
        ],
        transaction: t, // Asociar la transacción con esta consulta
      });

      if(!userLevel){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '005', message: 'Debe de crear al menos un personaje y llegar a nivel 5 para realizar intercambios' };
      }

      if(userLevel.level < 5){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '004', message: 'Debe de tener un personaje con un nivel mayor a 5 para poder realizar intercambios' };
      }

      const exchange = await ExchangeRate.findOne({
        where: {
          id: 1,
        },
        transaction: t,
      });

      const oro =   Math.round(cash*exchange.cambio);

      await LogExchange.create(
        {
          user: user,
          cash: cash,
          oro: oro,
          date: new Date(),
        },
        {
          transaction: t, // Asociar la transacción con esta operación
        }
      );

      // Actualizar el gold en UserGameInfo
      await UserGameInfo.increment(
        'gold',
        { by: oro, where: { name: user }, transaction: t }
      );

      // Actualizar el cash en CASH
      await Cash.decrement(
        'cash',
        { by: cash, where: { id: user }, transaction: t }
      );

      await t.commit(); // Confirmar la transacción si todas las operaciones tienen éxito
  
      return { success: true, code: '000', message: 'ok' };
    } catch (error) {
      await t.rollback(); // Revertir la transacción en caso de error
      console.error('Error al realizar la operación:', error);
      throw new Error('Error en el servidor');
    }
  }

  async login(req,id, password,sessionActive) {
    const t = await sequelize.transaction();
    try {
      // Verificar si el usuario está en la tabla banlist
      const bannedUser = await Banlist.findOne({ where: { UserID: id } });
  
      if (bannedUser) {
        // Si el usuario está en la tabla banlist, retornar 1 (baneado)
        return { success:false, message:'El usuario ingresado se encuentra baneado', code: '101' };
      }
  
      // Verificar si el usuario tiene la columna 'ban' en la tabla 'usergameinfo' en 1
      const userGameInfo = await UserGameInfo.findOne({ where: { id } });
  
      if (userGameInfo && userGameInfo.ban === 1) {
        // Si la columna 'ban' está en 1, retornar 1 (baneado)
        return { success:false, message:'El usuario ingresado se encuentra baneado', code: '101' };
      }
  
      // Verificar las credenciales en la tabla 'user'
      const user = await User.findOne({ where: { id, password } });
  
      if (user) {
        // Si las credenciales son correctas, crear un token
        const tokenjwt = await signToken(id.toLowerCase(),sessionActive);
        const token = encrypt(tokenjwt,config.key);
        const expired = expiredDate(tokenjwt);
  
         // Actualizar el token en tokensession
        await TokenSession.update({ token }, { where: { id }, transaction: t  });

        const existingUser = await InitialIpUser.findOne({ where: { user: id } });
  
        if (!existingUser) {
          await InitialIpUser.create({ user: id, ip: req.clientIp }, { transaction:t });
        }
  
        // Obtener información adicional del usuario desde usergameinfo
        const userInfo = await UserGameInfo.findOne({
          where: { name: user.id },
          attributes: ['id', 'name', 'createtime', 'lastconnect'],
          transaction: t, 
        });
  
        // Combinar la información del usuario
        const completeUserInfo = { ...user.toJSON(), ...userInfo.toJSON() };
  
        // Devolver el objeto con toda la información del usuario, el token y el código 2
        await t.commit();
        return { _u: completeUserInfo, auth:token, tx:expired, success:true, message:'Ha iniciado sesión correctamente', code: '000'  };
      } else {
        // Si las credenciales son incorrectas, retornar 3 (credenciales incorrectas)
        await t.rollback();
        return { success:false, message:'Credenciales incorrectas', code: '100' };
      }
    } catch (error) {
      await t.rollback();
      console.error('Error en el inicio de sesión:', error);
      throw new Error('Error en el servidor');
    }
  }  

  async renewToken(oldToken, user) {
    const t = await sequelize.transaction();
  
    try {
      console.log("TOKEN SERVICE:",oldToken);
      const decoded = await verifyToken(decrypt(oldToken,config.key));
      const userId = decoded.id;
  
      if (userId !== user.toLowerCase()) {
        await t.rollback();
        return { success: false, message: 'El usuario no coincide con el token antiguo.' };
      }

       // Verificar token:
       const sessionToken = await TokenSession.findOne({
        attributes: ['token'],
        where: {
          token: oldToken,
          id: user,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if(!sessionToken){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '002', message: 'Token inválido o sesión antigua para este evento...' };
      }
  
      const newTokenjwt = await signToken(user.toLowerCase(),'false');
      const newToken = encrypt(newTokenjwt,config.key);
  
      await TokenSession.update({ token: newToken }, { where: { id: userId }, transaction: t });
      await Blackout.create({ user, token: oldToken }, { transaction: t });
  
      const newTokenExpiration = expiredDate(newTokenjwt);
      //console.log(newTokenExpiration);
      await t.commit();
  
      return { success: true, newToken, newTokenExpiration };
    } catch (error) {
      await t.rollback();
      console.error('Error al renovar el token:', error);
      throw new Error('Error al renovar el token.');
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
        await UserGameInfo.update(
          { lastconnect: new Date() },
          { where: { name: user } },
          { transaction: t }
        );
  
        // Confirma la transacción si todo se ejecutó correctamente
        await t.commit();
      }
    } catch (error) {
      // Si hay un error, realiza un rollback de la transacción
      await t.rollback();
      throw error;
    }
  }

   // Obtener datos de usuario por ID
   async getUserById(userId) {
    try {
      const user = await User.findByPk(userId);
      return user ? user : null;
    } catch (error) {
      throw new Error('Error al obtener datos de usuario por ID');
    }
  }

  // Obtener el gold de un usuario por ID
  async getUserGoldById(userId) {
    try {
      const userGameInfo = await UserGameInfo.findOne({
        attributes: ['gold'],
        where: {
          id: userId,
        },
      });

      return userGameInfo ? userGameInfo.gold : null;
    } catch (error) {
      console.error('Error al obtener el gold del usuario:', error);
      throw new Error('Error en el servidor');
    }
  }

  async getCashByUserId(userId) {
    try {
      const cashData = await Cash.findOne({ 
        attributes: ['cash'],
        where: {
          id: userId,
        }});

        return cashData ? cashData.cash : null;
    } catch (error) {
      console.error('Error al obtener el gold del usuario:', error);
      throw new Error('Error en el servidor');
    }
  }
  
  async registerUser(req,username, password, phoneNumber,character,ip) {
    const transaction = await sequelize.transaction();
  
    try {
      const existingUser = await UserGameInfo.findOne({ where: { name: username } });
  
      if (existingUser) {
        await transaction.rollback();
        return { success: false,message:'El usuario ingresado ya se encuentra registrado', code: '100' };
      }

      /*Verificar si su ip esta baneada*/
      // Verificar si el usuario está en la tabla banlist
      const bannedUser = await Banlist.findOne({ where: { UserIP: req.clientIp } });

      if(bannedUser){
        await transaction.rollback();
        return { success: false,message:'No se puede registrar porque su IP se encuentra baneada', code: '101'};
      }
  
      await User.create(
        {
          id: username,
          password,
          e_mail: phoneNumber,
        },
        { transaction }
      );

      //console.log(111111);

      // const powertimefinal = await calculatePowerUse(0,15);

      await UserGameInfo.create(
        {
          name: username,
          gold:10000,
          tutorial: 1,
          createtime: new Date(),
          lastconnect: new Date(),
          // powertime: powertimefinal,
          //powertimedate: fechaActual,
        },
        { transaction }
      );

      //console.log(22222);
  
      await Cash.create({ id: username, cash: 10000 }, { transaction });
  
      await TokenSession.create({ id: username, token: 0 }, { transaction });

      await Ticket.create({ id: username, tickets: 0 }, { transaction });

      await TicketOro.create({ id: username, tickets: 0 }, { transaction });

      //Insertar IP:
      await InitialIpUser.create({ user: username, ip: ip }, { transaction });

      // await BarraConexion.create({ User: username, BarCount: 0,ResTime:0 }, { transaction });

      // Obtener el ID de usuario desde UserGameInfo por su nombre
      const userGameInfo = await UserGameInfo.findOne({
        attributes: ['id'],
        where: {
          name: username, // Cambia esto para usar el nombre de usuario correcto
        },
        transaction, // Asociar la transacción con esta consulta
      });

      if (!userGameInfo) {
        await transaction.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '202', message: 'ID de Usuario no encontrado' };
      }
      
      // Agregar el premio a PendingPresents usando el ID de usuario obtenido
      // await PendingPresents.create(
      //   {
      //     present_id: 8000,
      //     user_id: userGameInfo.id, // Usar el ID de usuario obtenido
      //     added_time: new Date(),
      //   },
      //   {
      //     transaction, // Asociar la transacción con esta operación
      //   }
      // );

      // const pr = setPresentsReward(character); // Lista de present_ids que deseas insertar
      // const presentIds = pr.i;
      // presentIds.push(8000);
      // presentIds.push(7000);

      // const presentRecords = presentIds.map(present_id => ({
      //   present_id,
      //   user_id: userGameInfo.id,
      //   added_time: new Date(),
      // }));

      // const originRecords = presentIds.map(recompensa => ({
      //   user:username,
      //   origen:0,
      //   recompensa,
      //   tipo_recompensa: 0,
      //   fecha: new Date(),
      // }));
      
      // await PendingPresents.bulkCreate(presentRecords, { transaction });

      //LOGS REWARDS:
      // await LogRewardsUser.bulkCreate(originRecords, { transaction });
      // await LogRewardsUser.create({  
      //   user:username,
      //   origen:0,
      //   recompensa:15,
      //   tipo_recompensa: 6,
      //   fecha: new Date(), 
      // }, { transaction });

      await LogRewardsUser.create({  
        user:username,
        origen:0,
        recompensa:10000,
        tipo_recompensa: 1,
        fecha: new Date(), 
      }, { transaction });

      await LogRewardsUser.create({  
        user:username,
        origen:0,
        recompensa:10000,
        tipo_recompensa: 2,
        fecha: new Date(), 
      }, { transaction });

      // await LogRewardsUser.create({  
      //   user:username,
      //   origen:0,
      //   recompensa:8000,
      //   tipo_recompensa: 0,
      //   fecha: new Date(), 
      // }, { transaction });
      //await LogRewardsUser.bulkCreate(originRecords, { transaction });

      await transaction.commit();
  
      // return { success: true,message:'Te has registrado correctamente ¡Has recibido 10000 de Cash y Oro + '+ pr.m +' de recompensa por registrarte!', code: '000' };
      return { success: true,message:'Te has registrado correctamente ¡Has recibido 10000 de Cash y Oro de recompensa por registrarte!', code: '000' };
    } catch (error) {
      await transaction.rollback();
      console.error('Error al registrar el usuario:', error);
      throw new Error('Error interno del servidor');
    }
  }

  async getProfileService(username,token) {
    try {

      // Verificar token:
      const sessionToken = await TokenSession.findOne({
        attributes: ['token'],
        where: {
          token: token,
          id: username,
        },
        //transaction: t, // Asociar la transacción con esta consulta
      });

      if(!sessionToken){
        //await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '001', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      const userGameInfo = await UserGameInfo.findOne({
        where: { name: username },
        attributes: ['id','gold', 'powertimedate', 'lastconnect'],
      });
  
      if (!userGameInfo) {
        return { message: 'Usuario no encontrado' };
      }
  
      const cash = await Cash.findOne({
        where: { id: username }, // Suponiendo que el campo id en User es el nombre de usuario
        attributes: ['cash'], // Ajusta esto según tus necesidades
      });
  
      const characters = await CharacterInfo.findAll({
        where: { userid: userGameInfo.id },
        attributes: ['id', 'level', 'Class', 'name', 'win', 'lose','exp'],
      });
  
      for (const character of characters) {
        // Obtener la exp del personaje individualmente
        const classLevelInfo = await ClassLevelInfo.findOne({
          where: {
            Class: character.Class,
            level: character.level + 1,
          },
          attributes: ['exp'],
        });
  
        // Agregar la exp al personaje
        character.setDataValue('nextexp', classLevelInfo?.exp || 0);
      }
  
      const profileData = {
        cash: cash.cash, // Ajusta esto según la columna correcta en User
        gold: userGameInfo.gold,
        powertimedate: userGameInfo.powertimedate,
        lastconnect: userGameInfo.lastconnect,
        characters: characters,
      };
  
      return profileData;
    } catch (error) {
      console.error('Error al obtener el perfil del usuario:', error);
      throw new Error('Error interno del servidor');
    }
  }

  async getRanking() {
    try {
      const rankingData = await sequelize.query(
        `
        SELECT 
        u.name AS userName,
        ci.name AS charName,
        ci.level,
        ci.win,
        ci.lose,
        COALESCE(clan.name, '-') AS clanName,
        (ci.win - ci.lose) AS winLossDifference,
        ((ci.win - ci.lose) * 0.255) AS winrate
      FROM usergameinfo u
      INNER JOIN (
        SELECT
          userid,
          name,
          level,
          win,
          lose,
          ROW_NUMBER() OVER (PARTITION BY userid ORDER BY win DESC) AS rnk
        FROM characterinfo
      ) AS ci ON u.id = ci.userid AND ci.rnk = 1
      LEFT JOIN claninfo clan ON u.clanid = clan.id
      ORDER BY ci.level DESC, winLossDifference DESC, winrate DESC
      LIMIT 50
        `,
        { type: sequelize.QueryTypes.SELECT }
      );
  
      /**   CASE
          WHEN ci.lose = 0 AND ci.win = 0 THEN 1
          WHEN ci.lose = 0 AND ci.win > 0 THEN ci.win / 1
          WHEN ci.lose > 0 THEN ci.win / ci.lose
        END AS winrate*/
      return rankingData;
    } catch (error) {
      console.error('Error al obtener el ranking:', error);
      throw new Error('Error interno del servidor');
    }
  }
  
  async getTickets(userId,type,mode) {
    try {
      const userTicket = await TicketsMode.findOne({
      attributes: ['tickets','user'],
          where: {
              user: userId,
              type:type,
              mode:mode,
          },
      });

      return userTicket ? {tickets:userTicket.tickets} : {tickets:0};
    } catch (error) {
      console.error('Error al obtener la cantidad de tickets:', error);
      throw new Error('Error en el servidor');
    }
  }

  async resetStage(token,idStage,user,isDataIntegrityValid,paramsString, req) {
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
        return { success: false, code: '300', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      //Verificar cantidad de tickets:
      const tcksStage = await TicketsMode.findOne({
        attributes:['tickets'],
        where:{
          user: user,
          type:1,
          mode:idStage,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if(!tcksStage){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '200', message: 'No tienes tickets suficientes para resetear este stage' };
      } else{
        if(tcksStage.tickets <= 0){
          await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '200', message: 'No tienes tickets suficientes para resetear este stage' };
        }
      }

      //Obtener id de usuario:
      const usergetId = await UserGameInfo.findOne({
        attributes:['id'],
        where:{
          name: user
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if (!usergetId) {
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '200', message: 'ID de Usuario no encontrado' };
      }

       // Obtener todos los id's de personajes
       const personajes = await CharacterInfo.findAll({
        attributes: ['id'],
        where: {
          userid: usergetId.id,
        },
        raw: true,
        transaction: t,
      });

      // Mapear los resultados a un array de números
      const arrayPersonajes = personajes.map((item) => item.id)
      //console.log(arrayPersonajes);

      if(arrayPersonajes.length <= 0){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '100', message: 'No tienes personajes creados' };
      }

      //Si si tiene verificar que hayan personajes para todos los stages

      var arrId = [];

      for(const p of arrayPersonajes){
        //console.log(p);
        const ExistPersonajeInStage = await UserStageInfo.findOne({
          attributes: ['id'],
          where: {
            characterid: p,
            stage: idStage,
          },
          transaction: t, // Asociar la transacción con esta consulta
        });

        if(ExistPersonajeInStage){
          arrId.push(ExistPersonajeInStage.id);
        }
      }

      if(arrId.length<= 0){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '100', message: 'Aún no has usado ninguno de tus personaje en este stage' };
      }

      // Como si existe...eliminamos:
      // Eliminar los registros
      await UserStageInfo.destroy({
        where: {
          id: {
            [Op.in]: arrId,
          },
        },
        transaction: t,
      });

      // Decrementar:
      // Decrementar el ticket del usuario
      await TicketsMode.decrement('tickets', {
        by: 1,
        where: {
          user: user,
          type:1,
          mode:idStage,
        },
        transaction: t, // Asociar la transacción con esta operación
      });

      // Commit de la transacción si todo fue exitoso
      await t.commit();
      return { success: true, code: '000', message: 'Se ha reseteado el stage correctamente' };
    } catch (error) {
      await t.rollback();
      console.error('Error al obtener la cantidad de tickets:', error);
      throw new Error('Error en el servidor');
    }
  }
}

export default new UserService();
