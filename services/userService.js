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
import InitialIpUser from '../models/ipUserModel.js';
import ExchangeRate from '../models/exchangeRateModel.js';
import TrackingPacket from '../models/trackingPacketModel.js';
import LogExchange from '../models/logExchanges.js';
import TicketsMode from '../models/ticketsModeModel.js';
import UserStageInfo from '../models/userStageInfo.js';
// import BarraConexion from '../models/barProgressModel.js';
import { decrypt, encrypt } from '../helpers/encryption.js';
import config from '../config/config.js';
import AssetPrice from '../models/assetsPriceModel.js';
import UserAsset from '../models/userAssetsModel.js';
import TypeAsset from '../models/typeAssetsModel.js';
import AnunciosComment from '../models/anunciosCommentModel.js';
import ConfigParameters from '../models/configParametersModel.js';
import EventsReview from '../models/eventsReviewModel.js';
import LogRemoveCharacter from '../models/logRemoveCharacterModel.js';
import EventLevelCharacter from '../models/eventLevelChModel.js';
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
  
      // Verificar las credenciales en la tabla 'Webuser'
      const user = await User.findOne({ where: { id:id, password } });
  
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

        const userTable = await User.findOne({ where: { id } });
  
  
        // Combinar la información del usuario
        const completeUserInfo = { ...userTable.toJSON(), ...userInfo.toJSON() };

        // const claim = hasUserClaimed(user.id);
  
        // Devolver el objeto con toda la información del usuario, el token y el código 2
        await t.commit();
        return { _u: completeUserInfo, auth:token, tx:expired, success:true, message:'Iniciaste sesión correctamente', code: '000' };
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

  // Obtener activos de un usuario por ID
  async getAssetsUser(user,token) {
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
        // console.log('[ERROR]'.red,'Sesión antigua'.red);
        return { success: false, code: '999', message: 'Token inválido o sesión antigua...' };
      }

      const userGameInfo = await UserGameInfo.findOne({
        attributes: ['gold'],
        where: {
          name: user,
        },
        transaction: t,
      });

      const cashData = await Cash.findOne({ 
        attributes: ['cash'],
        where: {
          id: user,
      },
      transaction: t,
    });

      const userPoints = await UserGameInfo.findOne({
        attributes: ['clanpoint'],
        where: {
          name: user,
        },
        transaction: t,
      });

      const userAsset = await UserAsset.findAll({
        attributes: ['asset', 'amount'],
        where: {
          user: user,
        },
        order:[['asset','ASC']],
        transaction: t,
      });
      
      // Recorrer cada assetPrice y buscar su tipo en TypeAsset y la imagen en AssetPrices
      const assetsWithDetails = await Promise.all(
        userAsset.map(async (asset) => {
          // Buscar el tipo correspondiente en TypeAsset
          const typeAsset = await TypeAsset.findOne({
            where: { id: asset.asset },
            attributes: ['tipo'], // Obtener solo el campo 'tipo'
          });

          // Buscar la imagen correspondiente en AssetPrices
          const assetPrice = await AssetPrice.findOne({
            where: { asset: asset.asset },
            attributes: ['img'], // Obtener solo el campo 'img'
          });

          // Agregar el tipo y la imagen al resultado, devolviendo solo el registro actual
          return {
            asset: asset.asset,
            amount: asset.amount,
            tipo: typeAsset ? typeAsset.tipo : 'Tipo no encontrado',
            img: assetPrice ? assetPrice.img : 'Imagen no encontrada',
          };
        })
      );

      const _au = {
        o: userGameInfo ? userGameInfo.gold : 0,
        c: cashData ? cashData.cash : 0,
        ep: userPoints ? userPoints.clanpoint : 0,
        asst: assetsWithDetails,
      };

      await t.commit();
      return { success: true, code: '000', _au};
    } catch (error) {
      console.error('Error al obtener los activos del usuario:', error);
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

      /*Verificar si su ip esta baneada*/
      // Verificar si el usuario está en la tabla banlist
      const bannedUser = await Banlist.findOne({ where: { UserIP: ip } });

      if(bannedUser){
        await transaction.rollback();
        return { success: false,message:'No se puede registrar porque su IP se encuentra baneada', code: '101'};
      }

      const existingUser = await UserGameInfo.findOne({ where: { name: username } });
  
      if (existingUser) {
        await transaction.rollback();
        return { success: false,message:'El usuario ingresado ya se encuentra registrado', code: '100' };
      }

      // const apodoUser = await User.findOne({ where: { apodo: apodo } });
  
      // if (apodoUser) {
      //   await transaction.rollback();
      //   return { success: false,message:'El apodo ingresado ya se encuentra en uso', code: '100' };
      // }
       
      if (
        !/^[a-zA-Z0-9]+$/.test(password) ||
        password.length < 6 ||
        password.length > 8
      ) {
          await transaction.rollback();
          return { success: false,message:"La contraseña debe contener solo caracteres alfanuméricos y tener entre 6 y 8 caracteres", code: '100' };
      }

      // if (
      //   !apodo ||
      //   apodo.length < 3 ||
      //   apodo.length > 11
      // ) {
      //     await transaction.rollback();
      //     return { success: false,message:"El apodo debe tener entre 3 y 11 caracteres", code: '100' };
      // }

      if (
        !username ||
        username.length < 3 ||
        username.length > 11
      ) {
          await transaction.rollback();
          return { success: false,message:"El nombre de usuario debe tener entre 3 y 11 caracteres", code: '100' };
      }

      // const passwordEncrypt = await EncryptFunction(password);

      // console.log(password);
      // console.log(passwordEncrypt);
  
      await User.create(
        {
          id: username,
          password:password,
          // apodo,
          e_mail: phoneNumber,
        },
        { transaction }
      );

      // await WebUser.create(
      //   {
      //     user: username,
      //     password
      //   },
      //   { transaction }
      // )

      //console.log(111111);

      // const powertimefinal = await calculatePowerUse(0,15);

      await UserGameInfo.create(
        {
          name: username,
          gold:12000,
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
      // await EventPoint.create({ User: username, Points: 0 }, { transaction });
  
      // Token
      await TokenSession.create({ id: username, token: 0 }, { transaction });

      // Assets: piedras refineria, .... tickets etc
      await UserAsset.create({ user: username, amount: 0, asset:1 }, { transaction }); //refineria piedra 1
      await UserAsset.create({ user: username, amount: 0, asset:2 }, { transaction }); //refineria piedra 2

      // await TicketOro.create({ id: username, tickets: 0 }, { transaction });

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
      // // presentIds.push(8000);
      // // presentIds.push(7000);

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

      // //LOGS REWARDS:
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
        recompensa:12000,
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

      const message = 'Te has registrado correctamente ¡Has recibido 10K Cash y 12K Oro de recompensa por registrarte!';
      // const message = '¡Se registro tu usuario correctamente!';
  
      return { success: true,message, code: '000' };
      // return { success: true,message, code: '000' };
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
        order:[['slot','ASC']],
      });
  
      for (const character of characters) {
        // Obtener la exp del personaje individualmente
        const classLevelInfo = await ClassLevelInfo.findOne({
          where: {
            Class: character.Class,
            level: character.level,
          },
          attributes: ['exp'],
        });
  
        const classLevelInfo2 = await ClassLevelInfo.findOne({
          where: {
            Class: character.Class,
            level: character.level ? character.level - 1 : 0,
          },
          attributes: ['exp'],
        });

        // Agregar la exp al personaje
        character.setDataValue('nextexp', classLevelInfo?.exp || 0);
        character.setDataValue('iniexp', classLevelInfo2?.exp || 0);
      }

      // Obtener precio desde ConfigParameter
      const config = await ConfigParameters.findOne({
        where: { name: 'price_remove' },
        attributes: ['value'],
        // transaction: t,
      });
  
      const profileData = {
        cash: cash.cash, // Ajusta esto según la columna correcta en User
        gold: userGameInfo.gold,
        powertimedate: userGameInfo.powertimedate,
        lastconnect: userGameInfo.lastconnect,
        characters: characters,
        pricermv: JSON.parse(config.value),
      };
  
      return profileData;
    } catch (error) {
      console.error('Error al obtener el perfil del usuario:', error);
      throw new Error('Error interno del servidor');
    }
  }

  async removeCharacter(username,token,character) {
    const t = await sequelize.transaction();
    const currency = 1; // Por defecto, 1 es CASH
    try {

      // Verificar token:
      const sessionToken = await TokenSession.findOne({
        attributes: ['token'],
        where: {
          token: token,
          id: username,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if(!sessionToken){
        //await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '001', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      // 2. Obtener usuario
      const userGameInfo = await UserGameInfo.findOne({
        where: { name: username },
        // attributes: ['id', 'gold', 'powertimedate', 'lastconnect'],
        transaction: t,
        lock: t.LOCK.UPDATE, // Bloqueo para modificación segura futura
      });

      if (!userGameInfo) {
        await t.rollback();
        return { message: 'Usuario no encontrado',code:'999',succes:false };
      }

      // 3. Verificar que el personaje le pertenece
      const characterReg = await CharacterInfo.findOne({
        where: { id: character, userid: userGameInfo.id },
        transaction: t,
        lock: t.LOCK.UPDATE, // Si lo vas a eliminar después
      });

      if (!characterReg) {
        await t.rollback();
        return { success: false, message: 'El personaje no te pertence o ya no existe, actualiza la página.',code:'999' };
      }

      if(characterReg.slot === 0){
        await t.rollback();
        return { success: false, message: 'No puedes eliminar un personaje principal.',code:'999' };
      }

      if(characterReg.slot === 0){
        await t.rollback();
        return { success: false, message: 'No puedes eliminar un personaje principal.',code:'999' };
      }

       // Verificar si el usuario ya seleccionó un personaje
      const existingEntry = await EventLevelCharacter.findOne({
        where: {
            user: username,
            characterid: character
        },
        transaction: t,
      });

      if(existingEntry){
        await t.rollback();
        return { success: false, message: 'No puedes eliminar este personaje porque lo estas usando en el evento de reto de nivel.',code:'999' };
      }

      // 4. Obtener cash del usuario
      const cash = await Cash.findOne({
        where: { id: username },
        // attributes: ['cash'],
        transaction: t,
        lock: t.LOCK.UPDATE, // Vamos a descontar cash
      });

      // 4. Obtener precio desde ConfigParameter
      const config = await ConfigParameters.findOne({
        where: { name: 'price_remove' },
        attributes: ['value'],
        transaction: t,
      });

      // 5. Verificar si han pasado al menos 7 días desde la creación del personaje
      const fechaCreacion = new Date(characterReg.createtime);
      const hace7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      console.log('Ch date create: ',fechaCreacion);
        console.log('Limit day 7: ',hace7Dias);


      if (fechaCreacion > hace7Dias) {
        await t.rollback();
        return {
          success: false,
          code: '999',
          message: `Este personaje fue creado hace menos de 7 días. No puedes eliminarlo aún.`,
        };
      }

      let priceRemove = 0;
      if (config) {
        try {
          const priceJson = JSON.parse(config.value);
          priceRemove = priceJson[currency] || 0;
        } catch {
          priceRemove = 0;
        }
      }
  
      // 6. Validar que tenga suficiente cash
      if (userGameInfo.gold < priceRemove) {
        await t.rollback();
        return {
          success: false,
          code: '999',
          message: `No tienes suficiente oro para eliminar el personaje. Se requieren ${priceRemove} de Oro.`,
        };
      }

       // 6. Descontar el cash
      userGameInfo.gold -= priceRemove;
      await userGameInfo.save({ transaction: t });

      // 7. Registrar la eliminación del personaje
      await LogRemoveCharacter.create({
        charname: characterReg.name,
        level: characterReg.level,
        slot: characterReg.slot,
        user:username,
        fecha: new Date(),
      }, { transaction: t });

      // 8. Eliminar el personaje de CharacterInfo
      await characterReg.destroy({ transaction: t });
      
      // Commit de la transacción si todo fue exitoso
      await t.commit();
      return {success:true,code:'000',message:'El personaje fue eliminado con éxito'};
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
        ci.Class,
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
          Class,
          level,
          win,
          lose,
          ROW_NUMBER() OVER (PARTITION BY userid ORDER BY win DESC) AS rnk
        FROM characterinfo
      ) AS ci ON u.id = ci.userid AND ci.rnk = 1
      LEFT JOIN claninfo clan ON u.clanid = clan.id
      ORDER BY winLossDifference DESC, winrate DESC
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

  async getRankingClanes() {
    try {
      const rankingData = await sequelize.query(
        `
        SELECT 
            u.clanid,
            clan.name AS clanName,
            SUM(ci.win) AS totalWins,
            SUM(ci.lose) AS totalLoses,
            CASE 
                WHEN (SUM(ci.win) + SUM(ci.lose)) > 0 
                THEN ((SUM(ci.win) - SUM(ci.lose)) * 0.255)
                ELSE 0 
            END AS winrate
        FROM characterinfo ci
        INNER JOIN usergameinfo u ON ci.userid = u.id
        INNER JOIN claninfo clan ON u.clanid = clan.id
        WHERE u.clanid != 0
        GROUP BY u.clanid, clan.name
        ORDER BY winrate DESC
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
        where:{
          user: user,
          type:1,
          mode:idStage,
        },
        transaction: t, // Asociar la transacción con esta consulta
        lock: t.LOCK.UPDATE,
      });

      if(!tcksStage || tcksStage.tickets <= 0){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '200', message: 'No tienes tickets suficientes para resetear este stage' };
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
      tcksStage.tickets -= 1;
      await tcksStage.save({ transaction: t });

      // Commit de la transacción si todo fue exitoso
      await t.commit();
      return { success: true, code: '000', message: 'Se ha reseteado el stage correctamente' };
    } catch (error) {
      await t.rollback();
      console.error('Error al obtener la cantidad de tickets:', error);
      throw new Error('Error en el servidor');
    }
  }


  async buyAssets(user,token,assetid,type_payment,cantidad,req) {
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
        console.log('[ERROR]'.red,'Sesión antigua'.red);
        return { success: false, code: '999', message: 'Token inválido o sesión antigua para generar esta compra...' };
      }

      var payment;
      var typem;
      var origen;
      var tiporec;


      // Tipo de Asset
      const AssetBuy = await AssetPrice.findOne({
            where: {
                id: assetid,
                show: 1,
            },
        });


        if (!AssetBuy) {
          await t.rollback();
          console.log('[ERROR]'.red,'Activo no disponible'.red);
          return { success: false, code: '100', message: `El activo no se encuentra disponible, actualiza la página por favor.`};
        }

      switch (AssetBuy.asset) {
        case 1:
          origen = 10;
          tiporec = 14;
          console.log('Asset:'.blue,'Piedra de refinería 1'.yellow,(' [' +String(cantidad)+ ']').yellow);
          break;
        case 2:
          origen = 11;
          tiporec = 15;
          console.log('Asset:'.blue,'Piedra de refinería 2'.yellow,(' [' +String(cantidad)+ ']').yellow);
          break;
        case 3:
          origen = 8;
          tiporec = 12;
          console.log('Asset:'.blue,'Giro de Ruleta'.yellow,(' [' +String(cantidad)+ ']').yellow);
          break;
        case 4:
          origen = 15;
          tiporec = 18;
          console.log('Asset:'.blue,'Pica de minar'.yellow,(' [' +String(cantidad)+ ']').yellow);
          break;
        default:
          origen = 0;
          tiporec = 0;
          break;
      }

      if(origen === 0 && tiporec === 0){
        await t.rollback();
        console.log('[ERROR]'.red,'Item de web inválido'.red);
        return { success: false, code: '200', message: 'El tipo de item de web no es válido' };
      }

      const price = (AssetBuy.multiple ? JSON.parse(AssetBuy.price) : [Number(AssetBuy.price)])[type_payment];
      const currency = (AssetBuy.multiple ? JSON.parse(AssetBuy.currency) : [Number(AssetBuy.currency)])[type_payment];

      switch (currency) {
        case 0:
          payment = 1;
          typem = 'cash';
          console.log('Medio de pago:'.blue,'Cash'.yellow);
          break;
        case 1:
          typem = 'oro';
          payment = 2;
          console.log('Medio de pago:'.blue,'Oro'.yellow);
          break;
        case 2:
          typem = 'punto(s) de evento';
          payment = 3;
          console.log('Medio de pago:'.blue,'Puntos de evento'.yellow);
          break;
        default:
          payment = null;
          typem = 'NULL';
          break;
      }

      if(payment === null){
        await t.rollback();
        console.log('[ERROR]'.red,'Medio de pago inválido'.red);
        return { success: false, code: '200', message: 'El tipo de pago seleccionado no es válido' };
      }

      var currencyAmount;
      var amount;
      // var typem = payment === 1 ? 'cash' : 'oro';

      const params = {};
      
      if(payment===1){
        currencyAmount = await Cash.findOne({
          where: {
            id: user,
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        amount = currencyAmount.cash;
      } else if(payment===2) {
        currencyAmount = await UserGameInfo.findOne({
          where: {
            name: user,
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        amount = currencyAmount.gold;
      } else if(payment===3){
        currencyAmount = await UserGameInfo.findOne({
          // attributes: ['Points'],
          where: {
            name: user,
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        amount = currencyAmount.clanpoint;
      }
  // console.log('a');

      // const ticketsPrice = payment === 1 ? 1000 : 2000; // Precio de un ticket en cash u oro
  
      if (!currencyAmount || amount < price * cantidad) {
        await t.rollback();
        console.log('[ERROR]'.red,'Saldo insuficiente'.red);
        return { success: false, code: '100', message: `No tienes suficiente(s) ${typem} para esta compra`};
      }

      // console.log(1111);
      // Actualizar el asset en UserAssets
      const userAsset = await UserAsset.findOne({
        where: {
          user: user,
          asset: AssetBuy.asset,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      // console.log(cantidad);
      // console.log(AssetBuy.asset);
      if (userAsset) {
        // Si ya tiene el asset, incrementar la cantidad
        userAsset.amount += cantidad;
        await userAsset.save({ transaction: t });
        // console.log('Asset actualizado:'.green, `Cantidad actualizada a ${userAsset.amount}`.green);
      } else {
        // Si no tiene el asset, crear un nuevo registro
        // console.log(AssetBuy);
        await UserAsset.create(
          {
            user: user,
            asset: AssetBuy.asset,
            amount: cantidad,
          },
          { transaction: t }
        );
        // console.log('Asset añadido:'.green, `Cantidad inicial ${cantidad}`.green);
      }

      // Descontar el pago (cash/oro/puntos de evento) como lo haces antes
      if (payment === 1) {
        currencyAmount.cash -= price * cantidad;
        await currencyAmount.save({ transaction: t });
        // params['c'] = currencyAmount.cash;
      } else if (payment === 2) {
        currencyAmount.gold -= price * cantidad;
        await currencyAmount.save({ transaction: t });
        // params['g'] = currencyAmount.gold;
      } else if (payment === 3) {
        currencyAmount.clanpoint -= price * cantidad;
        await currencyAmount.save({ transaction: t });
        // params['ep'] = currencyAmount.Points;
      }

     
      await LogRewardsUser.create({  
        user:user,
        origen:origen,
        recompensa:cantidad,
        tipo_recompensa: tiporec,
        //origen_2: type,
        fecha: new Date(), 
      }, { transaction: t });
     
      await t.commit();

      console.log('[EXITO]'.green,'Compra exitosa'.green);

     
      return { success: true, code: '000', message: 'Se ha realizado tu compra de manera exitosa'};
    } catch (error) {
      await t.rollback();
      throw new Error('Error al realizar la compra');
    }
  }

  async setComentarioAnuncio(user,token,anuncio,comentario ,req) {
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
        // console.log('[ERROR]'.red,'Sesión antigua'.red);
        return { success: false, code: '999', message: 'Token inválido o sesión antigua para realizar este comentario...' };
      }

      // Verificar token blackout:
      const blackoutToken = await Blackout.findOne({
        attributes: ['token'],
        where: {
          token: token,
          user: user,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if(blackoutToken){
        await t.rollback(); // Revertir la transacción en caso de error
        // console.log('[ERROR]'.red,'Sesión antigua'.red);
        return { success: false, code: '999', message: 'Sesión inválida, ya ha cerrado sesión. Actualice o cierre la página.' };
      }

      const userInfo = await User.findOne({
        where: {
          id: user,
        },
        transaction: t,
      });

      const now = new Date();

      // Ajustar la hora a la zona horaria de Perú (UTC -5)
      const localTimePeru = new Date(now.setUTCHours(now.getUTCHours() - 5));

      // Verificar que no haya más de 5 comentarios en el último minuto
      const unMinutoAtras = new Date(localTimePeru - 60 * 1000);
      const comentariosRecientes = await AnunciosComment.count({
        where: {
          anuncio: anuncio,
          apodo: userInfo.apodo,
          fecha: {
            [Op.gt]: unMinutoAtras, // Comentarios hechos en el último minuto
          },
        },
        transaction: t,
      });

      if (comentariosRecientes >= 5) {
        await t.rollback();
        return {
          success: false,
          code: '100',
          message: 'Estás comentando demasiado rápido, evita hacer spam.',
        };
      }

      if (!comentario || comentario.length === 0 || comentario.length > 200) {
        await t.rollback();
        return {
          success: false,
          code: '200',
          message: 'Tu comentario no tiene el rango de caracteres admitidos (1-200).',
        };
      }

      // Obtener el diccionario de palabras malas desde ConfigParameters
      const badWordsConfig = await ConfigParameters.findOne({
        where: { name: 'badwords' },
        attributes: ['value'], // Suponiendo que "value" es la columna donde está almacenado el JSON
        transaction: t,
      });

      let palabrasMalas;

      if (!badWordsConfig) {
        palabrasMalas = [];
      } else{
        palabrasMalas = JSON.parse(badWordsConfig.value);
      }
      
      const contienePalabrasMalas = palabrasMalas.some((palabra) =>
        comentario.toLowerCase().includes(palabra.toLowerCase())
      );

      if (contienePalabrasMalas) {
        await t.rollback();
        return {
          success: false,
          code: '200',
          message: 'Tu comentario tiene palabras que no están permitidas, vuelve a intentarlo.',
        };
      }

      // Si todo está bien, guardar el comentario
      await AnunciosComment.create(
        {
          anuncio: anuncio,
          apodo: userInfo.apodo,
          comentario: comentario,
          fecha: localTimePeru,
        },
        { transaction: t }
      );

      // Confirmar la transacción
      await t.commit();
     
      return { success: true, code: '000', message: 'Se ha guardado tu comentario'};
    } catch (error) {
      await t.rollback();
      console.log(error);
      throw new Error('Error al realizar al comentar');
    }
  }

  async calificarEvento(user,token,evento,comentario,estrellas ,req) {
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
        // console.log('[ERROR]'.red,'Sesión antigua'.red);
        return { success: false, code: '999', message: 'Token inválido o sesión antigua para realizar este comentario...' };
      }

       // Verificar token blackout:
       const blackoutToken = await Blackout.findOne({
        attributes: ['token'],
        where: {
          token: token,
          user: user,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if(blackoutToken){
        await t.rollback(); // Revertir la transacción en caso de error
        // console.log('[ERROR]'.red,'Sesión antigua'.red);
        return { success: false, code: '999', message: 'Sesión inválida, ya ha cerrado sesión. Actualice o cierre la página.' };
      }

      const userInfo = await User.findOne({
        where: {
          id: user,
        },
        transaction: t,
      });

      const now = new Date();

      // Ajustar la hora a la zona horaria de Perú (UTC -5)
      const localTimePeru = new Date(now.setUTCHours(now.getUTCHours() - 5));

      const eventCalf = await EventsReview.count({
        where: {
          evento: evento,
          apodo: userInfo.apodo,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (eventCalf) {
        await t.rollback();
        return {
          success: false,
          code: '100',
          message: 'Ya has calificado este evento.',
        };
      }

      if (estrellas > 5 || estrellas < 1) {
        await t.rollback();
        return {
          success: false,
          code: '200',
          message: 'La calificación debe de estar entre 1 a 5 estrellas.',
        };
      }

      if (!comentario || comentario.length === 0 || comentario.length > 200) {
        await t.rollback();
        return {
          success: false,
          code: '200',
          message: 'Tu comentario no tiene el rango de caracteres admitidos (1-200).',
        };
      }

      // Obtener el diccionario de palabras malas desde ConfigParameters
      const badWordsConfig = await ConfigParameters.findOne({
        where: { name: 'badwords' },
        attributes: ['value'], // Suponiendo que "value" es la columna donde está almacenado el JSON
        transaction: t,
      });

      let palabrasMalas;

      if (!badWordsConfig) {
        palabrasMalas = [];
      } else{
        palabrasMalas = JSON.parse(badWordsConfig.value);
      }
      
      const contienePalabrasMalas = palabrasMalas.some((palabra) =>
        comentario.toLowerCase().includes(palabra.toLowerCase())
      );

      if (contienePalabrasMalas) {
        await t.rollback();
        return {
          success: false,
          code: '200',
          message: 'Tu comentario tiene palabras que no están permitidas, vuelve a intentarlo.',
        };
      }

      // Si todo está bien, guardar el comentario
      await EventsReview.create(
        {
          evento: evento,
          apodo: userInfo.apodo,
          review: comentario,
          points: Number(estrellas),
          fecha: localTimePeru,
        },
        { transaction: t }
      );

      // Confirmar la transacción
      await t.commit();
     
      return { success: true, code: '000', message: 'Se ha guardado tu calificación'};
    } catch (error) {
      await t.rollback();
      console.log(error);
      throw new Error('Error al realizar al comentar');
    }
  }
}

export default new UserService();
