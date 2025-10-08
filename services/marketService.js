
import { Sequelize,Op } from 'sequelize';
import sequelize from '../config/database.js';
import UserGameInfo from '../models/userGameInfoModel.js';
import Cash from '../models/cashModel.js';
import ItemInfo from '../models/itemInfoModel.js';
import TokenSession from '../models/tokenSessionModel.js';
import LogRewardsUser from '../models/logRewardUserModel.js';
import Marketplace from '../models/Trades/marketPlaceModel.js';
import UserItemInfo from '../models/userItemInfoModel.js';
import TempUserItemInfo from '../models/Trades/tempUserItemInfoModel.js';
import SellsRecord from '../models/Trades/sellsRecordModel.js';
import ItemImage from '../models/itemImagesModel.js';
import ConfigParameters from '../models/configParametersModel.js';
import User from '../models/userModel.js';
import { enviarMensajeACliente, obtenerClientesActivos } from '../socket/socketServer.mjs';
import CharacterInfo from '../models/characterInfo.js';
import { setClassName } from '../utils/prizesUtils.js';
import PaymentMethods from '../models/Trades/paymentMethodsModel.js';
import UserCredits from '../models/Trades/userCreditsModel.js';
import UserInternalHolds from '../models/Trades/userHoldsModel.js';
import TradeChats from '../models/Trades/tradeChatsModel.js';
import TradeMessage from '../models/Trades/tradeMessagesModel.js';

class MarketService {

    async buyItems(user,token,idmarket,retries = 1) {
        const t = await sequelize.transaction(); // Iniciar una transacción
        try {
            // Verificar token
            const sessionToken = await TokenSession.findOne({
                attributes: ['token'],
                where: { token: token, id: user },
                transaction: t,
            });
    
            if (!sessionToken) {
                await t.rollback();
                return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para comprar items.' };
            }

            // const res = await this.socketSend(user);

            // if(!res.success && res.code==='999'){
            //     await t.rollback(); 
            //     return res;
            // }

            // if(res.success && Number(res.obj.reason)===0 && user === res.obj.user){
            //     await t.rollback(); 
            //     console.log("[Error] Intenta comprar un item mientras esta jugando.".red);
            //     return { success: false, code: '200', message: 'No puedes comprar en el mercado mientras estes en el juego. Cierra sesión en el launcher.' };
            // }
    
            // Bloquear market place
            const item = await Marketplace.findOne({
                where: { id: idmarket },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
    
            if (!item) {
                await t.rollback();
                console.log('[Error] El market id del item no existe'.red);
                return { success: false, code: '200', message: 'El item no existe' };
            }

            // Obtener el apodo del usuario desde la tabla USER
            const userInfo = await User.findOne({
                where: { id: user },
                attributes: ['apodo'],
                transaction: t,
            });

            if (!userInfo) {
                await t.rollback();
                console.log('[Error] No se encontró el apodo del usuario'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'No se encontró el apodo del usuario',
                };
            }

            if (item.vendedor === userInfo.apodo) {
                await t.rollback();
                console.log('[Error] Está intentando autocomprar items'.red);
                return { success: false, code: '200', message: 'No puedes comprar tus propios items' };
            }

            if (item.estado === 0 || item.estado === 2){
                await t.rollback();
                console.log('[Error] El item ya no se encuentra disponible en la tienda'.red);
                return { success: false, code: '200', message: 'El item ya no se encuentra disponible. Actualiza la tienda.' };
            }

            const sellerInfo = await User.findOne({
                where: { apodo: item.vendedor },
                attributes: ['id'],
                transaction: t,
            });


            var uCoin;
            var sCoin;
            var coDis;
            var texCoin;

            // Obtener el ID del usuario desde UserGameInfo usando su name
             const userGame = await UserGameInfo.findOne({
                attributes: ['id'],
                where: {
                name: user, // Cambia esto para usar el nombre de usuario correcto
                },
                // transaction: t, // Asociar la transacción con esta consulta
            });
    
            if (!userGame) {
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[Error] Usuario no encontrado'.red);
                return { success: false, code: '200', message: 'ID de Usuario no encontrado' };
            }

            const userGameId = userGame.id;

            var flagC = 0;

            switch (item.medio_pago) {
                case 0: //cash
                     // Verificar puntos de evento del usuario con bloqueo
                     // Sumar "price" en logbuycashitem
                    const [sumCashItemResult] = await sequelize.query(
                        `SELECT COALESCE(SUM(price), 0) AS total FROM logbuycashitem WHERE userid = ${userGameId}`,
                        { type: sequelize.QueryTypes.SELECT, transaction: t }
                    );


                    // Sumar "buycash" en logbuypoweruser
                    const [sumPowerUserResult] = await sequelize.query(
                        `SELECT COALESCE(SUM(buycash), 0) AS total FROM logbuypoweruser WHERE userid = ${userGameId}`,
                        { type: sequelize.QueryTypes.SELECT, transaction: t }
                    );
                    const totalCashSpent = sumCashItemResult.total + sumPowerUserResult.total;

                    uCoin = await Cash.findOne({
                        where: {id:user},
                        transaction: t,
                        lock: t.LOCK.UPDATE,
                    });

                    sCoin = await Cash.findOne({
                        where: {id:sellerInfo.id},
                        transaction: t,
                        lock: t.LOCK.UPDATE,
                    });

                    if(totalCashSpent > 10000){
                         coDis = uCoin.cash;
                    } else {
                         coDis = uCoin.cash - (10000 - totalCashSpent);
                         flagC = 1;
                    }

                    texCoin='Cash';
                    break;
                case 1: //oro

                
                    // Sumar "gold" en loguseritem
                    const [sumGoldResult] = await sequelize.query(
                        `SELECT COALESCE(SUM(gold), 0) AS total FROM loguseritem WHERE userid = ${userGameId}`,
                        { type: sequelize.QueryTypes.SELECT, transaction: t }
                    );

                    //const totalCashSpent = sumCashItemResult.total + sumPowerUserResult.total;
                    const totalGoldSpent = sumGoldResult.total;

                    uCoin = await UserGameInfo.findOne({
                        where: {name:user},
                        transaction: t,
                        lock: t.LOCK.UPDATE,
                    });
                    sCoin = await UserGameInfo.findOne({
                        where: {name:sellerInfo.id},
                        transaction: t,
                        lock: t.LOCK.UPDATE,
                    });

                    if(totalGoldSpent > 12000){
                        coDis = uCoin.gold;
                    } else {
                        coDis = uCoin.gold - (12000 - totalGoldSpent);
                        flagC = 1;
                    }
                    // coDis = uCoin.gold;
                    texCoin='Oro';
                    break;
                default:
                    await t.rollback();
                    console.log('[Error] Medio de pago no disponible'.red);
                    return { success: false, code: '200', message: 'Medio de pago no disponible' };
                    break;
            }
    
            const totalCost = item.precio;
            if (!uCoin || coDis < totalCost) {
                await t.rollback();
                //console.log('[Error] No tiene cash u oro disponible para realizar la compra'.red);
                if(flagC){
                    console.log('[Error] No tiene cash u oro disponible para realizar la compra. Aún no gasta lo obtenido en registro...'.red);
                    return { success: false, code: '200', message: 'No tienes suficiente '+texCoin+' para realizar esta compra (No puedes usar el '+texCoin+ ' obtenido en el registro).' };
                }
                console.log('[Error] No tiene cash u oro disponible para realizar la compra'.red);
                return { success: false, code: '200', message: 'No tienes suficiente '+texCoin+' para realizar esta compra' };
            }

            

            // Verificar si tiene slots disponibles... 3 boxes 30 items

             // Paso 1: Obtener todos los personajes del usuario
            const characters = await CharacterInfo.findAll({
                where: {
                    userid: userGame.id,
                },
                transaction: t,
            });

            // Paso 2: Validar si tiene personajes
            if (!characters || characters.length === 0) {
                await t.rollback();
                console.log('[Error] No tiene personajes'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'Debes tener personajes con nivel superior a 33 para comprar en el mercado',
                };
            }

            // Paso 3: Verificar si alguno tiene nivel >= 20
            const hasLevel20OrMore = characters.some(char => char.level >= 33);

            if (!hasLevel20OrMore) {
                await t.rollback();
                console.log('[Error] Ningún personaje con nivel suficiente'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'Debes tener personajes con nivel superior a 33 para comprar en el mercado',
                };
            }
            
            //Obtener el nro de slot mas cercano disponible
            // Obtener todos los slots distintos del usuario
            const distinctSlots = await UserItemInfo.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('slot')), 'slot']],
                where: {
                userid: userGame.id,
                characterid:0,
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
                console.log('[Error] No tiene slots disponibles en su inventario'.red);
                return { success: false, code: '200', message: 'No tiene slots disponbiles en tu inventario para comprar este item' };
            }

            // Decrementar... :)

            if(item.medio_pago === 0) {
                uCoin.cash -= totalCost;
                await uCoin.save({ transaction: t });

                sCoin.cash += totalCost;
                await sCoin.save({ transaction: t });
            } else {
                uCoin.gold -= totalCost;
                await uCoin.save({ transaction: t });

                sCoin.gold += totalCost;
                await sCoin.save({ transaction: t });
            }

            // Obtener info del item con item.itemid
            const itemUserSeller = await TempUserItemInfo.findOne({
                where: { id: item.itemid },
                transaction: t,
            });

            // Obtener nombre del item desde ItemInfo
            const itemInfo = await ItemInfo.findOne({
                where: { id: itemUserSeller.itemid },
                transaction: t,
            });
    
            let itemName = itemInfo ? itemInfo.name : item.itemid;
    
            // Añadir el item a useriteminfo :)
            const newItem = await UserItemInfo.create({
                userid: userGame.id,           // ID del usuario que te proporcionarán
                characterid: 0,
                itemid: itemUserSeller.itemid,
                item_sn: itemUserSeller.item_sn,
                sn_type: itemUserSeller.sn_type,
                level: itemUserSeller.level,
                limittime: itemUserSeller.limittime,
                slot: slotFree,               // Slot que te proporcionarán
                exp: itemUserSeller.exp,
            }, {
                transaction: t, // Asociar la transacción con la inserción
            });

            await LogRewardsUser.create({  
                user:user,
                origen:9,
                recompensa:itemUserSeller.itemid,
                tipo_recompensa: 0,
                fecha: new Date(), 
              }, { transaction:t });
    
            // Registrar la compra en sellsRecord
            await SellsRecord.create({
                id_market: idmarket,
                buyer: userInfo.apodo,
                date: new Date(),
            }, { transaction: t });

            // Eliminar item de temp useriteminfo:
    
            // await TempUserItemInfo.destroy({
            //     where: {
            //       marketid: idmarket
            //     },
            //     transaction: t // Asociar la transacción con esta operación
            // });

            // Actualizar estado a 0 (vendido)
            item.estado = 0;
            await item.save({ transaction: t });

            await t.commit();
            const itms = await this.getItems();
            console.log('[Success] Compra exitosa'.green);
            return { success: true, code: '000', message: `Has comprado un(a) ${itemName} y será enviado a tu inventario`, _mp: itms._mp };
    
        } catch (error) {
            await t.rollback();
            console.error('Error al comprar items:', error);
    
            if (error.original && error.original.code === 'ER_LOCK_WAIT_TIMEOUT' && retries > 0) {
                // Reintentar la transacción
                console.log('Reintentando transacción...');
                return await this.buyItems(user, token, idstore, amount, retries - 1);
            }
    
            throw new Error('Error interno del servidor');
        }
    }

    async returnItem(user,token,idmarket,retries = 1) {
        const t = await sequelize.transaction(); // Iniciar una transacción
        try {

            return { success: false, code: '999', message: 'Not available' };

            // Verificar token
            const sessionToken = await TokenSession.findOne({
                attributes: ['token'],
                where: { token: token, id: user },
                transaction: t,
            });
    
            if (!sessionToken) {
                await t.rollback();
                return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para comprar items.' };
            }

            // const res = await this.socketSend(user);

            // if(!res.success && res.code==='999'){
            //     await t.rollback(); 
            //     return res;
            // }

            // if(res.success && Number(res.obj.reason)===0 && user === res.obj.user){
            //     await t.rollback(); 
            //     console.log("[Error] Intenta solicitar devolución de un item mientras esta jugando.".red);
            //     return { success: false, code: '200', message: 'No puedes solicitar un retorno de item mientras estes en el juego. Cierra sesión en el launcher.' };
            // }
    
            // Bloquear market place
            const item = await Marketplace.findOne({
                where: { id: idmarket },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
    
            if (!item) {
                await t.rollback();
                console.log('[Error] El market id del item no existe'.red);
                return { success: false, code: '200', message: 'El item no existe' };
            }

            // Obtener el apodo del usuario desde la tabla USER
            const userInfo = await User.findOne({
                where: { id: user },
                attributes: ['apodo'],
                transaction: t,
            });

            if (!userInfo) {
                await t.rollback();
                console.log('[Error] No se encontró el apodo del usuario'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'No se encontró el apodo del usuario',
                };
            }

            if (item.vendedor !== userInfo.apodo) {
                await t.rollback();
                console.log('[Error] Está intentando retornar item que no es de su propiedad'.red);
                return { success: false, code: '200', message: 'No puedes retornar un item que no te pertenece' };
            }

            if (item.estado === 0){
                await t.rollback();
                console.log('[Error] El item ya fue fue vendido'.red);
                return { success: false, code: '200', message: 'El item ya ha sido comprado por alguien. Actualiza la tienda.' };
            }

            if (item.estado === 2){
                await t.rollback();
                console.log('[Error] El item ha sido retornado anteriormente'.red);
                return { success: false, code: '200', message: 'El item no se encuentra disponible porque ya se retornó. Actualiza la tienda.' };
            }

            // Verificar si tiene slots disponibles... 3 boxes 30 items
             // Obtener el ID de usuario desde UserGameInfo por su nombre
             const userGame = await UserGameInfo.findOne({
                attributes: ['id'],
                where: {
                name: user, // Cambia esto para usar el nombre de usuario correcto
                },
                // transaction: t, // Asociar la transacción con esta consulta
            });
    
            if (!userGame) {
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[Error] Usuario no encontrado'.red);
                return { success: false, code: '200', message: 'ID de Usuario no encontrado' };
            }
            
            //Obtener el nro de slot mas cercano disponible
            // Obtener todos los slots distintos del usuario
            const distinctSlots = await UserItemInfo.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('slot')), 'slot']],
                where: {
                userid: userGame.id,
                characterid:0,
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
                console.log('[Error] No tiene slots disponibles en su inventario para el retorno'.red);
                return { success: false, code: '200', message: 'No tiene slots disponbiles en tu inventario para retornar este item' };
            }

            // Obtener info del item con item.itemid
            const itemUserSeller = await TempUserItemInfo.findOne({
                where: { id: item.itemid },
                transaction: t,
            });

            // Obtener nombre del item desde ItemInfo
            const itemInfo = await ItemInfo.findOne({
                where: { id: itemUserSeller.itemid },
                transaction: t,
            });
    
            let itemName = itemInfo ? itemInfo.name : item.itemid;
    
            // Añadir el item a useriteminfo :)
            const newItem = await UserItemInfo.create({
                userid: userGame.id,           // ID del usuario que te proporcionarán
                characterid: 0,
                itemid: itemUserSeller.itemid,
                item_sn: itemUserSeller.item_sn,
                sn_type: itemUserSeller.sn_type,
                level: itemUserSeller.level,
                limittime: itemUserSeller.limittime,
                slot: slotFree,               // Slot que te proporcionarán
                exp: itemUserSeller.exp,
            }, {
                transaction: t, // Asociar la transacción con la inserción
            });

            await LogRewardsUser.create({  
                user:user,
                origen:14,
                recompensa:itemUserSeller.itemid,
                tipo_recompensa: 0,
                fecha: new Date(), 
              }, { transaction:t });

            // Eliminar item de temp useriteminfo:
    
            // await TempUserItemInfo.destroy({
            //     where: {
            //       marketid: idmarket
            //     },
            //     transaction: t // Asociar la transacción con esta operación
            // });

            // Actualizar estado a 0 (vendido)
            item.estado = 2;
            await item.save({ transaction: t });

            await t.commit();
            const itms = await this.getItems();
            console.log('[Success] Retono exitoso'.green);
            return { success: true, code: '000', message: `Se te ha retornado un(a) ${itemName} y será enviado a tu inventario`, _mp: itms._mp };
    
        } catch (error) {
            await t.rollback();
            console.error('Error al comprar items:', error);
    
            if (error.original && error.original.code === 'ER_LOCK_WAIT_TIMEOUT' && retries > 0) {
                // Reintentar la transacción
                console.log('Reintentando transacción...');
                return await this.buyItems(user, token, idstore, amount, retries - 1);
            }
    
            throw new Error('Error interno del servidor');
        }
    }


   async initChatTrade(user, token, idmarket) {
  const t = await sequelize.transaction();
  try {
    // 1) validar token-session (lock)
    const session = await TokenSession.findOne({
      where: { token, id: user }, // según tu esquema
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!session) {
      await t.rollback();
      return { success: false, code: '403', message: 'Token inválido o expirado.' };
    }

    // 2) obtener item marketplace (lock)
    const item = await Marketplace.findOne({
      where: { id: idmarket },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!item) {
      await t.rollback();
      return { success: false, code: '404', message: 'El ítem no existe.' };
    }

    // 3) comprobar estado disponible (1)
    if (Number(item.estado) !== 1) {
      await t.rollback();
      return { success: false, code: '409', message: 'El ítem no está disponible para trade.' };
    }

    // 4) evitar iniciar sobre tu propio item
    if (String(item.vendedor) === String(user)) {
      await t.rollback();
      return { success: false, code: '409', message: 'No puedes iniciar chat sobre tu propio item.' };
    }

    // 5) obtener metodo de pago (lock)
    const method = await PaymentMethods.findOne({
      where: { id: item.medio_pago, active: true },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!method) {
      await t.rollback();
      return { success: false, code: '403', message: 'Método de pago no válido o inactivo.' };
    }

    // 6) comprobar si hay un chat ACTIVO para este item
    const activeChat = await TradeChats.findOne({
      where: { trade_id: idmarket, status: 'ACTIVE' },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (activeChat) {
      await t.rollback();
      return { success: false, code: '409', message: 'Ya existe un chat activo para este ítem.' };
    }

    // DEFINICIONES: ids para internos
    const PM_ID_ORO = 1;
    const PM_ID_PUNTOS = 2;
    const price = Number(item.precio || 0);

    // --------- Si es INTERNAL: verificar saldo, descontar y crear retención ANTES de crear chat ----------
    if (method.type === 'INTERNAL') {
        const userGame = await UserGameInfo.findOne({
          where: { name: user },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

      if (method.id === PM_ID_ORO) {
        // ORO: revisar UserGameInfo.gold por name = user
        if (!userGame || Number(userGame.gold) < price) {
          await t.rollback();
          return { success: false, code: '402', message: 'No tienes suficiente Oro.' };
        }
        // Descontar oro
        userGame.gold = Number(userGame.gold) - price;
        await userGame.save({ transaction: t });

      } else if (method.id === PM_ID_PUNTOS) {
        // PUNTOS: revisar Cash.cash por id = user (según tu esquema)
        if (!userGame || Number(userGame.clanpoint) < price) {
          await t.rollback();
          return { success: false, code: '402', message: 'No tienes suficientes Puntos de evento.' };
        }
        // Descontar puntos
        userGame.clanpoint = Number(userGame.clanpoint) - price;
        await userGame.save({ transaction: t });

      } else {
        await t.rollback();
        return { success: false, code: '403', message: 'Método interno no soportado.' };
      }

      // Registrar retención (antes de crear el chat, como pediste)
      await UserInternalHolds.create({
        user,
        trade_id: idmarket,
        method_id: method.id,
        amount: price,
        status: 'HELD',
        created_at: new Date()
      }, { transaction: t });
    }

    // --------- Crear chat (si no hay chat activo) ----------
    const chat = await TradeChats.create({
      trade_id: idmarket,
      buyer: user,
      seller: item.vendedor,
      payment_method_id: method.id,
      status: 'ACTIVE',
      created_at: new Date()
    }, { transaction: t });

    // --------- Mensajes SYSTEM iniciales (con visible_to: BOTH / SELLER / BUYER) ----------
    // Para INTERNAL: mostramos retención al BOTH y damos instrucciones al VENDEDOR (SELLER)
    if (method.type === 'INTERNAL') {
      const label = method.id === PM_ID_ORO ? 'Oro' : 'Puntos de evento';

      await TradeMessage.create({
        chat_id: chat.id,
        sender: null,
        message: `Se han retenido ${price} ${label} del comprador.`,
        message_type: 'SYSTEM',
        content_type: 'TEXT',
        visible_to: 'BOTH',
        created_at: new Date()
      }, { transaction: t });

      await TradeMessage.create({
        chat_id: chat.id,
        sender: null,
        message: `Libera el ítem cuando corresponda para completar el trade.`,
        message_type: 'SYSTEM',
        content_type: 'TEXT',
        visible_to: 'SELLER',
        created_at: new Date()
      }, { transaction: t });

      // También es útil dejar una nota para el comprador (BUYER) sobre cómo proceder
      await TradeMessage.create({
        chat_id: chat.id,
        sender: null,
        message: `El monto ha sido retenido. Espera a que el vendedor libere el ítem.`,
        message_type: 'SYSTEM',
        content_type: 'TEXT',
        visible_to: 'BUYER',
        created_at: new Date()
      }, { transaction: t });

    } else {
      // EXTERNAL: mensaje instructivo para ambos y uno para vendedor
      await TradeMessage.create({
        chat_id: chat.id,
        sender: null,
        message: `Confirma el pago cuando lo realices.`,
        message_type: 'SYSTEM',
        content_type: 'TEXT',
        visible_to: 'BOTH',
        created_at: new Date()
      }, { transaction: t });

      await TradeMessage.create({
        chat_id: chat.id,
        sender: null,
        message: `Espera la confirmación del comprador. Cuando el comprador marque "Pago realizado", podrás liberar el ítem.`,
        message_type: 'SYSTEM',
        content_type: 'TEXT',
        visible_to: 'SELLER',
        created_at: new Date()
      }, { transaction: t });
    }

    // --------- Marcar marketplace en proceso (estado = 3) ----------
    await Marketplace.update({ estado: 3 }, { where: { id: idmarket }, transaction: t });

    // Commit
    await t.commit();

    // Notificar por socket a vendedor y comprador (afuera de la transacción)
    const payload = {
      type: 'TRADE_CHAT_INIT',
      chat: {
        id: chat.id,
        trade_id: idmarket,
        buyer: user,
        seller: item.vendedor,
        method: { id: method.id, name: method.name, icon: method.icon, color: method.color, type: method.type },
        status: chat.status
      },
    };

    try {
      // notifica vendedor
      await enviarMensajeACliente(item.vendedor, payload);
    } catch (e) { console.error('Socket vendedor:', e); }

    try {
      // notifica comprador (opcional pero consistente)
      await enviarMensajeACliente(user, payload);
    } catch (e) { console.error('Socket comprador:', e); }

    return {
      success: true,
      code: '000',
      message: 'Chat inicializado correctamente.',
      chat: payload.chat
    };

  } catch (error) {
    try { await t.rollback(); } catch(_) {}
    console.error('Error en initChatTrade:', error);
    return { success: false, code: '500', message: 'Error interno del servidor.' };
  }
}

    async sellItem(user,token,id,price,currency) {
        const t = await sequelize.transaction(); // Iniciar una transacción
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
                return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para tradear.' };
            }

            // const res = await this.socketSend(user);

            // if(!res.success && res.code==='999'){
            //     await t.rollback(); 
            //     return res;
            // }

            // if(res.success && Number(res.obj.reason)===0 && user === res.obj.user){
            //     await t.rollback(); 
            //     console.log("[Error] Intenta vender un item mientras esta jugando.".red);
            //     return { success: false, code: '200', message: 'No puedes vender en el mercado mientras estes en el juego. Cierra sesión en el launcher.' };
            // }

             // Buscar el item por ID en UserItemInfo con bloqueo
            const userItem = await UserItemInfo.findOne({
                where: { id: id },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (!userItem) {
                await t.rollback();
                console.log('[Error] El item no existe o ya lo has vendido'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'El item no existe o ya lo has publicado en trades',
                };
            }

            if (userItem && userItem.characterid!==0) {
               await t.rollback(); // Revertir la transacción en caso de error
                console.log('[INFO]'.blue,'El item está en un personaje'.blue);
                return { success: false, code: '200', message: 'Tu item está en un personaje, devuelvelo al inventario para poder tradearlo.' };
            }

            const itmprb = await ConfigParameters.findOne({
                where: {
                name: 'market_banned'
                },
                transaction: t,
                lock: t.LOCK.UPDATE
            });

            const itemProhibido = JSON.parse(itmprb.value);

            if (itemProhibido.includes(userItem.itemid)) {
                await t.rollback();
                console.log(`[Error] El item está prohibido para la venta (itemid: ${userItem?.itemid})`.red);
                return {
                    success: false,
                    code: '200',
                    message: 'Este item no puede ser comercializado.',
                };
            }


            // Obtener el ID del usuario desde UserGameInfo
            const userGame = await UserGameInfo.findOne({
                attributes: ['id'],
                where: {
                    name: user,
                },
                transaction: t,
            });

            if (!userGame) {
                await t.rollback();
                console.log('[Error] Usuario no encontrado'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'ID de Usuario no encontrado',
                };
            }

            // Paso 1: Obtener todos los personajes del usuario
            const characters = await CharacterInfo.findAll({
                where: {
                    userid: userGame.id,
                },
                transaction: t,
            });

            // Paso 2: Validar si tiene personajes
            if (!characters || characters.length === 0) {
                await t.rollback();
                console.log('[Error] No tiene personajes'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'Debes tener personajes con nivel superior a 35 para publicar tu item en trades',
                };
            }

            // Paso 3: Verificar si alguno tiene nivel >= 20
            const hasLevel20OrMore = characters.some(char => char.level >= 35);

            if (!hasLevel20OrMore) {
                await t.rollback();
                console.log('[Error] Ningún personaje con nivel suficiente'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'Debes tener personajes con nivel superior a 35 para publicar tu item en trades',
                };
            }

            // Verificar que el item realmente le pertenezca al usuario
            if (userItem.userid !== userGame.id) {
                await t.rollback();
                console.log('[Error] El item no pertenece al usuario'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'Este item no te pertenece',
                };
            }

            // Aquí continuarías con el proceso de venta (registro en marketplace, moverlo a otra tabla, etc.)

            // 4. Verificar si el usuario tiene créditos disponibles
            const userCredits = await UserCredits.findOne({
                where: { user: user },
                transaction: t,
                lock: t.LOCK.UPDATE, // Evita race conditions
            });

            if (!userCredits || userCredits.credits <= 0) {
                await t.rollback();
                console.log('[Error] No tiene créditos suficientes para publicar en trades'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'No tienes créditos disponibles para publicar tu item en trades.',
                };
            }
                
            userCredits.credits -= 1;
            await userCredits.save({ transaction: t });

            // Obtener el apodo del usuario desde la tabla USER
            const userInfo = await User.findOne({
                where: { id: user },
                attributes: ['apodo'],
                transaction: t,
            });

            if (!userInfo) {
                await t.rollback();
                console.log('[Error] No se encontró el apodo del usuario'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'No se encontró el apodo del usuario',
                };
            }

            const nickname = userInfo.apodo;
         

            // 1. Insertar en TempUserItemInfo con el id del marketplace
            const temp = await TempUserItemInfo.create({
                userid: userItem.userid,
                characterid: userItem.userid, // Modifica si es necesario
                itemid: userItem.itemid,
                item_sn: userItem.item_sn || 8000,
                sn_type: 3, // O el valor que corresponda
                level: userItem.level || 0,
                limittime: userItem.limittime || 0,
                slot: userItem.slot || 0,
                exp: userItem.exp,
                // marketid: 0, // IMPORTANTE: asegúrate de que tu tabla temp tenga este campo
            }, { transaction: t });

            // 2. Insertar en la tabla marketplace
            const market = await Marketplace.create({
                itemid: temp.id,
                vendedor: nickname,
                precio: price,
                medio_pago: currency,
                fecha: new Date(), // Fecha actual
            }, { transaction: t });

            // 3. Eliminar el ítem original
            await UserItemInfo.destroy({
                where: { id: userItem.id },
                transaction: t
            });

            await t.commit(); // Confirmar la transacción
            console.log('[Success] Venta exitosa'.green);
            return { success: true, code: '000',message:'Vendiste tu item correctamente.'};
        } catch (error) {
            await t.rollback();
            console.error('Error al vender item:', error);
            throw new Error('Error interno del servidor');
        }
    }

    async socketSend(user){
          try {
              const objectSend = {
                'user':user,
                'type':4,
              };

              /*PRUEBA*/
            //   console.log("[Object Send] ".green, objectSend);
            //   const objectReceived = {
            //     'user': user,
            //     'reason':1,
            //   }
            //   console.log("[Object Received] ".magenta, objectReceived);

            //   return {success:true, obj:objectReceived};
             /*END*/

              const activos = obtenerClientesActivos();
              // console.log("[Servidor] Clientes activos:", activos);
      
              let res;
      
              if (activos.length > 0) {
                  // enviarMensajeACliente(activos[0], mssg);
                  try {
                    // Espera la respuesta de la promesa
                    res = await enviarMensajeACliente(activos[0], objectSend);
                    // console.log("Respuesta recibida:", res);
                    // Aquí puedes utilizar la variable 'res' que contiene la respuesta
                    // return res; // O hacer lo que necesites con ella
                    if(res.code && res.code==='999'){
                        return res;
                    }
                  } catch (error) {
                    console.error("Error al enviar mensaje:", error);
                    return {
                      success: false,
                      code: '999',
                      message: 'El servidor no puede realizar la comprobación para el mercado. Contacta con el administrador.'
                    };
                    // Maneja el error o lanza una excepción
                  }
              } else {
                  console.log("!![Server] No hay clientes activos para enviar mensajes.".red);
                  // console.log("!![Server]".blue,' No se pudo enviar el mensaje porque no hay clientes activos.'.blue);
                  return {
                    success: false,
                    code: '999',
                    message: 'Servidor inactivo, no se puede realizar la comprobación para el mercado. Contacta con el administrador.'
                  };
              }
      
            const response = JSON.parse(res);
            console.log("[Object Received] ".magenta, response);
            return {success:true,obj:response};
          } catch (errorObj) {
            console.error("Error al enviar mensaje:", errorObj);
            // return errorObj;  // Devuelves el error estándar que tú mismo preparaste
            console.log("!![Server] El servidor no puede realizar la comprobación para el mercado.".red);
            if(errorObj.code && errorObj.code==='999'){
                return errorObj;
            } else{
                return {
                    success: false,
                    code: '999',
                    message: 'El servidor no puede realizar la comprobación para el mercado. Contacta con el administrador.'
                  };
            }

        }
        }

    async getHistoryPucharse(user,token) {
        const t = await sequelize.transaction(); // Iniciar una transacción
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
                return { success: false, code: '200', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para jugar' };
            }

            // 2. Buscar apodo (nickname)
            const userRecord = await User.findOne({
                attributes: ['apodo'],
                where: { id: user },
                transaction: t,
            });

            if (!userRecord) {
                await t.rollback();
                return { success: false, code: '201', message: 'Usuario no encontrado.' };
            }

            const nickname = userRecord.apodo;

            // 3. Buscar compras en SellsRecords
            const sellRecords = await SellsRecord.findAll({
                where: { buyer: nickname },
                order: [['date', 'DESC']],
                transaction: t,
            });


            const purchaseDetails = [];

            for (const record of sellRecords) {
            // 4. Buscar Marketplace por id_market
            const marketRecord = await Marketplace.findOne({
                where: { id: record.id_market },
                transaction: t,
            });

            if (!marketRecord) continue; // Saltar si no se encuentra

            // 5. Buscar TempUserItemInfo por itemid de Marketplace
            const tempUserItemInfo = await TempUserItemInfo.findOne({
                where: { id: marketRecord.itemid },
                transaction: t,
            });

            if (!tempUserItemInfo) continue;

            // 7. Buscar ItemInfo por itemid de TempUserItemInfo
            const itemInfo = await ItemInfo.findOne({
                where: { id: tempUserItemInfo.itemid },
                transaction: t,
            });

            if (!itemInfo) continue;

             const fullName = itemInfo.name + setClassName(itemInfo.Class);

            // 8. Buscar imagen en ItemImages
            const itemImage = await ItemImage.findOne({
                where: { item: tempUserItemInfo.itemid },
                transaction: t,
            });

            purchaseDetails.push({
                name: fullName,
                image: itemImage ? itemImage.image : null,
                seller: marketRecord.vendedor,
                date: record.date,
                currency:marketRecord.medio_pago,
                price:marketRecord.precio,
            });
            }

            await t.commit(); // Confirmar la transacción
            return { success: false, code: '000', _ib:purchaseDetails };
        } catch (error) {
            await t.rollback();
            console.error('Error al obtener historial de compra:', error);
            throw new Error('Error interno del servidor');
        }
    }

    async getHistorySells(user,token) {
        const t = await sequelize.transaction(); // Iniciar una transacción
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
                return { success: false, code: '200', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para jugar' };
            }

            // 2. Buscar apodo (nickname)
            const userRecord = await User.findOne({
                attributes: ['apodo'],
                where: { id: user },
                transaction: t,
            });

            if (!userRecord) {
                await t.rollback();
                return { success: false, code: '201', message: 'Usuario no encontrado.' };
            }

            const nickname = userRecord.apodo;

          // 3. Buscar en Marketplace ventas realizadas por el usuario
            const sales = await Marketplace.findAll({
                where: {
                vendedor: nickname,
                estado: 0, // Vendido
                },
                transaction: t,
            });
        
            const sellsDetails = [];

            for (const sale of sales) {
                // Buscar TempUserItemInfo
                const tempUserItemInfo = await TempUserItemInfo.findOne({
                  where: { id: sale.itemid },
                  transaction: t,
                });
          
                if (!tempUserItemInfo) continue;
          
                // Buscar ItemInfo
                const itemInfo = await ItemInfo.findOne({
                  where: { id: tempUserItemInfo.itemid },
                  transaction: t,
                });
          
                if (!itemInfo) continue;

                const fullName = itemInfo.name + setClassName(itemInfo.Class);
          
                // Buscar imagen en ItemImage
                const itemImage = await ItemImage.findOne({
                  where: { item: tempUserItemInfo.itemid },
                  transaction: t,
                });
          
                // Buscar comprador y fecha en SellsRecord
                const sellRecord = await SellsRecord.findOne({
                  where: { id_market: sale.id },
                  transaction: t,
                });
          
                if (!sellRecord) continue;
          
                sellsDetails.push({
                  name: fullName,
                  image: itemImage ? itemImage.image : null,
                  buyer: sellRecord.buyer,
                  currency:sale.medio_pago,
                  price:sale.precio,
                  date: sellRecord.date,
                });
              }

            await t.commit(); // Confirmar la transacción
            return { success: false, code: '000', _is:sellsDetails };
        } catch (error) {
            await t.rollback();
            console.error('Error al obtener historial de ventas:', error);
            throw new Error('Error interno del servidor');
        }
    }

    async getItems() {
        try {
            const items = await Marketplace.findAll({
                where:{
                    estado:1,
                },
                order: [['fecha', 'DESC']],
            });

            // Obtener todos los itemIds de Market
            const itemIds = items.map(item => item.itemid);

            // Obtener la info de item id en temp_useriteminfo y renombrar la columna itemid a item
            const itemGeneralInfo = await TempUserItemInfo.findAll({
                attributes: ['id','exp', 'item_sn','level','limittime','sn_type','itemid'],
                where: {
                    id: itemIds
                },
            });

            // console.log(itemGeneralInfo);

            // Paso 3: Convertir el resultado de userItemsInfo a un diccionario para fácil acceso
            const userItemsInfoMap = itemGeneralInfo.reduce((map, userItem) => {
                map[userItem.id] = userItem;
                return map;
            }, {});

            // Paso 4: Fusionar la información en el arreglo original de items
            const mergedItems = items.map(item => {
                // Buscar la información de useriteminfo correspondiente al itemid
                const uii = userItemsInfoMap[item.itemid] || {};

                // Fusionar la información del item original con la información adicional
                return {
                    ...item.toJSON(), // Convierte la instancia de Sequelize a un objeto plano
                    uii, // Agrega la información de useriteminfo
                };
            });

            // Obtener todos los itemIds de Market
            const itemIds2 = mergedItems.map(item => item.uii.itemid);

            // Obtener los nombres de los items desde ItemInfo
            const itemInfos = await ItemInfo.findAll({
                where: {
                    id: itemIds2
                },
                // attributes: ['id', 'name']
            });

            // Crear un mapa para un acceso rápido a los nombres
            // const itemInfoMap = {};

            const itemInfoMap = itemInfos.reduce((map, itemInfo) => {
                map[itemInfo.id] = itemInfo;
                return map;
            }, {});

              // Obtener imágenes
            const itemImages = await ItemImage.findAll({
                where: {
                    item: itemIds2
                }
            });

            const imageMap = itemImages.reduce((map, img) => {
                map[img.item] = img.image;
                return map;
            }, {});


            const medioPagoIds = [...new Set(items.map(i => i.medio_pago))]; // IDs únicos
            const paymentMethods = await PaymentMethods.findAll({
                where: { id: medioPagoIds },
                attributes: ['id', 'name', 'color', 'icon'], // Ajusta si tus columnas tienen otro nombre
            });

            const paymentMap = paymentMethods.reduce((map, pm) => {
                map[pm.id] = pm;
                return map;
            }, {});

            // // Combinar los resultados
            const mergedItemsFinal = mergedItems.map(item => {
                // Buscar la información de useriteminfo correspondiente al itemid
                // console.log(item)
                const iiRaw = itemInfoMap[item.uii.itemid];
                const ii = iiRaw ? iiRaw.toJSON() : {};
                const className = ii ? setClassName(ii.Class): ''; // obtener el texto del class
                const fullName = ii.name ? `${ii.name}${className}` : 'Desconocido'; // concatenar si hay nombre
                const imageUrl = imageMap[item.uii.itemid] || 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/480px-No_image_available.svg.png';

                 // Calcular diferencia de horas
                // const fechaMarketplace = new Date(item.fecha); // fecha de la base de datos
                // const ahora = new Date(); // fecha actual
                // const diferenciaMs = ahora - fechaMarketplace; // Diferencia en milisegundos
                // const horasPasadas = diferenciaMs / (1000 * 60 * 60); // Convertir a horas

                // const returnFlag = horasPasadas >= 24; // true si pasaron 24h o más, false si no

                const paymentInfo = paymentMap[item.medio_pago]
                ? paymentMap[item.medio_pago].toJSON()
                : { name: 'Desconocido', color: '#999', icon: null };

                // Fusionar la información del item original con la información adicional
                return {
                    ...item,
                    ii: {
                        ...ii,
                        name: fullName, // sobrescribe el name con el name + class
                    },
                    url: imageUrl, // Añade la propiedad .url
                    payment: paymentInfo, // ✅ Añadido aquí
                };
            });

            return { success: true, code: '000', _mp: mergedItemsFinal };
        } catch (error) {
          console.error('Error al obtener items de la tienda:', error);
          throw new Error('Error interno del servidor');
        }
    }

    async getParams() {
        try{

            // Obtener comisión
            const parameters = await ConfigParameters.findAll({
                where: {
                    name: {
                        [Op.in]: ['comission_selling', 'min_price_sell'] // aquí pones los name que quieras traer
                    }
                }
            });

            return { success: true, code: '000', psll: parameters };
        } catch (error) {
          console.error('Error al obtener items de la tienda:', error);
          throw new Error('Error interno del servidor');
        }
    }

}

export default new MarketService();