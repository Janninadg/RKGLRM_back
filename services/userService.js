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
import { EncryptFunction, verifyPacketAndBan } from '../utils/securityUtils.js';
import LogExchange from '../models/logExchanges.js';
import TicketsMode from '../models/ticketsModeModel.js';
import UserStageInfo from '../models/userStageInfo.js';
import { calculatePowerUse } from '../utils/prizesUtils.js';
// import BarraConexion from '../models/barProgressModel.js';
import { decrypt, encrypt } from '../helpers/encryption.js';
import config from '../config/config.js';
import { hasUserClaimed, setPresentsReward } from '../utils/gameUtils.js';
import LogRewardsUser from '../models/logRewardUserModel.js';
import AssetPrice from '../models/assetsPriceModel.js';
import EventPoint from '../models/eventPointsModel.js';
import UserAsset from '../models/userAssetsModel.js';
import TypeAsset from '../models/typeAssetsModel.js';
import AnunciosComment from '../models/anunciosCommentModel.js';
import ConfigParameters from '../models/configParametersModel.js';
import EventsReview from '../models/eventsReviewModel.js';
import WebUser from '../models/webUsersModel.js';
import LogRemoveCharacter from '../models/logRemoveCharacterModel.js';
import EventLevelCharacter from '../models/eventLevelChModel.js';
import ForumUserRole from '../models/Forum/ForumRole.js';
import Role from '../models/Forum/Role.js';
import UserCredits from '../models/Trades/userCreditsModel.js';
import StagesReset from '../models/stagesResetModel.js';
import ClanInfo from '../models/clanInfoModel.js';
import { generateRandomPassword, validateUserSession } from '../utils/utils.js';
import ClanLog from '../models/clanLogModel.js';
import ClanRequest from '../models/clanRequestModel.js';
import PasswordLogs from '../models/passwordLogsModel.js';
import CharacterInfoLog from '../models/characterInfoLogModel.js';

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
      const bannedUser = await Banlist.findOne({ where: { UserName: id } });
  
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
      const user = await WebUser.findOne({ where: { user:id, password } });
  
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
          where: { name: user.user },
          attributes: ['id','name', 'createtime', 'lastconnect'],
          transaction: t,
        });

        const userTable = await User.findOne(
          { 
            where: { id },
            attributes: ['apodo','e_mail','phone'],
          });
  
        let rank = {
          name: "Principiante", // default inicial
          icon: 'https://cdn-icons-png.flaticon.com/512/4208/4208039.png',
          progress: 0,
          max: 0,
          progressPercent: 0,
          remaining: 0,
          level: 0,
        };

         if (userInfo) {
          const characters = await CharacterInfo.findAll({
            where: { userid: userInfo.id },
            order:[['slot','ASC']],
          });

          if (characters.length > 0) {
            // Buscar personaje de mayor nivel
            const topCharacter = characters.reduce((prev, curr) =>
              curr.level > prev.level ? curr : prev
            , characters[0]);

            // Buscar exp de nivel actual y anterior
            const classLevelInfo = await ClassLevelInfo.findOne({
              where: { Class: topCharacter.Class, level: topCharacter.level },
              attributes: ['exp'],
            });

            const classLevelInfo2 = await ClassLevelInfo.findOne({
              where: { Class: topCharacter.Class, level: topCharacter.level ? topCharacter.level - 1 : 0 },
              attributes: ['exp'],
            });

            const iniexp = classLevelInfo2?.exp || 0;
            const nextexp = classLevelInfo?.exp || 0;
            const currentExp = topCharacter.exp || 0;
            const maxExp = nextexp - iniexp;
            const currEco = currentExp - iniexp;
            const progressPercent = nextexp > 0 ? Math.floor((currEco / maxExp) * 100) : 0;
            const remaining = nextexp > 0 ? nextexp - currentExp : 0;

            rank = {
              name: "Principiante", // Default
              icon: "https://cdn-icons-png.flaticon.com/512/6000/6000521.png",
              progress: currentExp,
              max: nextexp,
              progressPercent,
              remaining,
              level: topCharacter.level,
            };
          }
        }

        // Obtener roles del usuario
        const forumUserRoles = await ForumUserRole.findAll({
          where: { user_id: userTable.apodo }, // user_id = apodo
          attributes: ['role_id', 'principal'],
          raw: true,
        });

        // Si se encontraron roles, traer la info de cada uno desde Role
        let roles = [];
        let userColor = "#FFFFFF"; // color por defecto

        if (forumUserRoles.length > 0) {
          const roleIds = forumUserRoles.map(r => r.role_id);
          const rolesInfo = await Role.findAll({
            where: { id: roleIds },
            attributes: ['id', 'name'],
            raw: true,
          });

           const gameRole = await Role.findOne({
              where: { id: roleIds, type: 'game' },
              attributes: ['name'],
              raw: true,
            });

           if (gameRole) {
              rank.name = gameRole.name; // reemplaza solo el nombre
            }

            const principalRole = forumUserRoles.find(fr => fr.principal === 1);
            if (principalRole) {
              const roleInfo = await Role.findOne({
                where: { id: principalRole.role_id },
                attributes: ['color'],
                raw: true,
              });
              if (roleInfo && roleInfo.color) {
                userColor = roleInfo.color;
              }
            }

          // Combinar con principal
          roles = rolesInfo.map(r => {
            const principal = forumUserRoles.find(fr => fr.role_id === r.id)?.principal || 0;
            return {
              id: r.id,
              name: r.name,
              principal,
            };
          });
        }
  
        // Combinar la información del usuario
       // 6. Combinar datos finales
        const completeUserInfo = {
          ...userTable.toJSON(),
          ...userInfo.toJSON(),
          // apodo: user.apodo || null,
          // name: user.name || null,
          color: userColor,
          roles,
          avatar: user.photo || null,
          rank,
        };

        // const claim = hasUserClaimed(user.id);
  
        // Devolver el objeto con toda la información del usuario, el token y el código 2
        await t.commit();
        return { _u: completeUserInfo, auth:token, tx:expired, success:true, message:'Ha iniciado sesión correctamente', code: '000' };
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

      const creditsData = await UserCredits.findOne({ 
        attributes: ['credits'],
        where: {
          user: user,
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
        cr: creditsData ? creditsData.credits : 0,
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
  
  async registerUser(req,username,apodo, password, phoneNumber,character,email,ip) {
    const transaction = await sequelize.transaction();
  
    try {

      /*Verificar si su ip esta baneada*/
      // Verificar si el usuario está en la tabla banlist
      const bannedUser = await Banlist.findOne({ where: { UserName: ip } });

      if(bannedUser){
        await transaction.rollback();
        return { success: false,message:'No se puede registrar porque su IP se encuentra baneada', code: '101'};
      }

      const existingUser = await UserGameInfo.findOne({ where: { name: username } });
  
      if (existingUser) {
        await transaction.rollback();
        return { success: false,message:'El usuario ingresado ya se encuentra registrado', code: '100' };
      }

      const existingEmail = await User.findOne({ where: { e_mail: email } });

       if (existingEmail) {
        await transaction.rollback();
        return { success: false,message:'El correo ingresado ya se encuentra registrado', code: '100' };
      }


      const apodoUser = await User.findOne({ where: { apodo: apodo } });
  
      if (apodoUser) {
        await transaction.rollback();
        return { success: false,message:'El apodo ingresado ya se encuentra en uso', code: '100' };
      }
       
      if (
        !/^[a-zA-Z0-9]+$/.test(password) ||
        password.length < 6 ||
        password.length > 8
      ) {
          await transaction.rollback();
          return { success: false,message:"La contraseña debe contener solo caracteres alfanuméricos y tener entre 6 y 8 caracteres", code: '100' };
      }

      if (
        !apodo ||
        apodo.length < 3 ||
        apodo.length > 11
      ) {
          await transaction.rollback();
          return { success: false,message:"El apodo debe tener entre 3 y 11 caracteres", code: '100' };
      }

      if (
        !username ||
        username.length < 3 ||
        username.length > 11
      ) {
          await transaction.rollback();
          return { success: false,message:"El nombre de usuario debe tener entre 3 y 11 caracteres", code: '100' };
      }

      // const passwordEncrypt = await EncryptFunction(password.toLowerCase());
      const randomPassword = generateRandomPassword();

      // console.log(password);
      // console.log(passwordEncrypt);

      const lowerUser = username.toLowerCase();
  
      await User.create(
        {
          id: lowerUser,
          password:randomPassword,
          apodo,
          e_mail: email,
          phone:phoneNumber,
        },
        { transaction }
      );

      const firstLetter = username.charAt(0).toUpperCase();
      const color = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

      await WebUser.create(
        {
          user: lowerUser,
          password: password.toLowerCase(),
          photo: `https://dummyimage.com/60x60/${color}/ffffff&text=${firstLetter}`,
        },
        { transaction }
      );
      //console.log(111111);

      const powertimefinal = await calculatePowerUse(0,5);

      await UserGameInfo.create(
        {
          name: lowerUser,
          gold:18000,
          tutorial: 1,
          createtime: new Date(),
          lastconnect: new Date(),
          powertime: powertimefinal,
          //powertimedate: fechaActual,
        },
        { transaction }
      );

      await UserCredits.create(
        {
          user: lowerUser,
          credits: 0,
        },
        { transaction }
      );

      //console.log(22222);
  
      await Cash.create({ id: lowerUser, cash: 10000 }, { transaction });
      await EventPoint.create({ User: lowerUser, Points: 0 }, { transaction });
  
      // Token
      await TokenSession.create({ id: lowerUser, token: 0 }, { transaction });

      // Assets: piedras refineria, .... tickets etc
      await UserAsset.create({ user: lowerUser, amount: 0, asset:1 }, { transaction }); //refineria piedra cash
      await UserAsset.create({ user: lowerUser, amount: 0, asset:2 }, { transaction }); //refineria piedra oro
      await UserAsset.create({ user: lowerUser, amount: 0, asset:3 }, { transaction }); //giro ruleta

      // await TicketOro.create({ id: username, tickets: 0 }, { transaction });

      //Insertar IP:
      await InitialIpUser.create({ user: lowerUser, ip: ip }, { transaction });

      // Asignar roles iniciales
      const initialRoles = [
        { roleId: 1, principal: 1 },   // Principiante (game) → principal
        { roleId: 16, principal: 0 },  // Usuario (forum)
      ];

      // Insertar en ForumUserRole
      for (const r of initialRoles) {
        await ForumUserRole.create({
          user_id: apodo,   // user_id = apodo
          role_id: r.roleId,
          principal: r.principal,
        }, { transaction });
      }

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

      const pr = setPresentsReward(character); // Lista de present_ids que deseas insertar
      const presentIds = pr.i;

      presentIds.push(12215);
      presentIds.push(12215);
      presentIds.push(12214);

      presentIds.push(12272); 
      presentIds.push(12272);
      presentIds.push(12271); 

      const presentRecords = presentIds.map(present_id => ({
        present_id,
        user_id: userGameInfo.id,
        added_time: new Date(),
      }));

      const originRecords = presentIds.map(recompensa => ({
        user:lowerUser,
        origen:0,
        recompensa,
        tipo_recompensa: 0,
        fecha: new Date(),
      }));
      
      await PendingPresents.bulkCreate(presentRecords, { transaction });

      //LOGS REWARDS:
      await LogRewardsUser.bulkCreate(originRecords, { transaction });
      // await LogRewardsUser.create({  
      //   user:username,
      //   origen:0,
      //   recompensa:15,
      //   tipo_recompensa: 6,
      //   fecha: new Date(), 
      // }, { transaction });

      await LogRewardsUser.create({  
        user:lowerUser,
        origen:0,
        recompensa:18000,
        tipo_recompensa: 1,
        fecha: new Date(), 
      }, { transaction });

      await LogRewardsUser.create({  
        user:lowerUser,
        origen:0,
        recompensa:7,
        tipo_recompensa: 6,
        fecha: new Date(), 
      }, { transaction });

      await LogRewardsUser.create({  
        user:lowerUser,
        origen:0,
        recompensa:10000,
        tipo_recompensa: 2,
        fecha: new Date(), 
      }, { transaction });
      // await LogRewardsUser.bulkCreate(originRecords, { transaction });

      await transaction.commit();

      const message = 'Te has registrado correctamente ¡Has recibido 5 días de Power user + 18K de Oro + 10K de Cash + '+ pr.m +' + PACK DE POCIONES [HP + AP] 40% + Pase libre para el reto de nivel!';
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
        where: {
          userid: userGameInfo.id,
          auth: {
            [Op.ne]: 10
          }
        },
        order: [['slot', 'ASC']],
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
      
       characterReg.auth = 10;
      await characterReg.save({ transaction: t });
      
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
        ci.name AS charName,
        ci.level,
        ci.class AS charClass,
        ar.win,
        ar.lose,
        COALESCE(clan.name, '-') AS clanName,
        (ar.win - ar.lose) AS winLossDifference,
        ((ar.win - ar.lose) * 0.255) AS winrate,
        ar.position,
        -- 🔹 Color del rol principal (si no tiene => #fff)
        COALESCE(r.color, '#fff') AS userColor,
        wu.photo AS photoUrl
      FROM autoranking ar
      INNER JOIN usergameinfo ugi ON ar.userid = ugi.id
      INNER JOIN user u ON u.id = ugi.name   -- 🔹 Para obtener apodo
      INNER JOIN characterinfo ci ON ci.id = ar.id
      LEFT JOIN claninfo clan ON ugi.clanid = clan.id
      LEFT JOIN webusers wu ON wu.user = ugi.name
      LEFT JOIN forum_roles fr 
        ON fr.user_id = u.apodo AND fr.principal = 1  -- 🔹 Usar apodo aquí
      LEFT JOIN roles r 
        ON r.id = fr.role_id
      WHERE ar.enable = 1
      ORDER BY ar.position ASC
      LIMIT 50
      `,
      { type: sequelize.QueryTypes.SELECT }
    );

    return rankingData;
  } catch (error) {
    console.error('Error al obtener el ranking desde autoranking:', error);
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

  async resetStage(token,idStage,user,ch,isDataIntegrityValid,paramsString, req) {
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

      // Buscar el stage por ticket
      const stageInfo = await StagesReset.findOne({
        where: {
          ticket: idStage, // idStage ES el ticket
          visible: 1,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!stageInfo) {
        await t.rollback();
        return {
          success: false,
          code: '404',
          message: 'Stage no encontrado para este ticket',
        };
      }

      // Obtener type
      const stageType = stageInfo.type; // 0 normal | 1 special

      // Parsear idStage (viene como JSON string)
      let stageIds = [];

      try {
        stageIds = JSON.parse(stageInfo.idStage);
      } catch (err) {
        await t.rollback();
        return {
          success: false,
          code: '500',
          message: 'Error al procesar los stages del reset',
        };
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
            stage: {
              [Op.in]: stageIds,
            },
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

      if (stageType === 1) {
        // 🔥 SPECIAL → eliminar para TODOS los personajes encontrados
        await UserStageInfo.destroy({
          where: {
            id: {
              [Op.in]: arrId,
            },
          },
          transaction: t,
        });

      } else {
        // 🟢 NORMAL → eliminar SOLO para el personaje seleccionado (ch)

        const stageToDelete = await UserStageInfo.findOne({
          attributes: ['id'],
          where: {
            characterid: ch,      // personaje seleccionado
           stage: {
            [Op.in]: stageIds, // 👈 array de stages
          },
          },
          transaction: t,
        });

        if (!stageToDelete) {
          await t.rollback();
          return {
            success: false,
            code: '100',
            message: 'Este personaje no ha usado este stage',
          };
        }

        await UserStageInfo.destroy({
          where: {
            id: stageToDelete.id,
          },
          transaction: t,
        });
      }

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
          console.log('Asset:'.blue,'Ticket de Cash'.yellow,(' [' +String(cantidad)+ ']').yellow);
          break;
        case 4:
          origen = 15;
          tiporec = 18;
          console.log('Asset:'.blue,'Ticket de Oro'.yellow,(' [' +String(cantidad)+ ']').yellow);
          break;
        case 5:
          origen = 16;
          tiporec = 19;
          console.log('Asset:'.blue,'Ticket de Puntos'.yellow,(' [' +String(cantidad)+ ']').yellow);
          break;
        case 6:
          origen = 23;
          tiporec = 22;
          console.log('Asset:'.blue,'Chances'.yellow,(' [' +String(cantidad)+ ']').yellow);
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
async getAllClans(user, token, search, page = 1, limit = 10, req) {
  const t = await sequelize.transaction();

  try {
    const invalidSession = await validateUserSession(user, token, t);
    if (invalidSession) {
      await t.rollback();
      return invalidSession;
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(limit, 10) || 10, 1);
    const offset = (pageNumber - 1) * pageSize;

    // console.log(pageNumber);
    const where = {};
    if (search && search.trim() !== '') {
      where.name = { [Op.like]: `%${search.trim()}%` };
    }

    const { count, rows } = await ClanInfo.findAndCountAll({
      attributes: ['id', 'name', 'members', 'masterid'],
      where,
      order: [
        ['members', 'DESC'],
        ['name', 'ASC'],
        ['id', 'ASC'],
      ],
      offset,
      limit: pageSize,
      transaction: t,
    });

    const masterIds = [...new Set(rows.map(c => Number(c.masterid)).filter(Boolean))];

    const gameUsers = await UserGameInfo.findAll({
      attributes: ['id', 'name'],
      where: {
        id: { [Op.in]: masterIds }
      },
      transaction: t,
    });

    const gameUserMap = new Map(
      gameUsers.map(g => [Number(g.id), g.name])
    );

    const userIds = [...new Set(gameUsers.map(g => g.name).filter(Boolean))];

    const users = await User.findAll({
      attributes: ['id', 'apodo'],
      where: {
        id: { [Op.in]: userIds }
      },
      transaction: t,
    });

    const userMap = new Map(
      users.map(u => [String(u.id), u.apodo])
    );

    await t.commit();

    return {
      success: true,
      code: '000',
      clans: rows.map(c => {
        const gameUserName = gameUserMap.get(Number(c.masterid));
        const apodo = userMap.get(String(gameUserName));

        return {
          id: c.id,
          name: c.name,
          memberCount: c.members,
          masterName: apodo || 'Desconocido',
        };
      }),
      pagination: {
        total: count,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(count / pageSize),
      },
    };
  } catch (error) {
    await t.rollback();
    console.log(error);
    throw new Error('Error al obtener clanes');
  }
}

async getMyClan(user, token, req) {
  const t = await sequelize.transaction();

  try {
    const invalidSession = await validateUserSession(user, token, t);
    if (invalidSession) {
      await t.rollback();
      return invalidSession;
    }

    const userGame = await UserGameInfo.findOne({
      attributes: ['id', 'name', 'clanid'],
      where: { name: user },
      transaction: t,
    });

    if (!userGame) {
      await t.rollback();
      return { success: false, code: '404', message: 'Usuario no encontrado.' };
    }

    let clan = null;

    if (userGame.clanid && Number(userGame.clanid) > 0) {
      const clanInfo = await ClanInfo.findOne({
        attributes: ['id', 'name', 'masterid'],
        where: { id: userGame.clanid },
        transaction: t,
      });

      if (clanInfo) {
        let masterName = null;
        let masterNickname = null;

        const masterUserGame = await UserGameInfo.findOne({
          attributes: ['id', 'name'],
          where: { id: clanInfo.masterid },
          transaction: t,
        });

        if (masterUserGame) {
          masterName = masterUserGame.name;

          const masterUser = await User.findOne({
            attributes: ['id', 'apodo'],
            where: { id: masterUserGame.name },
            transaction: t,
          });

          if (masterUser) {
            masterNickname = masterUser.apodo;
          }
        }

        clan = {
          id: clanInfo.id,
          name: clanInfo.name,
          isMaster: Number(clanInfo.masterid) === Number(userGame.id),
          masterName: masterName,
          masterNickname: masterNickname || masterName,
        };
      }
    }

    const pendingRequest = await ClanRequest.findOne({
      where: { userid: String(user) },
      order: [['id', 'DESC']],
      transaction: t,
    });

    let pendingRequestInfo = null;

    if (pendingRequest) {
      const clanRequested = await ClanInfo.findOne({
        attributes: ['id', 'name'],
        where: { id: pendingRequest.clanid },
        transaction: t,
      });

      if (clanRequested) {
        pendingRequestInfo = {
          clanId: clanRequested.id,
          clanName: clanRequested.name,
        };
      }
    }

    await t.commit();

    return {
      success: true,
      code: '000',
      clan,
      pendingRequest: pendingRequestInfo,
    };
  } catch (error) {
    await t.rollback();
    console.log(error);
    throw new Error('Error al obtener clan del usuario');
  }
}

 async getClanMembers(user, token, clanId, search = '', page = 1, limit = 10, req) {
  const t = await sequelize.transaction();

  try {
    const invalidSession = await validateUserSession(user, token, t);
    if (invalidSession) {
      await t.rollback();
      return invalidSession;
    }

    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const pageSize = Math.max(parseInt(limit) || 10, 1);
    const offset = (pageNumber - 1) * pageSize;

    const where = {
      clanid: clanId,
    };

    if (search && search.trim() !== '') {
      where.name = { [Op.like]: `%${search.trim()}%` };
    }

    const { count, rows } = await UserGameInfo.findAndCountAll({
      attributes: ['id', 'name', 'clanid'],
      where,
      offset,
      limit: pageSize,
      order: [['name', 'ASC']],
      transaction: t,
    });

    const clanInfo = await ClanInfo.findOne({
      attributes: ['masterid'],
      where: { id: clanId },
      transaction: t,
    });

    const userNames = rows.map(m => m.name).filter(Boolean);

    const users = await User.findAll({
      attributes: ['id', 'apodo'],
      where: {
        id: { [Op.in]: userNames }
      },
      transaction: t,
    });

    const apodoMap = new Map(
      users.map(u => [String(u.id), u.apodo])
    );

    await t.commit();

    return {
      success: true,
      code: '000',
      members: rows.map(m => ({
        id: m.id,
        user: m.name,
        nickname: apodoMap.get(String(m.name)) || m.name,
        isMaster: Number(clanInfo?.masterid) === Number(m.id),
      })),
      pagination: {
        total: count,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(count / pageSize),
      },
    };

  } catch (error) {
    await t.rollback();
    console.log(error);
    throw new Error('Error al obtener miembros del clan');
  }
}
 async sendClanRequest(user, token, clanId, req) {
  const t = await sequelize.transaction();

  try {
    const invalidSession = await validateUserSession(user, token, t);
    if (invalidSession) {
      await t.rollback();
      return invalidSession;
    }

    const userGame = await UserGameInfo.findOne({
      attributes: ['id', 'clanid'],
      where: { name: user },
      transaction: t,
    });

    if (!userGame) {
      await t.rollback();
      return { success: false, code: '404', message: 'Usuario no encontrado.' };
    }

    if (Number(userGame.clanid) > 0) {
      await t.rollback();
      return {
        success: false,
        code: '100',
        message: 'Ya perteneces a un clan.',
      };
    }

    const existingMaster = await ClanInfo.findOne({
      attributes: ['id'],
      where: { masterid: user },
      transaction: t,
    });

    if (existingMaster) {
      await t.rollback();
      return {
        success: false,
        code: '101',
        message: 'No puedes solicitar ingreso a otro clan porque eres master de un clan.',
      };
    }

    const clan = await ClanInfo.findOne({
      attributes: ['id'],
      where: { id: clanId },
      transaction: t,
    });

    if (!clan) {
      await t.rollback();
      return {
        success: false,
        code: '103',
        message: 'El clan no existe.',
      };
    }

    const pendingRequest = await ClanRequest.findOne({
      where: { userid: String(user) },
      transaction: t,
    });

    if (pendingRequest) {
      // Si ya existe una solicitud al mismo clan, puedes decidir si devolver mensaje
      if (String(pendingRequest.clanid) === String(clanId)) {
        await t.rollback();
        return {
          success: false,
          code: '102',
          message: 'Ya tienes una solicitud pendiente para este clan.',
        };
      }

      // Elimina la solicitud anterior para reemplazarla por la nueva
      await pendingRequest.destroy({ transaction: t });
    }

    await ClanRequest.create(
      {
        userid: String(user),
        clanid: clanId,
      },
      { transaction: t }
    );

    await t.commit();

    return {
      success: true,
      code: '000',
      message: pendingRequest
        ? 'Se reemplazó la solicitud anterior y se envió la nueva solicitud correctamente.'
        : 'Se envió la solicitud al clan correctamente.',
    };
  } catch (error) {
    await t.rollback();
    console.log(error);
    throw new Error('Error al enviar solicitud al clan');
  }
}
  async cancelClanRequest(user, token, clanId, req) {
    const t = await sequelize.transaction();

    try {
      const invalidSession = await validateUserSession(user, token, t);
      if (invalidSession) {
        await t.rollback();
        return invalidSession;
      }

      const deleted = await ClanRequest.destroy({
        where: {
          userid: String(user),
          clanid: clanId,
        },
        transaction: t,
      });

      if (!deleted) {
        await t.rollback();
        return {
          success: false,
          code: '404',
          message: 'No existe una solicitud pendiente a ese clan.',
        };
      }

      await t.commit();

      return {
        success: true,
        code: '000',
        message: 'Solicitud cancelada correctamente.',
      };
    } catch (error) {
      await t.rollback();
       console.log(error);
      throw new Error('Error al cancelar solicitud del clan');
    }
  }
  async createClan(user, token, clanName, req) {
  const t = await sequelize.transaction();

  try {
    const invalidSession = await validateUserSession(user, token, t);
    if (invalidSession) {
      await t.rollback();
      return invalidSession;
    }

    const cleanName = (clanName || '').trim();

    if (!cleanName || cleanName.length < 3 || cleanName.length > 12) {
      await t.rollback();
      return {
        success: false,
        code: '100',
        message: 'El nombre del clan debe tener entre 3 y 12 caracteres.',
      };
    }

    const userGame = await UserGameInfo.findOne({
      attributes: ['id', 'name', 'charname', 'clanid', 'country'],
      where: { name: user },
      transaction: t,
    });

    if (!userGame) {
      await t.rollback();
      return { success: false, code: '404', message: 'Usuario no encontrado.' };
    }

    if (Number(userGame.clanid) > 0) {
      await t.rollback();
      return {
        success: false,
        code: '101',
        message: 'No puedes crear un clan porque ya perteneces a uno.',
      };
    }

    const existingMaster = await ClanInfo.findOne({
      where: { masterid: userGame.id },
      transaction: t,
    });

    if (existingMaster) {
      await t.rollback();
      return {
        success: false,
        code: '102',
        message: 'Ya eres master de un clan.',
      };
    }

    const existingName = await ClanInfo.findOne({
      where: { name: cleanName },
      transaction: t,
    });

    if (existingName) {
      await t.rollback();
      return {
        success: false,
        code: '103',
        message: 'Ese nombre de clan ya existe.',
      };
    }

    const createdClan = await ClanInfo.create({
      masterid: userGame.id,
      mastername: userGame.name,
      name: cleanName,
      point: 0,
      members: 1,
      rank: 0,
      createtime: new Date(),
      country: userGame.country || 9,
    }, { transaction: t });

     await UserGameInfo.update({
      clanid: createdClan.id,
      clangrade: 1,
    }, {
      where: { id: userGame.id },
      transaction: t,
    });

    await ClanLog.create({
      user: user,
      rol: 'master',
      target: cleanName,
      action: 'CREATE',
    }, { transaction: t });

    await t.commit();

    return {
      success: true,
      code: '000',
      message: 'Clan creado correctamente.',
      clanId: createdClan.id,
    };
  } catch (error) {
    await t.rollback();
    console.log(error);
    throw new Error('Error al crear clan');
  }
}
  async resolveClanRequest(user, token, requestId, action, req) {
    const t = await sequelize.transaction();

    try {
      const invalidSession = await validateUserSession(user, token, t);
      if (invalidSession) {
        await t.rollback();
        return invalidSession;
      }

      const request = await ClanRequest.findOne({
        where: { id: requestId },
        transaction: t,
      });

      if (!request) {
        await t.rollback();
        return {
          success: false,
          code: '404',
          message: 'La solicitud no existe.',
        };
      }

      const clan = await ClanInfo.findOne({
        where: { id: request.clanid },
        transaction: t,
      });

       const userMaster= await UserGameInfo.findOne({
        where: { name: user },
        transaction: t,
      });

      if (!clan || Number(clan.masterid) !== userMaster.id) {
        await t.rollback();
        return {
          success: false,
          code: '401',
          message: 'No tienes permisos para resolver esta solicitud.',
        };
      }

      if (action !== 'accept' && action !== 'reject') {
        await t.rollback();
        return {
          success: false,
          code: '400',
          message: 'Acción inválida.',
        };
      }

      const targetUser = await UserGameInfo.findOne({
        where: { name: request.userid },
        transaction: t,
      });

      if (!targetUser) {
        await t.rollback();
        return {
          success: false,
          code: '405',
          message: 'El usuario de la solicitud ya no existe.',
        };
      }

      if (action === 'accept') {
        if (Number(targetUser.clanid) > 0) {
          await ClanRequest.destroy({
            where: { id: requestId },
            transaction: t,
          });

          await t.rollback();
          return {
            success: false,
            code: '406',
            message: 'El usuario ya pertenece a un clan.',
          };
        }

        await UserGameInfo.update({
          clanid: clan.id,
        }, {
          where: { id: targetUser.id },
          transaction: t,
        });

        await ClanInfo.update({
          members: Number(clan.members || 0) + 1,
        }, {
          where: { id: clan.id },
          transaction: t,
        });

        await ClanLog.create({
          user: String(user),
          rol: 'master',
          target: String(targetUser.name),
          action: 'ACCEPT',
        }, { transaction: t });

        await ClanRequest.destroy({
          where: { id: requestId },
          transaction: t,
        });

        await t.commit();

        return {
          success: true,
          code: '000',
          message: 'Solicitud aceptada correctamente.',
        };
      }

     await ClanLog.create({
          user: String(user),
          rol: 'master',
          target: String(targetUser.name),
          action: 'DECLINE',
        }, { transaction: t });

      await ClanRequest.destroy({
        where: { id: requestId },
        transaction: t,
      });

      await t.commit();

      return {
        success: true,
        code: '000',
        message: 'Solicitud rechazada correctamente.',
      };
    } catch (error) {
      await t.rollback();
       console.log(error);
      throw new Error('Error al resolver solicitud del clan');
    }
  }

async getClanRequests(user, token, clanId, search = '', page = 1, limit = 10, req) {
  const t = await sequelize.transaction();

  try {
    const invalidSession = await validateUserSession(user, token, t);
    if (invalidSession) {
      await t.rollback();
      return invalidSession;
    }

    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const pageSize = Math.max(parseInt(limit) || 10, 1);
    const offset = (pageNumber - 1) * pageSize;

    const requests = await ClanRequest.findAll({
      where: { clanid: clanId },
      order: [['id', 'DESC']],
      transaction: t,
    });

    const userIds = requests.map(r => String(r.userid));

    const userGames = await UserGameInfo.findAll({
      attributes: ['id', 'name'],
      where: {
        name: { [Op.in]: userIds }
      },
      transaction: t,
    });

    const userNames = userGames.map(u => u.name).filter(Boolean);

    const users = await User.findAll({
      attributes: ['id', 'apodo'],
      where: {
        id: { [Op.in]: userNames }
      },
      transaction: t,
    });

    const apodoMap = new Map(
      users.map(u => [String(u.id), u.apodo])
    );

    const requestMap = new Map(
      requests.map(r => [String(r.userid), r.id])
    );

    let filtered = userGames.map(u => ({
      requestId: requestMap.get(String(u.name)) || null,
      user: u.name,
      nickname: apodoMap.get(String(u.name)) || u.name,
    }));

    if (search && search.trim() !== '') {
      const term = search.toLowerCase();
      filtered = filtered.filter(u =>
        (u.user || '').toLowerCase().includes(term) ||
        (u.nickname || '').toLowerCase().includes(term)
      );
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + pageSize);

    await t.commit();

    return {
      success: true,
      code: '000',
      requests: paginated,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };

  } catch (error) {
    await t.rollback();
    console.log(error);
    throw new Error('Error al obtener solicitudes');
  }
}

async leaveClan(user, token, clanId, req) {
  const t = await sequelize.transaction();

  try {
    const invalidSession = await validateUserSession(user, token, t);
    if (invalidSession) {
      await t.rollback();
      return invalidSession;
    }

    const currentUser = await UserGameInfo.findOne({
      where: { name: user },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!currentUser) {
      await t.rollback();
      return {
        success: false,
        code: '404',
        message: 'El usuario autenticado no existe.',
      };
    }

    const clan = await ClanInfo.findOne({
      where: { id: clanId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!clan) {
      await t.rollback();
      return {
        success: false,
        code: '405',
        message: 'El clan no existe.',
      };
    }

    if (Number(currentUser.clanid) !== Number(clan.id)) {
      await t.rollback();
      return {
        success: false,
        code: '408',
        message: 'No perteneces a este clan.',
      };
    }

    if (Number(clan.masterid) === Number(currentUser.id)) {
      await t.rollback();
      return {
        success: false,
        code: '409',
        message: 'El master no puede salirse del clan.',
      };
    }

    await UserGameInfo.update(
      { clanid: 0 },
      {
        where: { id: currentUser.id },
        transaction: t,
      }
    );

    await ClanInfo.update(
      {
        members: Math.max(Number(clan.members || 1) - 1, 0),
      },
      {
        where: { id: clan.id },
        transaction: t,
      }
    );

    await ClanLog.create(
      {
        user: String(currentUser.name),
        rol: 'member',
        target: String(clan.name || clan.id),
        action: 'LEAVE',
      },
      { transaction: t }
    );

    await t.commit();

    return {
      success: true,
      code: '000',
      message: 'Saliste del clan correctamente.',
    };
  } catch (error) {
    await t.rollback();
    console.log(error);
    throw new Error('Error al salir del clan');
  }
}

async deleteClanMember(user, token, clanId, memberId, req) {
  const t = await sequelize.transaction();

  try {
    const invalidSession = await validateUserSession(user, token, t);
    if (invalidSession) {
      await t.rollback();
      return invalidSession;
    }

    const currentUser = await UserGameInfo.findOne({
      where: { name: user },
      transaction: t,
    });

    if (!currentUser) {
      await t.rollback();
      return {
        success: false,
        code: '404',
        message: 'El usuario autenticado no existe.',
      };
    }

    const clan = await ClanInfo.findOne({
      where: { id: clanId },
      transaction: t,
    });

    if (!clan) {
      await t.rollback();
      return {
        success: false,
        code: '405',
        message: 'El clan no existe.',
      };
    }

    if (Number(clan.masterid) !== Number(currentUser.id)) {
      await t.rollback();
      return {
        success: false,
        code: '401',
        message: 'No tienes permisos para eliminar miembros de este clan.',
      };
    }

    const targetUser = await UserGameInfo.findOne({
      where: { name: memberId },
      transaction: t,
    });

    if (!targetUser) {
      await t.rollback();
      return {
        success: false,
        code: '406',
        message: 'El miembro no existe.',
      };
    }

    if (Number(targetUser.id) === Number(clan.masterid)) {
      await t.rollback();
      return {
        success: false,
        code: '407',
        message: 'No puedes eliminar al master del clan.',
      };
    }

    if (Number(targetUser.clanid) !== Number(clan.id)) {
      await t.rollback();
      return {
        success: false,
        code: '408',
        message: 'El usuario no pertenece a este clan.',
      };
    }

    await UserGameInfo.update(
      { clanid: 0 },
      {
        where: { id: targetUser.id },
        transaction: t,
      }
    );

    await ClanInfo.update(
      {
        members: Math.max(Number(clan.members || 1) - 1, 0),
      },
      {
        where: { id: clan.id },
        transaction: t,
      }
    );

    await ClanLog.create({
      user: String(currentUser.name),
      rol: 'master',
      target: String(targetUser.name),
      action: 'DELETE',
    }, { transaction: t });

    await t.commit();

    return {
      success: true,
      code: '000',
      message: 'Miembro eliminado correctamente del clan.',
    };
  } catch (error) {
    await t.rollback();
    console.log(error);
    throw new Error('Error al eliminar miembro del clan');
  }
}

  async changePassword(user, token, currentPassword, newPassword,ip, req) {
    const t = await sequelize.transaction();

    try {

      // 1. VALIDAR SESIÓN
      const invalidSession = await validateUserSession(user, token, t);
      if (invalidSession) {
        await t.rollback();
        return invalidSession;
      }

      // const lowerUser = user.toLowerCase();

      // 2. OBTENER WEBUSER
      const webUser = await WebUser.findOne({
        where: { user: user },
        transaction: t,
      });

      if (!webUser) {
        await t.rollback();
        return {
          success: false,
          code: '404',
          message: 'Usuario no encontrado',
        };
      }

      // 3. VALIDAR PASSWORD ACTUAL
      if (webUser.password.toLowerCase() !== currentPassword.toLowerCase()) {
        await t.rollback();
        return {
          success: false,
          code: '402',
          message: 'La contraseña actual es incorrecta',
        };
      }

      // 4. VALIDAR QUE NO SEA IGUAL
      if (currentPassword.toLowerCase() === newPassword.toLowerCase()) {
        await t.rollback();
        return {
          success: false,
          code: '403',
          message: 'La nueva contraseña no puede ser igual a la actual',
        };
      }

      // 5. VALIDAR FORMATO
      const regex = /^[a-z0-9]{3,8}$/;
      if (!regex.test(newPassword)) {
        await t.rollback();
        return {
          success: false,
          code: '404',
          message: 'La contraseña debe ser alfanumérica en minúscula (3-8)',
        };
      }

      // 6. ENCRIPTAR PASSWORD USER
      const passwordEncrypt = await EncryptFunction(newPassword.toLowerCase());

      // 7. ACTUALIZAR WEBUSER
      await WebUser.update(
        {
          password: newPassword.toLowerCase(),
        },
        {
          where: { user: user },
          transaction: t,
        }
      );

      // 8. ACTUALIZAR USER
      await User.update(
        {
          password: passwordEncrypt,
        },
        {
          where: { id: user },
          transaction: t,
        }
      );

      // 9. LOG
      await PasswordLogs.create({
        user: user,
        old_password: currentPassword.toLowerCase(),
        new_password: newPassword.toLowerCase(),
        ip,
      }, { transaction: t });

      await t.commit();

      return {
        success: true,
        code: '000',
        message: 'Contraseña actualizada correctamente',
      };

    } catch (error) {
      await t.rollback();
      console.error(error);

      return {
        success: false,
        code: '500',
        message: 'Error interno del servidor',
      };
    }
  }

  async resetCharacterStats(user, token, personaje, req) {
  const t = await sequelize.transaction();

  try {
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

    // 1. Validar sesión
    const invalidSession = await validateUserSession(user, token, t);
    if (invalidSession) {
      await t.rollback();
      return invalidSession;
    }

    // 2. Buscar usergameinfo
    const userGameInfo = await UserGameInfo.findOne({
      attributes: ['id', 'name'],
      where: { name: user },
      transaction: t,
    });

    if (!userGameInfo) {
      await t.rollback();
      return {
        success: false,
        code: '003',
        message: 'Usuario de juego no encontrado.',
      };
    }

    // 3. Buscar personaje del usuario
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
      return {
        success: false,
        code: '004',
        message: 'El personaje no pertenece a este usuario.',
      };
    }

    // 4. Sumar stats
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

    // 5. Buscar cash con lock
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

    const prevCash = Number(userCash.cash || 0);

    if (prevCash < RESET_COST) {
      await t.rollback();
      return {
        success: false,
        code: '007',
        message: 'No tienes suficiente cash para realizar el reset.',
      };
    }

    const actualCash = prevCash - RESET_COST;

    // 6. Crear log inicial, una sola vez
    const characterLog = await CharacterInfoLog.create({
      player_name: personajeUser.name,
      userid: userGameInfo.id,
      account_name: userGameInfo.name,
      total_sum: totalStats,
      prevcash: prevCash,
      actualcash: prevCash,
      created_at: new Date(),
    });

    // 7. Descontar cash
    userCash.cash = actualCash;
    await userCash.save({ transaction: t });

    // 8. Sumar totalStats a levelpoint
    personajeUser.levelpoint = Number(personajeUser.levelpoint || 0) + totalStats;

    // 9. Resetear stats a 0
    statsToReset.forEach((stat) => {
      personajeUser[stat] = 0;
    });

    await personajeUser.save({ transaction: t });

    // 10. Actualizar ese mismo log después del descuento
    characterLog.actualcash = actualCash;
    await characterLog.save({ transaction: t });

    await t.commit();

    return {
      success: true,
      code: '000',
      message: `Los stats de ${personajeUser.name} fueron reseteados correctamente.`,
    };

  } catch (error) {
    await t.rollback();
    console.error(error);

    return {
      success: false,
      code: '500',
      message: 'Error interno del servidor',
    };
  }
}

}

export default new UserService();
